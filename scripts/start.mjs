// La entrada pública deshabilita siempre los atajos de depuración.
process.env.NODE_ENV = 'production'
await import('../apps/server/dist/index.js')
