import { createGameServer } from './server.js'

const port = Number(process.env.PORT ?? 2567)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535')
const host = process.env.HOST ?? '0.0.0.0'
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173')
}
const { gameServer } = createGameServer({ allowedOrigins })
gameServer
  .listen(port, host)
  .then(() => {
    console.log(`Doblonia.io listening on http://${host}:${port}`)
  })
  .catch((error: unknown) => {
    console.error('Unable to start Doblonia.io', error)
    process.exitCode = 1
  })
