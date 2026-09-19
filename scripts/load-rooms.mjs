import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

// Cada sala usa su propio proceso de clientes; un único bucle no debe limitar al servidor.
const endpoint = process.argv[2] ?? 'http://127.0.0.1:2574'
const seconds = Number(process.argv[3] ?? 600)
const count = Number(process.argv[4] ?? 3)
assert.ok(Number.isInteger(count) && count >= 1 && count <= 4)
const children = []
try {
  await Promise.all(
    Array.from(
      { length: count },
      (_, index) =>
        new Promise((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              '--import',
              'tsx',
              'apps/client/bench/load.ts',
              endpoint,
              String(seconds),
              '1',
              `load-room-${index}`,
            ],
            { stdio: ['ignore', 'inherit', 'inherit'] },
          )
          children.push(child)
          child.on('error', reject)
          child.on('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`Load worker ${index} exited with ${code}`)),
          )
        }),
    ),
  )
  const rooms = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      readFile(`build/qa/load-room-${i}.json`, 'utf8').then(JSON.parse),
    ),
  )
  const report = {
    measuredAt: new Date().toISOString(),
    seconds,
    clients: rooms.reduce((sum, room) => sum + room.clients, 0),
    unexpectedLeaves: rooms.reduce((sum, room) => sum + room.unexpectedLeaves, 0),
    rooms,
    scope: 'One SDK load process per room, all on the same local machine. Not a hosting capacity estimate.',
  }
  await mkdir('build/qa', { recursive: true })
  await writeFile('build/qa/multi-room-load.json', JSON.stringify(report, null, 2) + '\n')
  console.log(`Verified ${report.clients} clients across ${count} rooms for ${seconds} seconds`)
} finally {
  for (const child of children) if (child.exitCode === null) child.kill()
}
