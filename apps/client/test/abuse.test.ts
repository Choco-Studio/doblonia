import { test } from 'node:test'
import assert from 'node:assert/strict'
import { request } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { Client, type Room } from '@colyseus/sdk'
import { RoomStateSchema } from '@doblonia/protocol'
import { createGameServer } from '../../server/src/server.js'

async function until(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 5000
  while (!check()) {
    assert.ok(Date.now() < deadline, 'Expected network event did not arrive')
    await delay(20)
  }
}

test(
  'production rejects debug rewards, foreign origins, oversized frames and message floods',
  { timeout: 45000 },
  async (t) => {
    const previousMode = process.env.NODE_ENV
    const previousDev = process.env.DOBLONIA_DEV
    process.env.NODE_ENV = 'production'
    process.env.DOBLONIA_DEV = '1'
    const { gameServer, httpServer } = createGameServer({ gracefullyShutdown: false })
    const rooms: Room<RoomStateSchema>[] = []
    try {
      await gameServer.listen(0, '127.0.0.1')
      const address = httpServer.address()
      assert.ok(address && typeof address !== 'string')
      const url = `http://127.0.0.1:${address.port}`
      const sdk = new Client(url)
      const join = async () => {
        const room = await sdk.joinOrCreate<RoomStateSchema>(
          'doblonia_ffa',
          { name: 'Security test' },
          RoomStateSchema,
        )
        room.reconnection.enabled = false
        room.onMessage('events', () => {})
        room.onMessage('actionResult', () => {})
        room.onMessage('pong', () => {})
        room.onError(() => {})
        rooms.push(room)
        await until(() => !!room.state?.ships.get(room.sessionId))
        return room
      }
      const debugClient = await join()
      let debugClose = 0
      debugClient.onLeave((code) => {
        debugClose = code
      })
      debugClient.send('dev', { reward: 100000, x: 1900, y: 1900 })
      await until(() => debugClose !== 0)
      assert.equal(debugClose, 4002)
      assert.ok(debugClient.state.ships.get(debugClient.sessionId)!.coins < 100000)
      assert.equal(debugClient.state.ships.get(debugClient.sessionId)!.equipLevel, 1)
      t.diagnostic('Production debug commands ignored')
      const observer = await join()

      const deniedStatus = await new Promise<number | undefined>((resolve, reject) => {
        const req = request(`${url}/invalid/invalid`, {
          headers: {
            Connection: 'Upgrade',
            Upgrade: 'websocket',
            'Sec-WebSocket-Version': '13',
            'Sec-WebSocket-Key': 'MDEyMzQ1Njc4OWFiY2RlZg==',
            Origin: 'https://untrusted.example',
          },
        })
        req.on('response', (response) => {
          response.resume()
          resolve(response.statusCode)
        })
        req.on('upgrade', (_response, socket) => {
          socket.destroy()
          reject(new Error('Untrusted origin upgraded'))
        })
        req.on('error', reject)
        req.end()
      })
      assert.equal(deniedStatus, 403)
      t.diagnostic('Foreign WebSocket origin rejected')

      const oversized = await join()
      let largeClose = 0
      oversized.onLeave((code) => {
        largeClose = code
      })
      oversized.connection.send(new Uint8Array(4097))
      await until(() => largeClose !== 0)
      assert.equal(largeClose, 1009)
      t.diagnostic('Oversized frame rejected')

      const flood = await join()
      let floodClose = 0
      flood.onLeave((code) => {
        floodClose = code
      })
      for (let i = 0; i < 100; i++) flood.send('ping', { t: i })
      await until(() => floodClose !== 0)
      assert.equal(floodClose, 4002)
      t.diagnostic('Message flood rejected')

      const before = observer.state.timeMs
      await until(() => observer.state.timeMs > before + 100)
      assert.ok(observer.connection.isOpen, 'Other players must remain connected')
      assert.equal((await fetch(`${url}/health`)).status, 200)
    } finally {
      await Promise.race([
        Promise.all(rooms.filter((room) => room.connection.isOpen).map((room) => room.leave(true))),
        delay(1000),
      ])
      await gameServer.gracefullyShutdown(false)
      if (previousMode === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previousMode
      if (previousDev === undefined) delete process.env.DOBLONIA_DEV
      else process.env.DOBLONIA_DEV = previousDev
    }
  },
)
