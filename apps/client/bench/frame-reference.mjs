import { createServer } from 'node:http'

// Referencia sin juego para distinguir la cadencia del navegador del coste de renderizado.
createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(
    '<!doctype html><html lang="es"><meta charset="utf-8"><title>Referencia RAF</title><body style="background:#082937;color:white;font:24px system-ui;padding:40px"><h1>Referencia sin renderizado</h1><p>Inyecta browserProbe.mjs para medir la cadencia disponible.</p></body></html>',
  )
}).listen(2576, '127.0.0.1', () => console.log('RAF reference: http://127.0.0.1:2576'))
