// Inicia y detiene únicamente los procesos de este entorno de desarrollo.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const serverPort = process.env.DEV_SERVER_PORT ?? '2567'
const clientPort = process.env.DEV_CLIENT_PORT ?? '5173'
const commands = [
  {
    name: 'server',
    args: [require.resolve('tsx/cli'), 'watch', 'apps/server/src/index.ts'],
    env: {
      PORT: serverPort,
      NODE_ENV: 'development',
      DOBLONIA_DEV: '1',
      ALLOWED_ORIGINS: 'http://localhost:' + clientPort,
    },
  },
  {
    name: 'client',
    args: [
      resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js'),
      'apps/client',
      '--port',
      clientPort,
      '--strictPort',
    ],
    env: { VITE_SERVER_URL: process.env.VITE_SERVER_URL ?? 'http://localhost:' + serverPort },
  },
]
let stopping = false
const children = []

function stop(code = 0) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        /* El proceso ya terminó. */
      }
    }
  }
}

for (const command of commands) {
  const child = spawn(process.execPath, command.args, {
    cwd: root,
    env: { ...process.env, ...command.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  })
  children.push(child)
  for (const [stream, output] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    stream.on('data', (chunk) => output.write('[' + command.name + '] ' + chunk.toString()))
  }
  child.on('error', (error) => {
    console.error(command.name + ':', error.message)
    stop(1)
  })
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1)
  })
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
