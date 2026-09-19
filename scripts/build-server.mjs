import { build } from 'esbuild'

await build({
  entryPoints: ['apps/server/src/index.ts'],
  outfile: 'apps/server/dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external: ['@colyseus/core', '@colyseus/schema', '@colyseus/ws-transport', 'express', 'cors'],
  logLevel: 'info',
})
