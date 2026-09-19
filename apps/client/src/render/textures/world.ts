import { Tex, cached, worldTex, mulberry32, hex, canvas } from './shared.js'
import { wrapped } from './water.js'
import { Texture } from 'pixi.js'

export function whirlpoolTex(radius: number): Tex {
  return cached(`whirl:${Math.round(radius)}`, () =>
    worldTex(
      radius * 2 + 20,
      radius * 2 + 20,
      radius + 10,
      radius + 10,
      (ctx) => {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
        g.addColorStop(0, 'rgba(1,12,20,0.95)')
        g.addColorStop(0.25, 'rgba(3,30,48,0.75)')
        g.addColorStop(0.7, 'rgba(8,60,86,0.25)')
        g.addColorStop(1, 'rgba(10,70,100,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, radius, 0, Math.PI * 2)
        ctx.fill()
        // Bandas de agua oscura y clara que se enroscan (dan volumen al embudo)
        const arms = 7
        for (let a = 0; a < arms; a++) {
          const base = (a / arms) * Math.PI * 2
          for (let t = 0; t < 1; t += 0.004) {
            const rr = radius * (0.1 + 0.9 * t)
            const ang = base + t * 4.6
            const w = 1.5 + t * radius * 0.07
            const fade = Math.sin(Math.PI * Math.min(1, t * 1.15))
            ctx.fillStyle = `rgba(0,18,30,${0.06 * fade})`
            ctx.beginPath()
            ctx.arc(Math.cos(ang + 0.18) * rr, Math.sin(ang + 0.18) * rr, w * 1.3, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = `rgba(200,240,255,${0.035 * fade})`
            ctx.beginPath()
            ctx.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, w, 0, Math.PI * 2)
            ctx.fill()
          }
          // Cresta de espuma sobre cada banda
          ctx.beginPath()
          for (let t = 0.05; t <= 0.95; t += 0.02) {
            const rr = radius * (0.1 + 0.9 * t)
            const ang = base + t * 4.6
            if (t <= 0.05) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr)
            else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr)
          }
          ctx.strokeStyle = 'rgba(235,250,255,0.32)'
          ctx.lineWidth = 1.6
          ctx.stroke()
        }
        // Anillo de espuma en el borde, discontinuo
        const rnd = mulberry32(Math.round(radius))
        for (let i = 0; i < 26; i++) {
          const a0 = rnd() * Math.PI * 2
          ctx.strokeStyle = `rgba(230,248,255,${0.12 + rnd() * 0.18})`
          ctx.lineWidth = 2 + rnd() * 3
          ctx.beginPath()
          ctx.arc(0, 0, radius * (0.86 + rnd() * 0.1), a0, a0 + 0.2 + rnd() * 0.5)
          ctx.stroke()
        }
        // Ojo del remolino
        const eye = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.22)
        eye.addColorStop(0, 'rgba(0,4,8,0.95)')
        eye.addColorStop(1, 'rgba(0,10,18,0)')
        ctx.fillStyle = eye
        ctx.beginPath()
        ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2)
        ctx.fill()
      },
      1,
    ),
  )
}

/** Contorno de fortaleza en estrella: pentágono con baluartes en punta en cada vértice. */
function starFortPath(ctx: CanvasRenderingContext2D, R: number, inset = 0): void {
  const n = 5
  const r = R - inset
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2
    const aPrev = a - Math.PI / n
    const aNext = a + Math.PI / n
    const neck = r * 0.62
    const flank = 0.2
    // Cortina (entre baluartes) -> flanco -> punta del baluarte -> flanco
    const p1 = [Math.cos(aPrev + flank) * neck, Math.sin(aPrev + flank) * neck]
    const p2 = [Math.cos(a - 0.34) * r * 0.78, Math.sin(a - 0.34) * r * 0.78]
    const tip = [Math.cos(a) * r, Math.sin(a) * r]
    const p3 = [Math.cos(a + 0.34) * r * 0.78, Math.sin(a + 0.34) * r * 0.78]
    const p4 = [Math.cos(aNext - flank) * neck, Math.sin(aNext - flank) * neck]
    if (i === 0) ctx.moveTo(p1[0], p1[1])
    else ctx.lineTo(p1[0], p1[1])
    ctx.lineTo(p2[0], p2[1])
    ctx.lineTo(tip[0], tip[1])
    ctx.lineTo(p3[0], p3[1])
    ctx.lineTo(p4[0], p4[1])
  }
  ctx.closePath()
}

