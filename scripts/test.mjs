import { readdirSync } from 'node:fs'
import { spawn } from 'node:child_process'

const files = ['apps', 'packages'].flatMap((root) =>
  readdirSync(root, { recursive: true })
    .filter((file) => file.endsWith('.test.ts') && !file.includes('node_modules'))
    .map((file) => `${root}/${file}`),
)

const child = spawn(process.execPath, ['--import', 'tsx', '--test', ...files], { stdio: 'inherit' })
child.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
