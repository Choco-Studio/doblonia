import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { Client } from '@colyseus/sdk'
import { createGameServer } from '../../server/src/server.js'
import { Connection } from '../src/net/Connection.js'

async function until(check: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 5000
  while (!check()) {
    assert.ok(Date.now() < deadline, message)
    await delay(20)
  }
}

test(
  'real server: FFA, teams, rejected purchases, finite input and reconnecting the same captain',
  { timeout: 20000 },
  async () => {
    const frontendOrigin = 'https://client.example'
    const { gameServer, httpServer } = createGameServer({
      gracefullyShutdown: false,
      allowedOrigins: [frontendOrigin],
    })
    const connections: Connection[] = []
    try {
      await gameServer.listen(0, '127.0.0.1')
      const address = httpServer.address()
      assert.ok(address && typeof address !== 'string')
      const url = `http://127.0.0.1:${address.port}`
      assert.equal((await (await fetch(`${url}/health`)).json()).ok, true)

      for (const mode of ['ffa', 'tdm', 'tdm'] as const) {
        const conn = new Connection(new Client(url))
        connections.push(conn)
        const room = await conn.join(mode, '<Captain>', 'invalid-skin')
        room.onMessage('events', () => {})
        room.onMessage('actionResult', () => {})
        await until(
          () => !!room.state?.ships.get(room.sessionId),
          'The first snapshot must contain the captain',
        )
        const ship = room.state.ships.get(room.sessionId)!
        assert.equal(ship.name, 'Captain')
        assert.equal(ship.skin, 'roble')
        assert.equal(room.state.mode, mode)
      }
      const [solo, red, blue] = connections
      assert.equal(red.room!.roomId, blue.room!.roomId)
      assert.notEqual(
        red.room!.state.ships.get(red.room!.sessionId)!.team,
        blue.room!.state.ships.get(blue.room!.sessionId)!.team,
      )
      const first = solo.room!
      const id = first.sessionId
      const roomId = first.roomId
      const result = new Promise<{ ok: boolean; reason: string }>((resolve) =>
        first.onMessage('actionResult', resolve),
      )
      solo.buyFleet('man_of_war')
      assert.deepEqual(await result, { action: 'buyFleet', ok: false, reason: 'insufficient_funds' })

      for (const message of [
        null,
        [],
        'bad input',
        { throttle: Infinity, turn: NaN, aimAngle: {}, firing: 'true' },
      ]) {
        first.send('input', message)
        await delay(25)
        assert.ok(
          first.connection.isOpen,
          `Malformed input disconnected the captain: ${JSON.stringify(message)}`,
        )
      }
      await delay(150)
      const ship = first.state.ships.get(id)!
      assert.ok([ship.x, ship.y, ship.angle, ship.hp].every(Number.isFinite))

      await first.leave(false)
      const recovered = await solo.reconnect()
      assert.ok(recovered, 'A dropped socket must recover its reserved seat')
      recovered.onMessage('events', () => {})
      recovered.onMessage('actionResult', () => {})
      assert.equal(recovered.sessionId, id)
      assert.equal(recovered.roomId, roomId)
      await until(() => !!recovered.state?.ships.get(id), 'The recovered room must receive a full snapshot')
      assert.equal(recovered.connection.isOpen, true)
      const status = await (await fetch(`${url}/status`)).json()
      assert.equal(status.modes.ffa.humans, 1)
      assert.equal(status.modes.tdm.humans, 2)
      const deniedOrigin = await fetch(`${url}/status`, { headers: { Origin: 'https://untrusted.example' } })
      assert.equal(deniedOrigin.headers.get('access-control-allow-origin'), null)
      for (const origin of [url, frontendOrigin]) {
        const trustedOrigin = await fetch(`${url}/status`, { headers: { Origin: origin } })
        assert.equal(trustedOrigin.headers.get('access-control-allow-origin'), origin)
        assert.equal(trustedOrigin.headers.get('access-control-allow-credentials'), 'true')
        const preflight = await fetch(`${url}/matchmake/joinOrCreate/doblonia_ffa`, {
          method: 'OPTIONS',
          headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
        })
        assert.equal(preflight.headers.get('access-control-allow-origin'), origin)
        assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true')
      }
      for (const origin of ['https://untrusted.example', 'null']) {
        const preflight = await fetch(`${url}/matchmake/joinOrCreate/doblonia_ffa`, {
          method: 'OPTIONS',
          headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
        })
        assert.equal(preflight.headers.get('access-control-allow-origin'), null)
        assert.equal(preflight.headers.get('access-control-allow-credentials'), null)
      }
    } finally {
      for (const conn of connections) conn.leave()
      await gameServer.gracefullyShutdown(false)
    }
  },
)
