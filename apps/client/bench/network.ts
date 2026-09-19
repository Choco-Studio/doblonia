import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { performance } from 'node:perf_hooks'
import { Client, type Room } from '@colyseus/sdk'
import { RoomStateSchema } from '@doblonia/protocol'

// Ejecutar contra un servidor propio, nunca contra un servicio ajeno sin autorización.
const endpoint = process.argv[2] ?? 'http://127.0.0.1:2569'
const seconds = Number(process.argv[3] ?? 60)
assert.ok(Number.isInteger(seconds) && seconds >= 1 && seconds <= 3600)
const rooms: Room<RoomStateSchema>[] = []
const rtts: number[] = []
const patches: number[] = []
let timer: ReturnType<typeof setInterval> | undefined
let unexpectedLeaves = 0
let checking = true
try {
  for (let i = 0; i < 24; i++) {
    const room = await new Client(endpoint).joinOrCreate<RoomStateSchema>(
      'doblonia_ffa',
      { name: `Load ${i}` },
      RoomStateSchema,
    )
    room.reconnection.enabled = false
    room.onMessage('events', () => {})
    room.onMessage('actionResult', () => {})
    room.onMessage<{ t: number }>('pong', (message) => rtts.push(performance.now() - message.t))
    room.onStateChange(() => {
      patches[i] = (patches[i] ?? 0) + 1
    })
    room.onLeave(() => {
      if (checking) unexpectedLeaves++
    })
    rooms.push(room)
  }
  assert.equal(new Set(rooms.map((room) => room.roomId)).size, 1, '24 clients should fit in one room')
  let tick = 0
  timer = setInterval(() => {
    for (const [i, room] of rooms.entries()) {
      room.send('input', {
        throttle: 1,
        turn: Math.sin(tick / 120 + i),
        aimAngle: (tick / 60) % (Math.PI * 2),
        aimDist: 400,
        firing: true,
        fireCoin: false,
        seq: tick,
      })
      if (tick % 60 === 0) {
        room.send('ping', { t: performance.now() })
        if (room.state?.ships.get(room.sessionId)?.alive === false) room.send('respawn')
      }
    }
    tick++
  }, 1000 / 30)
  await delay(seconds * 1000)
  assert.equal(unexpectedLeaves, 0)
  assert.ok(
    rooms.every((room) => room.connection.isOpen && Number.isFinite(room.state.ships.get(room.sessionId)?.x)),
  )
  assert.ok(
    patches.every((count) => count > seconds * 10),
    'Every client must continue receiving snapshots',
  )
  rtts.sort((a, b) => a - b)
  const at = (fraction: number) => Number(rtts[Math.floor((rtts.length - 1) * fraction)].toFixed(2))
  console.log(
    JSON.stringify(
      {
        clients: rooms.length,
        seconds,
        unexpectedLeaves,
        snapshots: { min: Math.min(...patches), max: Math.max(...patches) },
        rttMs: { p50: at(0.5), p95: at(0.95), p99: at(0.99), samples: rtts.length },
      },
      null,
      2,
    ),
  )
} finally {
  checking = false
  clearInterval(timer)
  await Promise.all(rooms.map((room) => room.leave(true)))
}
