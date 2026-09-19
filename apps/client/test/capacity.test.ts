import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { Client, type Room } from '@colyseus/sdk'
import { RoomStateSchema } from '@doblonia/protocol'
import { ROOM_CAPACITY } from '@doblonia/content'
import { createGameServer } from '../../server/src/server.js'

test(
  'matchmaking fills maps, preserves reconnect seats and reuses vacancies',
  { timeout: 30000 },
  async () => {
    const { gameServer, httpServer } = createGameServer({ gracefullyShutdown: false })
    await gameServer.listen(0, '127.0.0.1')
    const address = httpServer.address()
    assert.ok(address && typeof address !== 'string')
    const endpoint = `http://127.0.0.1:${address.port}`
    const clients: Room<RoomStateSchema>[] = []
    let maxPopulation = 0
    async function observe(room: Room<RoomStateSchema>) {
      clients.push(room)
      room.reconnection.enabled = false
      room.onMessage('events', () => {})
      room.onStateChange((state) => {
        maxPopulation = Math.max(maxPopulation, state.ships.size)
      })
      const deadline = performance.now() + 3000
      while (!room.state?.ships.has(room.sessionId)) {
        assert.ok(performance.now() < deadline, 'The joining captain must receive a snapshot')
        await delay(20)
      }
      return room
    }
    async function join(mode = 'ffa') {
      return observe(
        await new Client(endpoint).joinOrCreate<RoomStateSchema>(`doblonia_${mode}`, {}, RoomStateSchema),
      )
    }
    try {
      const first = await join()
      for (let i = 1; i < ROOM_CAPACITY - 2; i++) assert.equal((await join()).roomId, first.roomId)
      // Más peticiones simultáneas que plazas: las reservas deben impedir el desbordamiento.
      const burst = await Promise.all(Array.from({ length: 5 }, () => join()))
      assert.equal(burst.filter((room) => room.roomId === first.roomId).length, 2)
      const secondId = burst.find((room) => room.roomId !== first.roomId)!.roomId
      assert.ok(burst.every((room) => room.roomId === first.roomId || room.roomId === secondId))
      assert.equal(first.state.ships.size, ROOM_CAPACITY)
      for (let i = 3; i < ROOM_CAPACITY; i++) assert.equal((await join()).roomId, secondId)
      const third = await join()
      assert.notEqual(third.roomId, first.roomId)
      assert.notEqual(third.roomId, secondId)

      const token = first.reconnectionToken
      const dropped = new Promise<void>((resolve) => first.onLeave(() => resolve()))
      first.connection.close(1000)
      await dropped
      assert.equal((await join()).roomId, third.roomId, 'A reconnect reservation is not a free place')
      const recovered = await observe(
        await new Client(endpoint).reconnect<RoomStateSchema>(token, RoomStateSchema),
      )
      assert.equal(recovered.roomId, first.roomId)
      assert.equal(recovered.sessionId, first.sessionId)

      await recovered.leave(true)
      const vacancy = await join()
      assert.equal(vacancy.roomId, first.roomId, 'The fullest available room is reused')
      const tdm = await join('tdm')
      assert.notEqual(tdm.roomId, first.roomId)
      assert.notEqual(tdm.roomId, secondId)
      assert.equal(tdm.state.mode, 'tdm')
      assert.ok(maxPopulation <= ROOM_CAPACITY, `Observed ${maxPopulation} captains on one map`)
      const status = await fetch(`${endpoint}/status`).then((response) => response.json())
      assert.equal(status.capacityPerRoom, ROOM_CAPACITY)
      assert.equal(status.modes.ffa.rooms, 3)
      assert.equal(status.modes.ffa.humans, ROOM_CAPACITY * 2 + 2)
    } finally {
      await Promise.all(clients.filter((room) => room.connection.isOpen).map((room) => room.leave(true)))
      await gameServer.gracefullyShutdown(false)
    }
  },
)
