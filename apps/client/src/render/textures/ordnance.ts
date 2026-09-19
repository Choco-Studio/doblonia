import { Tex, cached, worldTex, mulberry32 } from './shared.js'

export function mineTex(armed: boolean, own: boolean): Tex {
  return cached(`mine:${armed}:${own}`, () => {
    const R = 11
    return worldTex(
      40,
      40,
      20,
      20,
      (ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.beginPath()
        ctx.ellipse(2, 3, R + 2, R, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#1d1f22'
        ctx.lineWidth = 2.4
        ctx.lineCap = 'round'
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2
          ctx.beginPath()
          ctx.moveTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8)
          ctx.lineTo(Math.cos(a) * (R + 5), Math.sin(a) * (R + 5))
          ctx.stroke()
          ctx.fillStyle = '#8a8f99'
          ctx.beginPath()
          ctx.arc(Math.cos(a) * (R + 5), Math.sin(a) * (R + 5), 1.3, 0, Math.PI * 2)
          ctx.fill()
        }
        const g = ctx.createRadialGradient(-4, -4, 1, 0, 0, R)
        g.addColorStop(0, '#6d7380')
        g.addColorStop(0.5, '#34373e')
        g.addColorStop(1, '#141518')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, R, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = armed ? (own ? '#6cf0ff' : '#ff3b30') : '#5a3b38'
        ctx.beginPath()
        ctx.arc(0, 0, 2.6, 0, Math.PI * 2)
        ctx.fill()
      },
      3,
    )
  })
}

// ---------------------------------------------------------------------------
// Estela de bala
// ---------------------------------------------------------------------------

export function streakTex(): Tex {
  return cached('streak', () =>
    worldTex(
      64,
      16,
      60,
      8,
      (ctx) => {
        const g = ctx.createLinearGradient(-60, 0, 4, 0)
        g.addColorStop(0, 'rgba(255,255,255,0)')
        g.addColorStop(1, 'rgba(255,255,255,0.9)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.moveTo(-60, 0)
        ctx.lineTo(0, -6)
        ctx.arc(0, 0, 6, -Math.PI / 2, Math.PI / 2)
        ctx.lineTo(-60, 0)
        ctx.fill()
      },
      1,
    ),
  )
}

// ---------------------------------------------------------------------------
// Proyectiles especiales
// ---------------------------------------------------------------------------

export function chainShotTex(): Tex {
  return cached('chainShot', () =>
    worldTex(
      28,
      12,
      14,
      6,
      (ctx) => {
        ctx.strokeStyle = '#6d717a'
        ctx.lineWidth = 1.2
        ctx.setLineDash([1.6, 1.2])
        ctx.beginPath()
        ctx.moveTo(-8, 0)
        ctx.quadraticCurveTo(0, 3, 8, 0)
        ctx.stroke()
        ctx.setLineDash([])
        for (const x of [-8, 8]) {
          const g = ctx.createRadialGradient(x - 1.2, -1.2, 0.3, x, 0, 4)
          g.addColorStop(0, '#8a8f99')
          g.addColorStop(1, '#141518')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(x, 0, 4, 0, Math.PI * 2)
          ctx.fill()
        }
      },
      3,
    ),
  )
}

export function fireballTex(): Tex {
  return cached('fireball', () =>
    worldTex(
      64,
      64,
      32,
      32,
      (ctx) => {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 32)
        g.addColorStop(0, 'rgba(255,255,220,1)')
        g.addColorStop(0.2, 'rgba(255,220,110,0.95)')
        g.addColorStop(0.5, 'rgba(255,120,30,0.6)')
        g.addColorStop(0.8, 'rgba(180,40,10,0.2)')
        g.addColorStop(1, 'rgba(120,20,0,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, 32, 0, Math.PI * 2)
        ctx.fill()
      },
      1,
    ),
  )
}

export function targetMarkerTex(): Tex {
  return cached('target', () =>
    worldTex(
      128,
      128,
      64,
      64,
      (ctx) => {
        ctx.strokeStyle = 'rgba(255,120,80,0.9)'
        ctx.lineWidth = 4
        ctx.setLineDash([10, 7])
        ctx.beginPath()
        ctx.arc(0, 0, 58, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(255,90,60,0.12)'
        ctx.beginPath()
        ctx.arc(0, 0, 58, 0, Math.PI * 2)
        ctx.fill()
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(-14, 0)
        ctx.lineTo(14, 0)
        ctx.moveTo(0, -14)
        ctx.lineTo(0, 14)
        ctx.stroke()
      },
      1,
    ),
  )
}

export function oilTex(): Tex {
  return cached('oil', () =>
    worldTex(
      96,
      96,
      48,
      48,
      (ctx) => {
        const rnd = mulberry32(31)
        for (let i = 0; i < 9; i++) {
          const x = (rnd() - 0.5) * 36
          const y = (rnd() - 0.5) * 36
          const rr = 16 + rnd() * 18
          const g = ctx.createRadialGradient(x, y, 0, x, y, rr)
          g.addColorStop(0, 'rgba(22,16,12,0.85)')
          g.addColorStop(0.7, 'rgba(40,24,14,0.55)')
          g.addColorStop(1, 'rgba(40,24,14,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(x, y, rr, 0, Math.PI * 2)
          ctx.fill()
        }
        // Irisaciones
        ctx.strokeStyle = 'rgba(140,90,200,0.25)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(-6, 4, 20, 0.4, 2.2)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(80,180,160,0.22)'
        ctx.beginPath()
        ctx.arc(8, -6, 16, 3.5, 5.2)
        ctx.stroke()
      },
      1,
    ),
  )
}
