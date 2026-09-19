import { Tex, cached, canvas, mulberry32 } from './shared.js'
import { Texture } from 'pixi.js'

// ---------------------------------------------------------------------------
// Océano
// ---------------------------------------------------------------------------

export function wrapped(
  ctx: CanvasRenderingContext2D,
  size: number,
  x: number,
  y: number,
  draw: (x: number, y: number) => void,
): void {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(x + dx, y + dy)
}

export function waterBaseTex(): Tex {
  return cached('waterBase', () => {
    const size = 1024
    const [c, ctx] = canvas(size, size)
    ctx.fillStyle = '#0c425b'
    ctx.fillRect(0, 0, size, size)
    const rnd = mulberry32(1234)
    // Manchas grandes y suaves de profundidad: variación de tono sin ruido visual
    for (let i = 0; i < 46; i++) {
      const x = rnd() * size
      const y = rnd() * size
      const r = 140 + rnd() * 260
      const light = rnd() < 0.45
      wrapped(ctx, size, x, y, (px, py) => {
        const g = ctx.createRadialGradient(px, py, 0, px, py, r)
        g.addColorStop(0, light ? 'rgba(46,143,153,0.16)' : 'rgba(3,26,44,0.14)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(px - r, py - r, r * 2, r * 2)
      })
    }
    return { texture: Texture.from(c), scale: 1, ax: 0, ay: 0 }
  })
}

/**
 * variant 0: mar de fondo (ondas largas muy suaves que cruzan el mosaico).
 * variant 1: pocas crestas de espuma y brillos pequeños.
 */
export function waterWavesTex(variant: number): Tex {
  return cached(`waterWaves${variant}`, () => {
    const size = 512
    const [c, ctx] = canvas(size, size)
    const rnd = mulberry32(99 + variant * 31)
    ctx.lineCap = 'round'
    if (variant === 0) {
      for (let i = 0; i < 11; i++) {
        const y0 = rnd() * size
        const k = 1 + Math.floor(rnd() * 3)
        const amp = 6 + rnd() * 14
        const phase = rnd() * Math.PI * 2
        // Tramos de cresta: el patrón suma 256 para repetirse exacto dentro del mosaico
        const seg1 = 50 + rnd() * 70
        const gap1 = 30 + rnd() * 40
        const seg2 = 30 + rnd() * 40
        const dash = [seg1, gap1, seg2, 256 - seg1 - gap1 - seg2]
        const dashOffset = rnd() * 256
        for (const dy of [-size, 0, size]) {
          ctx.setLineDash(dash)
          ctx.lineDashOffset = dashOffset
          // Falso desenfoque: trazos concéntricos cada vez más finos y opacos
          for (const [w, a] of [
            [14, 0.014],
            [8, 0.02],
            [3.5, 0.034],
          ] as const) {
            ctx.strokeStyle = `rgba(150,215,235,${a})`
            ctx.lineWidth = w
            ctx.beginPath()
            for (let x = 0; x <= size; x += 8) {
              const y = y0 + dy + Math.sin((x / size) * Math.PI * 2 * k + phase) * amp
              if (x === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.stroke()
          }
        }
      }
      ctx.setLineDash([])
    } else {
      for (let i = 0; i < 26; i++) {
        const x = rnd() * size
        const y = rnd() * size
        const len = 7 + rnd() * 14
        const bend = 1.5 + rnd() * 3
        const alpha = 0.1 + rnd() * 0.16
        wrapped(ctx, size, x, y, (px, py) => {
          ctx.strokeStyle = `rgba(215,244,255,${alpha})`
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.moveTo(px - len / 2, py)
          ctx.quadraticCurveTo(px, py - bend, px + len / 2, py)
          ctx.stroke()
          ctx.strokeStyle = `rgba(215,244,255,${alpha * 0.4})`
          ctx.lineWidth = 3
          ctx.stroke()
        })
      }
    }
    return { texture: Texture.from(c), scale: 1, ax: 0, ay: 0 }
  })
}

export function vignetteTex(): Tex {
  return cached('vignette', () => {
    const [c, ctx] = canvas(512, 512)
    const g = ctx.createRadialGradient(256, 256, 150, 256, 256, 362)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,8,14,0.58)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 512)
    return { texture: Texture.from(c), scale: 1, ax: 0, ay: 0 }
  })
}

export function damageVignetteTex(): Tex {
  return cached('dmgVignette', () => {
    const [c, ctx] = canvas(512, 512)
    const g = ctx.createRadialGradient(256, 256, 140, 256, 256, 362)
    g.addColorStop(0, 'rgba(255,0,0,0)')
    g.addColorStop(1, 'rgba(200,20,20,0.85)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 512)
    return { texture: Texture.from(c), scale: 1, ax: 0, ay: 0 }
  })
}
