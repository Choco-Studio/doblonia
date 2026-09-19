import { Tex, cached, worldTex, mulberry32 } from './shared.js'

// ---------------------------------------------------------------------------
// Genéricas: brillo, humo, espuma, chispa, sombra
// ---------------------------------------------------------------------------

export function glowTex(): Tex {
  return cached('glow', () =>
    worldTex(
      64,
      64,
      32,
      32,
      (ctx) => {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 32)
        g.addColorStop(0, 'rgba(255,255,255,1)')
        g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
        g.addColorStop(0.6, 'rgba(255,255,255,0.12)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(-32, -32, 64, 64)
      },
      1,
    ),
  )
}

export function smokeTex(): Tex {
  return cached('smoke', () =>
    worldTex(
      64,
      64,
      32,
      32,
      (ctx) => {
        const rnd = mulberry32(7)
        for (let i = 0; i < 7; i++) {
          const x = (rnd() - 0.5) * 22
          const y = (rnd() - 0.5) * 22
          const r = 12 + rnd() * 10
          const g = ctx.createRadialGradient(x, y, 0, x, y, r)
          g.addColorStop(0, 'rgba(255,255,255,0.55)')
          g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      },
      1,
    ),
  )
}

export function foamTex(): Tex {
  return cached('foam', () =>
    worldTex(
      32,
      32,
      16,
      16,
      (ctx) => {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16)
        g.addColorStop(0, 'rgba(255,255,255,0.9)')
        g.addColorStop(0.5, 'rgba(235,250,255,0.45)')
        g.addColorStop(1, 'rgba(235,250,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(-16, -16, 32, 32)
      },
      1,
    ),
  )
}

export function sparkTex(): Tex {
  return cached('spark', () =>
    worldTex(
      32,
      8,
      16,
      4,
      (ctx) => {
        const g = ctx.createLinearGradient(-16, 0, 16, 0)
        g.addColorStop(0, 'rgba(255,255,255,0)')
        g.addColorStop(0.7, 'rgba(255,255,255,0.9)')
        g.addColorStop(1, 'rgba(255,255,255,1)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.ellipse(0, 0, 16, 3, 0, 0, Math.PI * 2)
        ctx.fill()
      },
      1,
    ),
  )
}

export function ringTex(): Tex {
  return cached('ring', () =>
    worldTex(
      128,
      128,
      64,
      64,
      (ctx) => {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.arc(0, 0, 58, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.lineWidth = 12
        ctx.beginPath()
        ctx.arc(0, 0, 52, 0, Math.PI * 2)
        ctx.stroke()
      },
      1,
    ),
  )
}

export function plankTex(): Tex {
  return cached('plank', () =>
    worldTex(14, 5, 7, 2.5, (ctx) => {
      ctx.fillStyle = '#6b4424'
      ctx.fillRect(-7, -2.5, 14, 5)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(-7, 1, 14, 1.5)
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(-7, -2.5, 14, 1)
    }),
  )
}

export function cannonballTex(): Tex {
  return cached('ball', () =>
    worldTex(
      16,
      16,
      8,
      8,
      (ctx) => {
        const g = ctx.createRadialGradient(-2.5, -2.5, 0.5, 0, 0, 8)
        g.addColorStop(0, '#8a8f99')
        g.addColorStop(0.35, '#3a3d44')
        g.addColorStop(1, '#101114')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, 7.5, 0, Math.PI * 2)
        ctx.fill()
      },
      4,
    ),
  )
}
