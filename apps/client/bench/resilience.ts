import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { Client, type Room } from '@colyseus/sdk'
import type { RoomStateSchema } from '@doblonia/protocol'
import { Connection } from '../src/net/Connection.js'
import { createGameServer } from '../../server/src/server.js'
import { createDelayedProxy } from './tcpProxy.js'

async function until(check: () => boolean, description: string, ms = 5000) {
  const deadline = performance.now() + ms
  while (!check()) {
    assert.ok(performance.now() < deadline, description)
    await delay(20)
  }
}

function observe(room: Room<RoomStateSchema>) {
  room.onMessage('events', () => {})
  room.onMessage('actionResult', () => {})
  room.onError(() => {})
}

const { gameServer, httpServer } = createGameServer({ gracefullyShutdown: false })
await gameServer.listen(0, '127.0.0.1')
const address = httpServer.address()
assert.ok(address && typeof address !== 'string')
const proxy = await createDelayedProxy(address.port)
const connection = new Connection(new Client(proxy.url))

try {
  const room = await connection.join('ffa', 'Network test', 'roble')
  observe(room)
  await until(() => !!room.state?.ships.get(room.sessionId), 'Initial state must arrive through the proxy')
  const id = room.sessionId
  const roomId = room.roomId
  const rtts: number[] = []
  room.onMessage<{ t: number }>('pong', ({ t }) => rtts.push(performance.now() - t))
  const startX = room.state.ships.get(id)!.x
  const startY = room.state.ships.get(id)!.y
  for (let i = 0; i < 30; i++) {
    connection.sendInput({
      throttle: 1,
      turn: 0.2,
      aimAngle: 0,
      aimDist: 250,
      firing: false,
      fireCoin: false,
    })
    room.send('ping', { t: performance.now() })
    await delay(100)
  }
  await until(() => rtts.length >= 30, 'Pings must return despite latency and jitter')
  const moving = room.state.ships.get(id)!
  assert.ok(Math.hypot(moving.x - startX, moving.y - startY) > 10, 'Movement must reach the server')
  rtts.sort((a, b) => a - b)
  const percentile = (p: number) => Number(rtts[Math.floor((rtts.length - 1) * p)].toFixed(2))
  assert.ok(percentile(0.5) >= 100, 'The proxy must actually introduce latency')

  const closed = new Promise<void>((resolve) => room.onLeave(() => resolve()))
  proxy.cutFor(1200)
  await closed
  const recoveryStart = performance.now()
  const recovered = await connection.reconnect()
  assert.ok(recovered, 'A brief network outage must recover the reserved session')
  observe(recovered)
  await until(() => !!recovered.state?.ships.get(id), 'Recovery must deliver a complete snapshot')
  assert.equal(recovered.sessionId, id)
  assert.equal(recovered.roomId, roomId)
  assert.equal(connection.state, 'connected')
  const recoveryMs = Math.round(performance.now() - recoveryStart)

  const closedAgain = new Promise<void>((resolve) => recovered.onLeave(() => resolve()))
  proxy.cutFor(25000)
  await closedAgain
  const timeoutStart = performance.now()
  const expired = await connection.reconnect()
  const timeoutMs = Math.round(performance.now() - timeoutStart)
  assert.equal(expired, undefined, 'A prolonged outage must return control to the application')
  assert.ok(timeoutMs >= 17000 && timeoutMs < 22000, 'Recovery must respect its 18-second deadline')
  connection.leave()
  assert.equal(connection.state, 'closed')

  const report = {
    measuredAt: new Date().toISOString(),
    scenario: 'TCP proxy: 75 ms per direction, ±20 ms jitter, ordered bytes',
    rttMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), samples: rtts.length },
    briefOutageMs: 1200,
    recoveryMs,
    sameSession: true,
    prolongedOutageMs: 25000,
    timeoutMs,
    bytesRelayed: proxy.bytes(),
    scope: 'Real local sockets and SDK. Excludes browser rendering and Internet packet loss.',
  }
  mkdirSync('build/qa', { recursive: true })
  writeFileSync('build/qa/network-resilience.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  connection.leave()
  await proxy.close()
  await gameServer.gracefullyShutdown(false)
}
