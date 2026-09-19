import http from 'http'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import { Server, matchMaker } from '@colyseus/core'
import { Encoder } from '@colyseus/schema'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { DobloniaRoom } from './DobloniaRoom.js'
import { ROOM_CAPACITY } from '@doblonia/content'
import project from '../../../package.json' with { type: 'json' }

// Con ~16 barcos + flota + ~180 monedas + islas, el snapshot inicial supera el buffer por defecto (8 KB).
Encoder.BUFFER_SIZE = 128 * 1024

interface ServerConfig {
  allowedOrigins?: string[]
  clientDist?: string
  gracefullyShutdown?: boolean
}

/** HTTP y WebSocket comparten proceso para simplificar el autoalojamiento. */
export function createGameServer(config: ServerConfig = {}) {
  const allowedOrigins = new Set(config.allowedOrigins ?? [])
  const acceptsOrigin = (origin: string | undefined, host: string | undefined) => {
    if (!origin) return true
    if (allowedOrigins.has(origin)) return true
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }
  const app = express()
  app.disable('x-powered-by')
  app.use(
    cors((req, next) => {
      const accepted = acceptsOrigin(req.headers.origin, req.headers.host)
      next(null, {
        origin: accepted,
        credentials: accepted,
        methods: ['GET', 'POST', 'OPTIONS'],
      })
    }),
  )
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })
  // Colyseus combina estas cabeceras con sus valores por defecto, incluso fuera de /matchmake.
  // Hay que retirar el comodín: devolver «null» permitiría orígenes opacos (iframes sandbox, archivos).
  const defaultCors = matchMaker.controller.DEFAULT_CORS_HEADERS as Record<string, string>
  delete defaultCors['Access-Control-Allow-Origin']
  delete defaultCors['Access-Control-Allow-Credentials']
  defaultCors['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
  defaultCors['Access-Control-Max-Age'] = '600'
  matchMaker.controller.getCorsHeaders = (headers): Record<string, string> => {
    const origin = headers.get('origin') ?? undefined
    const responseHeaders: Record<string, string> = { Vary: 'Origin' }
    if (origin && acceptsOrigin(origin, headers.get('host') ?? undefined)) {
      responseHeaders['Access-Control-Allow-Origin'] = origin
      // El SDK usa credentials: include también para reservar salas entre orígenes autorizados.
      responseHeaders['Access-Control-Allow-Credentials'] = 'true'
    }
    return responseHeaders
  }

  app.get('/health', (_req, res) => {
    res.json({ ok: true, game: 'Doblonia.io', version: project.version })
  })

  app.get('/status', async (_req, res) => {
    try {
      const rooms = await matchMaker.query({})
      const byMode: Record<string, { rooms: number; humans: number; players: number }> = {
        ffa: { rooms: 0, humans: 0, players: 0 },
        tdm: { rooms: 0, humans: 0, players: 0 },
      }
      for (const r of rooms) {
        const metadata = r.metadata as { mode?: string; humans?: number; players?: number } | undefined
        const mode = metadata?.mode === 'tdm' ? 'tdm' : 'ffa'
        byMode[mode].rooms++
        byMode[mode].humans += metadata?.humans ?? r.clients
        byMode[mode].players += metadata?.players ?? r.clients
      }
      res.json({ ok: true, capacityPerRoom: ROOM_CAPACITY, modes: byMode })
    } catch {
      res.status(503).json({ ok: false })
    }
  })

  // En producción el mismo proceso sirve el cliente compilado (autoalojamiento en un solo paso).
  const here = path.dirname(fileURLToPath(import.meta.url))
  const clientDist = config.clientDist ?? path.resolve(here, '../../client/dist')
  if (fs.existsSync(clientDist)) {
    app.use(
      express.static(clientDist, {
        maxAge: '1h',
        index: 'index.html',
        setHeaders(res, file) {
          if (file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache')
        },
      }),
    )
  }

  const httpServer = http.createServer(app)

  const gameServer = new Server({
    transport: new WebSocketTransport({
      server: httpServer,
      maxPayload: 4 * 1024,
      beforeUpgrade: (_request, context) =>
        acceptsOrigin(context.headers.get('origin') ?? undefined, context.headers.get('host') ?? undefined)
          ? undefined
          : new Response('Origin not allowed', { status: 403 }),
    }),
    greet: false,
    gracefullyShutdown: config.gracefullyShutdown,
  })

  // joinOrCreate completa primero una sala disponible y crea otro mapa al llenarse.
  gameServer.define('doblonia_ffa', DobloniaRoom, { mode: 'ffa' }).sortBy({ clients: -1 })
  gameServer.define('doblonia_tdm', DobloniaRoom, { mode: 'tdm' }).sortBy({ clients: -1 })

  return { gameServer, httpServer }
}
