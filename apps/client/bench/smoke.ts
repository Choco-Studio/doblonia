import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { Client, type Room } from '@colyseus/sdk'
import { RoomStateSchema } from '@doblonia/protocol'

const endpoint = process.argv[2] ?? 'http://127.0.0.1:2567'
const origin = new URL(endpoint).origin
const deadline = Date.now() + 30000
for (;;) {
  try {
    const health = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(2000) })
    assert.ok(health.ok)
    assert.equal((await health.json()).ok, true)
    break
  } catch (error) {
    if (Date.now() >= deadline) throw error
    await delay(250)
  }
}
const page = await fetch(origin)
assert.ok(page.ok)
assert.match(page.headers.get('content-type') ?? '', /text\/html/)
assert.match(await page.text(), /Doblonia/)
const sdk = new Client(origin)
const rooms: Room<RoomStateSchema>[] = []
try {
  for (const mode of ['ffa', 'tdm']) {
    const room = await sdk.create<RoomStateSchema>(
      `doblonia_${mode}`,
      { name: 'Release smoke' },
      RoomStateSchema,
    )
    rooms.push(room)
    room.reconnection.enabled = false
    room.onMessage('events', () => {})
    let patches = 0
    room.onStateChange(() => patches++)
    const stateDeadline = Date.now() + 5000
    while (patches < 5) {
      assert.ok(Date.now() < stateDeadline, 'State updates stopped')
      await delay(50)
    }
    assert.equal(room.state.mode, mode)
    const ship = room.state.ships.get(room.sessionId)
    assert.ok(ship && [ship.x, ship.y, ship.hp].every(Number.isFinite))
    assert.ok(room.state.islands.length > 0)
    console.log(`${mode}: HTTP, WebSocket and ${patches} state updates OK`)
  }
} finally {
  await Promise.all(rooms.map((room) => room.leave(true)))
}