export function fortTex(ruined = false): Tex {
  return cached(`fort:${ruined}`, () =>
    worldTex(
      124,
      124,
      62,
      62,
      (ctx) => {
        const R = 46
        const rnd = mulberry32(ruined ? 91 : 90)

        // Cimientos de roca con espuma al pie
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        starFortPath(ctx, R + 9)
        ctx.fill()
        const rock = ctx.createRadialGradient(-8, -10, 6, 0, 0, R + 6)
        rock.addColorStop(0, '#8b8578')
        rock.addColorStop(1, '#4d4940')
        ctx.fillStyle = rock
        starFortPath(ctx, R + 5)
        ctx.fill()

        // Sombra de los muros
        ctx.save()
        ctx.translate(3, 4)
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        starFortPath(ctx, R)
        ctx.fill()
        ctx.restore()

        // Muralla de sillería
        const wall = ctx.createLinearGradient(-R, -R, R, R)
        wall.addColorStop(0, ruined ? '#8a857a' : '#d8cfb8')
        wall.addColorStop(1, ruined ? '#4f4b44' : '#8f866f')
        ctx.fillStyle = wall
        starFortPath(ctx, R)
        ctx.fill()
        ctx.save()
        starFortPath(ctx, R)
        ctx.clip()
        ctx.strokeStyle = 'rgba(60,52,40,0.35)'
        ctx.lineWidth = 0.6
        for (let y = -R; y < R; y += 4) {
          ctx.beginPath()
          ctx.moveTo(-R, y)
          ctx.lineTo(R, y)
          ctx.stroke()
          for (let x = -R + ((y / 4) % 2 ? 0 : 3.5); x < R; x += 7) {
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.lineTo(x, y + 4)
            ctx.stroke()
          }
        }
        ctx.restore()
        ctx.strokeStyle = '#3a342a'
        ctx.lineWidth = 1.4
        starFortPath(ctx, R)
        ctx.stroke()

        // Adarve (camino de ronda) y patio interior
        ctx.fillStyle = ruined ? '#6d675c' : '#b9ae94'
        starFortPath(ctx, R, 7)
        ctx.fill()
        const yard = ctx.createRadialGradient(-6, -6, 3, 0, 0, R * 0.6)
        yard.addColorStop(0, ruined ? '#4a3f33' : '#b89468')
        yard.addColorStop(1, ruined ? '#2e2620' : '#8a6a42')
        ctx.fillStyle = yard
        starFortPath(ctx, R, 11)
        ctx.fill()

        // Almenas a lo largo del borde exterior
        ctx.save()
        starFortPath(ctx, R)
        ctx.clip()
        ctx.setLineDash([3, 3])
        ctx.strokeStyle = ruined ? 'rgba(40,36,30,0.6)' : 'rgba(250,244,225,0.8)'
        ctx.lineWidth = 2.4
        starFortPath(ctx, R, 1.8)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()

        if (!ruined) {
          // Barriles, cajas y balas apiladas en el patio
          for (const [x, y] of [
            [-20, 8],
            [-17, 12],
            [18, 10],
          ]) {
            ctx.fillStyle = '#6e4520'
            ctx.beginPath()
            ctx.arc(x, y, 3, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#2e1c0e'
            ctx.lineWidth = 0.7
            ctx.stroke()
            ctx.strokeStyle = '#b89448'
            ctx.beginPath()
            ctx.arc(x, y, 2, 0, Math.PI * 2)
            ctx.stroke()
          }
          ctx.fillStyle = '#9a7040'
          ctx.fillRect(12, -20, 7, 6)
          ctx.strokeStyle = '#4a2f16'
          ctx.strokeRect(12, -20, 7, 6)
          ctx.fillStyle = '#25272c'
          for (const [x, y] of [
            [-14, -16],
            [-11, -17],
            [-12.5, -13.5],
            [4, 20],
            [7, 20],
            [5.5, 17.5],
          ]) {
            ctx.beginPath()
            ctx.arc(x, y, 1.9, 0, Math.PI * 2)
            ctx.fill()
          }
        } else {
          // Escombros y marcas de quemado
          for (let i = 0; i < 14; i++) {
            const a = rnd() * Math.PI * 2
            const d = rnd() * R * 0.8
            ctx.fillStyle = rnd() < 0.5 ? '#6f695e' : '#8d877a'
            ctx.save()
            ctx.translate(Math.cos(a) * d, Math.sin(a) * d)
            ctx.rotate(rnd() * 3)
            ctx.fillRect(-2, -1.5, 3 + rnd() * 4, 2.5 + rnd() * 2)
            ctx.restore()
          }
          for (let i = 0; i < 4; i++) {
            const x = (rnd() - 0.5) * R
            const y = (rnd() - 0.5) * R
            const g = ctx.createRadialGradient(x, y, 0, x, y, 10 + rnd() * 8)
            g.addColorStop(0, 'rgba(10,8,6,0.6)')
            g.addColorStop(1, 'rgba(10,8,6,0)')
            ctx.fillStyle = g
            ctx.fillRect(x - 20, y - 20, 40, 40)
          }
          // Brechas en la muralla
          ctx.globalCompositeOperation = 'destination-out'
          for (let i = 0; i < 3; i++) {
            const a = -Math.PI / 2 + (Math.floor(rnd() * 5) / 5) * Math.PI * 2 + 0.6
            ctx.beginPath()
            ctx.arc(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, 5 + rnd() * 3, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.globalCompositeOperation = 'source-over'
        }

        // Torre central donde va la torreta
        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        ctx.beginPath()
        ctx.arc(2, 3, 15, 0, Math.PI * 2)
        ctx.fill()
        const keep = ctx.createRadialGradient(-5, -5, 2, 0, 0, 15)
        keep.addColorStop(0, ruined ? '#6d675c' : '#e2d9c2')
        keep.addColorStop(1, ruined ? '#3e3a33' : '#8c8470')
        ctx.fillStyle = keep
        ctx.beginPath()
        ctx.arc(0, 0, 14, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#3a342a'
        ctx.lineWidth = 1.2
        ctx.stroke()
        ctx.fillStyle = ruined ? '#2a2520' : '#6a5a44'
        ctx.beginPath()
        ctx.arc(0, 0, 10, 0, Math.PI * 2)
        ctx.fill()
      },
      2.5,
    ),
  )
}

export function flagPoleTex(color: number): Tex {
  return cached(`flagpole:${color}`, () =>
    worldTex(
      30,
      18,
      2,
      12,
      (ctx) => {
        ctx.fillStyle = '#3d2412'
        ctx.fillRect(-1, -2, 2, 10)
        ctx.fillStyle = hex(color)
        ctx.beginPath()
        ctx.moveTo(0, -10)
        ctx.quadraticCurveTo(12, -12, 24, -6)
        ctx.quadraticCurveTo(12, -2, 0, -3)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#f2f2f2'
        ctx.beginPath()
        ctx.arc(9, -6.5, 2, 0, Math.PI * 2)
        ctx.fill()
      },
      3,
    ),
  )
}

export function cloudShadowTex(seed: number): Tex {
  return cached(`cloud:${seed}`, () =>
    worldTex(
      420,
      260,
      210,
      130,
      (ctx) => {
        const rnd = mulberry32(seed)
        for (let i = 0; i < 11; i++) {
          const x = (rnd() - 0.5) * 260
          const y = (rnd() - 0.5) * 120
          const rr = 50 + rnd() * 70
          const g = ctx.createRadialGradient(x, y, 0, x, y, rr)
          g.addColorStop(0, 'rgba(0,10,20,0.16)')
          g.addColorStop(1, 'rgba(0,10,20,0)')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(x, y, rr, 0, Math.PI * 2)
          ctx.fill()
        }
      },
      0.5,
    ),
  )
}

export function gullTex(): Tex {
  return cached('gull', () =>
    worldTex(
      24,
      12,
      12,
      6,
      (ctx) => {
        ctx.strokeStyle = '#f5f7fa'
        ctx.lineWidth = 1.8
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(-10, -1)
        ctx.quadraticCurveTo(-5, -5, 0, 0)
        ctx.quadraticCurveTo(5, -5, 10, -1)
        ctx.stroke()
        ctx.fillStyle = '#f0b040'
        ctx.beginPath()
        ctx.arc(0, 0.5, 1, 0, Math.PI * 2)
        ctx.fill()
      },
      3,
    ),
  )
}

export function gullShadowTex(): Tex {
  return cached('gullShadow', () =>
    worldTex(
      24,
      12,
      12,
      6,
      (ctx) => {
        ctx.strokeStyle = 'rgba(0,15,25,0.3)'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(-10, -1)
        ctx.quadraticCurveTo(-5, -5, 0, 0)
        ctx.quadraticCurveTo(5, -5, 10, -1)
        ctx.stroke()
      },
      2,
    ),
  )
}

export function buoyTex(): Tex {
  return cached('buoy', () =>
    worldTex(
      20,
      20,
      10,
      10,
      (ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        ctx.beginPath()
        ctx.arc(1.5, 2, 6.5, 0, Math.PI * 2)
        ctx.fill()
        const g = ctx.createRadialGradient(-2, -2, 0.5, 0, 0, 6.5)
        g.addColorStop(0, '#ff9a8a')
        g.addColorStop(1, '#a8231a')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, 6.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#f5f5f5'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(0, 0, 4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = '#ffe9a0'
        ctx.beginPath()
        ctx.arc(0, 0, 1.4, 0, Math.PI * 2)
        ctx.fill()
      },
      3,
    ),
  )
}

export function sunGlintTex(): Tex {
  return cached('glint', () => {
    const size = 256
    const [c, ctx] = canvas(size, size)
    const rnd = mulberry32(555)
    for (let i = 0; i < 38; i++) {
      const x = rnd() * size
      const y = rnd() * size
      const len = 3 + rnd() * 7
      wrapped(ctx, size, x, y, (px, py) => {
        const g = ctx.createLinearGradient(px - len, py, px + len, py)
        g.addColorStop(0, 'rgba(255,255,255,0)')
        g.addColorStop(0.5, 'rgba(255,255,240,0.9)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(px - len, py - 0.7, len * 2, 1.4)
      })
    }
    return { texture: Texture.from(c), scale: 1, ax: 0, ay: 0 }
  })
}

// ---------------------------------------------------------------------------
// Remolino por capas: embudo fijo, brazos de espuma que giran y rompiente
// ---------------------------------------------------------------------------

/** Embudo: agua que se oscurece hacia el ojo, con terrazas y una pared iluminada de lado. */
export function whirlFunnelTex(radius: number): Tex {
  return cached(`whirlFunnel:${Math.round(radius)}`, () =>
    worldTex(
      radius * 2 + 20,
      radius * 2 + 20,
      radius + 10,
      radius + 10,
      (ctx) => {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
        g.addColorStop(0, 'rgba(0,6,11,0.98)')
        g.addColorStop(0.14, 'rgba(1,14,24,0.95)')
        g.addColorStop(0.32, 'rgba(3,30,46,0.78)')
        g.addColorStop(0.6, 'rgba(7,55,78,0.42)')
        g.addColorStop(0.85, 'rgba(12,82,108,0.16)')
        g.addColorStop(1, 'rgba(14,90,118,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, radius, 0, Math.PI * 2)
        ctx.fill()
        // Pared del embudo: luz desde arriba-izquierda, sombra abajo-derecha
        for (let k = 0; k < 7; k++) {
          const r = radius * (0.2 + k * 0.11)
          const a = 0.09 * (1 - k / 8)
          const lg = ctx.createLinearGradient(-r, -r, r, r)
          lg.addColorStop(0, `rgba(170,230,250,${a})`)
          lg.addColorStop(0.5, 'rgba(170,230,250,0)')
          lg.addColorStop(1, `rgba(0,8,14,${a * 1.6})`)
          ctx.strokeStyle = lg
          ctx.lineWidth = radius * 0.05
          ctx.beginPath()
          ctx.arc(0, 0, r, 0, Math.PI * 2)
          ctx.stroke()
        }
      },
      1,
    ),
  )
}

/** Brazos de espuma en espiral (fondo transparente). Varias capas giran a distinta velocidad. */
export function whirlArmsTex(radius: number, variant: number): Tex {
  return cached(`whirlArms:${Math.round(radius)}:${variant}`, () =>
    worldTex(
      radius * 2 + 20,
      radius * 2 + 20,
      radius + 10,
      radius + 10,
      (ctx) => {
        const rnd = mulberry32(700 + variant * 13 + Math.round(radius))
        const arms = variant === 2 ? 4 : 6
        const twist = variant === 2 ? 3.2 : 4.4
        ctx.lineCap = 'round'
        for (let a = 0; a < arms; a++) {
          const base = (a / arms) * Math.PI * 2 + rnd() * 0.4
          let t = 0.08
          while (t < 0.98) {
            // Tramos de espuma con huecos: aspecto de agua rota, no de dibujo
            const len = 0.06 + rnd() * 0.12
            const t2 = Math.min(0.98, t + len)
            const mid = (t + t2) / 2
            const alpha = Math.sin(Math.PI * mid) * (0.22 + rnd() * 0.18)
            ctx.strokeStyle = `rgba(225,248,255,${alpha})`
            ctx.lineWidth = 0.8 + mid * radius * 0.035
            ctx.beginPath()
            for (let u = t; u <= t2; u += 0.01) {
              const r = radius * u
              const ang = base + u * twist
              const x = Math.cos(ang) * r
              const y = Math.sin(ang) * r
              if (u === t) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.stroke()
            t = t2 + 0.03 + rnd() * 0.07
          }
        }
      },
      1,
    ),
  )
}

/** Rompiente del borde: arcos de espuma rotos y burbujas. */
export function whirlRimTex(radius: number): Tex {
  return cached(`whirlRim:${Math.round(radius)}`, () =>
    worldTex(
      radius * 2 + 40,
      radius * 2 + 40,
      radius + 20,
      radius + 20,
      (ctx) => {
        const rnd = mulberry32(Math.round(radius) * 7)
        for (let i = 0; i < 34; i++) {
          const a0 = rnd() * Math.PI * 2
          const rr = radius * (0.84 + rnd() * 0.14)
          ctx.strokeStyle = `rgba(235,250,255,${0.12 + rnd() * 0.22})`
          ctx.lineWidth = 1.5 + rnd() * 3.5
          ctx.beginPath()
          ctx.arc(0, 0, rr, a0, a0 + 0.12 + rnd() * 0.45)
          ctx.stroke()
        }
        for (let i = 0; i < 60; i++) {
          const a = rnd() * Math.PI * 2
          const rr = radius * (0.8 + rnd() * 0.2)
          ctx.fillStyle = `rgba(240,252,255,${0.2 + rnd() * 0.35})`
          ctx.beginPath()
          ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 0.8 + rnd() * 1.6, 0, Math.PI * 2)
          ctx.fill()
        }
      },
      1,
    ),
  )
}
