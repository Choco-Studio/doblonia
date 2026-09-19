import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import { Client, type Room } from '@colyseus/sdk'
import { RoomStateSchema } from '@doblonia/protocol'
import { BRANCHES_BY_SLOT, SLOT_ORDER, FLEET_SHIPS, ROOM_CAPACITY } from '@doblonia/content'
import { maintainDecodedState } from '../src/net/decodedState.js'

// Usa una instancia local dedicada con DOBLONIA_DEV=1. Las recompensas son una carga sintética.
const endpoint = process.argv[2] ?? 'http://127.0.0.1:2574'
const seconds = Number(process.argv[3] ?? 600)
const roomCount = Number(process.argv[4] ?? 3)
const reportName = process.argv[5] ?? 'multi-room-load'
const decodeMode = process.argv[6] ?? 'full'
assert.ok(decodeMode === 'full' || decodeMode === 'transport')
assert.match(reportName, /^[a-z0-9-]+$/)
assert.ok(
  ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(endpoint).hostname),
  'Load fixtures are local only',
)
assert.ok(Number.isInteger(seconds) && seconds >= 30 && seconds <= 3600)
assert.ok(Number.isInteger(roomCount) && roomCount >= 1 && roomCount <= 4)

interface Participant {
  room: Room<RoomStateSchema>
  commands: { type: string; payload: unknown }[]
  prepared: boolean
  patches: number
}
const clients: Participant[] = []
const rtts: number[] = []
const memory: {
  seconds: number
  heapMiB: number
  decoderRefs: number
  bulletIndexes: number
  bullets: number
}[] = []
const eventLoop = monitorEventLoopDelay({ resolution: 20 })
eventLoop.enable()
let unexpectedLeaves = 0
const leaves: { code: number; reason: string; seconds: number }[] = []
let started = performance.now()
let checking = true
let timer: ReturnType<typeof setInterval> | undefined
let peakFleet = 0
let peakBullets = 0
let advancedShips = 0
let failDecode: (reason: Error) => void
const decodeFailure = new Promise<never>((_resolve, reject) => {
  failDecode = reject
})
void decodeFailure.catch(() => {})
const stop = new AbortController()
const originalWarn = console.warn
const originalError = console.error
function captureDecode(...args: unknown[]): void {
  const message = String(args[0])
  if (/schema|refId|definition mismatch/i.test(message)) {
    failDecode(new Error(`State decoding failed: ${message}`))
    return
  }
  originalWarn(...args)
}

function prepare(index: number): Participant['commands'] {
  const commands: Participant['commands'] = [{ type: 'dev', payload: { reward: 100000 } }]
  for (let level = 0; level < 15; level++) commands.push({ type: 'buyStat', payload: { statId: 'hull' } })
  for (const fleet of FLEET_SHIPS) commands.push({ type: 'buyFleet', payload: { defId: fleet.id } })
  for (const slot of SLOT_ORDER) {
    const branches = BRANCHES_BY_SLOT[slot]
    const branch = branches[index % branches.length]
    let tier = branch.tiers[0]
    for (;;) {
      commands.push({ type: 'equipPick', payload: { slot, branchId: branch.id, tierId: tier.id } })
      const next = branch.tiers.find((candidate) => candidate.id === tier.nextIds?.[0])
      if (!next) break
      tier = next
    }
  }
  for (let level = 0; level < 15; level++) {
    for (const statId of ['repair', 'range', 'damage', 'reload']) {
      commands.push({ type: 'buyStat', payload: { statId } })
    }
  }
  return commands
}

