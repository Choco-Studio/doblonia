import { createServer, connect, type Socket } from 'node:net'
import { once } from 'node:events'

/** Retarda un flujo TCP sin reordenar bytes. Solo escucha en la interfaz local. */
export async function createDelayedProxy(upstreamPort: number, oneWayMs = 75, jitterMs = 20) {
  const sockets = new Set<Socket>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let unavailableUntil = 0
  let transferredBytes = 0
  let seed = 20260919
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }

  const server = createServer((downstream) => {
    if (Date.now() < unavailableUntil) return downstream.destroy()
    const upstream = connect(upstreamPort, '127.0.0.1')
    for (const socket of [downstream, upstream]) {
      sockets.add(socket)
      socket.setNoDelay(true)
      socket.on('error', () => socket.destroy())
      socket.on('close', () => {
        sockets.delete(socket)
        downstream.destroy()
        upstream.destroy()
      })
    }
    const relay = (source: Socket, target: Socket) => {
      let dueAt = 0
      let queuedBytes = 0
      source.on('data', (data: Buffer) => {
        queuedBytes += data.length
        if (queuedBytes > 8 * 1024 * 1024) return source.destroy()
        const wait = Math.max(0, oneWayMs + (random() * 2 - 1) * jitterMs)
        dueAt = Math.max(dueAt, Date.now() + wait)
        const timer = setTimeout(
          () => {
            timers.delete(timer)
            queuedBytes -= data.length
            if (target.destroyed) return
            transferredBytes += data.length
            if (!target.write(data)) {
              source.pause()
              target.once('drain', () => source.resume())
            }
          },
          Math.max(0, dueAt - Date.now()),
        )
        timers.add(timer)
      })
    }
    relay(downstream, upstream)
    relay(upstream, downstream)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Proxy address unavailable')

  return {
    url: `http://127.0.0.1:${address.port}`,
    bytes: () => transferredBytes,
    cutFor(ms: number) {
      unavailableUntil = Date.now() + ms
      for (const socket of sockets) socket.destroy()
    },
    async close() {
      for (const timer of timers) clearTimeout(timer)
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    },
  }
}
