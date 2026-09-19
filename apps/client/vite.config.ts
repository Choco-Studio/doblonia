import { defineConfig } from 'vite'

export default defineConfig({
  envDir: '../..',
  server: {
    port: 5173,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Las librerías cambian menos que el juego: van aparte para aprovechar la caché del navegador.
        manualChunks: {
          pixi: ['pixi.js'],
          net: ['@colyseus/sdk', '@colyseus/schema'],
        },
      },
    },
  },
})