try {
  console.warn = console.error = captureDecode
  for (let group = 0; group < roomCount; group++) {
    let roomId = ''
    for (let i = 0; i < ROOM_CAPACITY; i++) {
      const sdk = new Client(endpoint)
      const options = { name: `Carga ${group}-${i}` }
      const room =
        i === 0
          ? await sdk.create<RoomStateSchema>('doblonia_ffa', options, RoomStateSchema)
          : await sdk.joinById<RoomStateSchema>(roomId, options, RoomStateSchema)
      roomId = room.roomId
      if (decodeMode === 'transport' && i > 0) {
        // Diagnóstico de servidor: todos reciben los bytes, pero un observador por
        // sala decodifica el mundo compartido. No representa el trabajo del navegador.
        const observer = clients[group * ROOM_CAPACITY].room
        room.serializer.setState = () => {}
        room.serializer.patch = () => []
        room.serializer.getState = () => observer.state
      } else maintainDecodedState(room)
      room.reconnection.enabled = false
      const client: Participant = { room, commands: [], prepared: false, patches: 0 }
      room.onMessage('events', () => {})
      room.onMessage('actionResult', () => {})
      room.onMessage<{ t: number }>('pong', ({ t }) => {
        if (rtts.length < 20000) rtts.push(performance.now() - t)
      })
      room.onStateChange(() => client.patches++)
      room.onLeave((code, reason) => {
        if (checking) {
          unexpectedLeaves++
          const leave = {
            code,
            reason: reason ?? '',
            seconds: Math.round((performance.now() - started) / 1000),
          }
          leaves.push(leave)
          console.log(`Unexpected leave: ${JSON.stringify(leave)}`)
        }
      })
      clients.push(client)
    }
  }
  assert.equal(new Set(clients.map(({ room }) => room.roomId)).size, roomCount)
  started = performance.now()
  let tick = 0
  timer = setInterval(() => {
    for (const [index, client] of clients.entries()) {
      const room = client.room
      if (!room.connection.isOpen) continue
      const ship = room.state?.ships.get(room.sessionId)
      if (!ship) continue
      if (!ship.alive) {
        client.prepared = false
        client.commands = []
        if (tick % 40 === 0) room.send('respawn')
        continue
      }
      if (!client.prepared) {
        client.commands = prepare(index)
        client.prepared = true
      }
      const next = client.commands.shift()
      if (next) room.send(next.type, next.payload)
      room.send('input', {
        throttle: 1,
        turn: Math.sin(tick / 100 + index),
        aimAngle: (tick / 50) % (Math.PI * 2),
        aimDist: 300,
        firing: client.commands.length === 0,
        fireCoin: false,
        seq: tick,
      })
      if (tick % 100 === 0) {
        room.send('ping', { t: performance.now() })
        if (!client.commands.length) {
          room.send('dev', { reward: 3000 })
          for (const fleet of FLEET_SHIPS) room.send('buyFleet', { defId: fleet.id })
        }
      }
    }
    if (tick % 20 === 0) {
      const representatives = clients.filter((_, index) => index % ROOM_CAPACITY === 0)
      peakFleet = Math.max(
        peakFleet,
        representatives.reduce((sum, { room }) => sum + room.state.fleet.size, 0),
      )
      peakBullets = Math.max(
        peakBullets,
        representatives.reduce((sum, { room }) => sum + room.state.bullets.size, 0),
      )
      advancedShips = Math.max(
        advancedShips,
        clients.filter(({ room }) => (room.state.ships.get(room.sessionId)?.equipLevel ?? 0) > 10).length,
      )
    }
    if (tick % 1200 === 0) {
      const elapsed = Math.round((performance.now() - started) / 1000)
      const observer = clients[0].room
      memory.push({
        seconds: elapsed,
        heapMiB: Math.round(process.memoryUsage().heapUsed / 1048576),
        decoderRefs: observer.serializer.decoder.root.refs.size,
        bulletIndexes: Object.keys(observer.state.bullets._collectionIndexes).length,
        bullets: observer.state.bullets.size,
      })
      console.log(
        `Carga: ${elapsed}/${seconds} s, ${clients.length} clientes, ${unexpectedLeaves} desconexiones`,
      )
    }
    tick++
  }, 50)
  await Promise.race([delay(seconds * 1000, undefined, { signal: stop.signal }), decodeFailure])
  console.log(
    JSON.stringify({
      unexpectedLeaves,
      leaves,
      advancedShips,
      peakFleet,
      peakBullets,
      minPatches: Math.min(...clients.map((c) => c.patches)),
    }),
  )
  rtts.sort((a, b) => a - b)
  const at = (p: number) => (rtts.length ? Number(rtts[Math.floor((rtts.length - 1) * p)].toFixed(2)) : null)
  const report = {
    measuredAt: new Date().toISOString(),
    seconds,
    rooms: roomCount,
    clients: clients.length,
    decodeMode,
    webSocketImplementation: typeof globalThis.WebSocket === 'undefined' ? 'ws' : 'native',
    unexpectedLeaves,
    leaves,
    eventLoopMs: {
      p99: Number((eventLoop.percentile(99) / 1e6).toFixed(2)),
      max: Number((eventLoop.max / 1e6).toFixed(2)),
    },
    advancedShips,
    peakFleet,
    peakBullets,
    snapshots: {
      min: Math.min(...clients.map((c) => c.patches)),
      max: Math.max(...clients.map((c) => c.patches)),
    },
    rttMs: { p50: at(0.5), p95: at(0.95), p99: at(0.99), samples: rtts.length },
    clientHeapSamples: memory,
    scope: `Local SDK clients; ${decodeMode === 'full' ? 'every connection decodes state' : 'one state decoder per room, other clients receive without decoding'}; synthetic rewards and replenished fleets. Excludes Internet latency and browser rendering.`,
  }
  mkdirSync('build/qa', { recursive: true })
  writeFileSync(`build/qa/${reportName}.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
  // Conserva también las medidas fallidas, necesarias para investigar los cierres.
  assert.equal(unexpectedLeaves, 0)
  assert.equal(advancedShips, clients.length, 'Every participant must actually receive advanced equipment')
  assert.ok(peakFleet >= clients.length * 3, 'The test must exercise fleets, not only bare ships')
  for (const { room, patches } of clients) {
    assert.ok(room.connection.isOpen)
    const ship = room.state.ships.get(room.sessionId)
    assert.ok(ship && [ship.x, ship.y, ship.hp, ship.coins].every(Number.isFinite))
    assert.ok(patches > seconds * 8, 'State updates must continue throughout the test')
  }
  assert.ok(rtts.length > 0)
} finally {
  console.warn = originalWarn
  console.error = originalError
  checking = false
  eventLoop.disable()
  clearInterval(timer)
  stop.abort()
  await Promise.race([
    Promise.all(clients.filter(({ room }) => room.connection.isOpen).map(({ room }) => room.leave(true))),
    delay(1000),
  ])
}
