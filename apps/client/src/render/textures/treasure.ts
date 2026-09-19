import { Tex, cachedSprite as cached, worldTex, mulberry32 } from './shared.js'

// ---------------------------------------------------------------------------
// Monedas, gemas, minas
// ---------------------------------------------------------------------------

const COIN_METALS: Record<string, [string, string, string]> = {
  bronze: ['#f0b27a', '#b8733a', '#6b3a17'],
  silver: ['#ffffff', '#c3cad6', '#6c7483'],
  gold: ['#fff3b0', '#f4c430', '#8f6508'],
}

export function coinTex(kind: string): Tex {
  return cached(`coin:${kind}`, () => {
    if (kind === 'ruby' || kind === 'diamond' || kind === 'emerald') return gemTex(kind)
    const [hi, mid, lo] = COIN_METALS[kind] ?? COIN_METALS.gold
    const R = 9
    return worldTex(
      24,
      24,
      12,
      12,
      (ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        ctx.beginPath()
        ctx.ellipse(1.5, 2, R, R * 0.9, 0, 0, Math.PI * 2)
        ctx.fill()
        const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, R)
        g.addColorStop(0, hi)
        g.addColorStop(0.55, mid)
        g.addColorStop(1, lo)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, R, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = lo
        ctx.lineWidth = 1.2
        ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.arc(0, 0, R * 0.68, 0, Math.PI * 2)
        ctx.stroke()
        // Ancla grabada
        ctx.strokeStyle = lo
        ctx.lineWidth = 1.1
        ctx.beginPath()
        ctx.moveTo(0, -4)
        ctx.lineTo(0, 4)
        ctx.moveTo(-2.5, -2)
        ctx.lineTo(2.5, -2)
        ctx.moveTo(-3.5, 2)
        ctx.quadraticCurveTo(0, 5.5, 3.5, 2)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.beginPath()
        ctx.ellipse(-3, -4, 2.5, 1.2, -0.6, 0, Math.PI * 2)
        ctx.fill()
      },
      3,
    )
  })
}

const GEM_COLORS: Record<string, [string, string, string]> = {
  ruby: ['#ff9aa8', '#e0115f', '#6b0628'],
  diamond: ['#ffffff', '#7fd3f4', '#1f6f9a'],
  emerald: ['#b8ffd6', '#2ecc71', '#0b5a2e'],
}

function gemTex(kind: string): Tex {
  const [hi, mid, lo] = GEM_COLORS[kind]
  const R = kind === 'emerald' ? 15 : 11
  const size = R * 2 + 8
  return worldTex(
    size,
    size,
    size / 2,
    size / 2,
    (ctx) => {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.ellipse(2, 3, R * 0.9, R * 0.7, 0, 0, Math.PI * 2)
      ctx.fill()
      const n = kind === 'emerald' ? 8 : 6
      const outer: [number, number][] = []
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2
        outer.push([Math.cos(a) * R, Math.sin(a) * R * (kind === 'emerald' ? 0.8 : 1)])
      }
      const inner = outer.map(([x, y]) => [x * 0.5, y * 0.5 - 1] as [number, number])
      for (let i = 0; i < n; i++) {
        const [x1, y1] = outer[i]
        const [x2, y2] = outer[(i + 1) % n]
        const [ix1, iy1] = inner[i]
        const [ix2, iy2] = inner[(i + 1) % n]
        const light = Math.cos((i / n) * Math.PI * 2 + 2.2) * 0.5 + 0.5
        ctx.fillStyle = light > 0.66 ? hi : light > 0.33 ? mid : lo
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.lineTo(ix2, iy2)
        ctx.lineTo(ix1, iy1)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillStyle = mid
      ctx.beginPath()
      inner.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath()
      ctx.moveTo(inner[0][0], inner[0][1])
      ctx.lineTo(inner[1][0], inner[1][1])
      ctx.lineTo(0, -1)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = lo
      ctx.lineWidth = 0.9
      ctx.beginPath()
      outer.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.closePath()
      ctx.stroke()
    },
    3,
  )
}

// ---------------------------------------------------------------------------
// Mapa: cofres, remolinos, aceite, fuertes, decoración
// ---------------------------------------------------------------------------

export function chestTex(): Tex {
  return cached('chest', () =>
    worldTex(
      60,
      56,
      30,
      30,
      (ctx) => {
        // Sombra en el agua
        ctx.fillStyle = 'rgba(0,18,28,0.35)'
        ctx.beginPath()
        ctx.ellipse(3, 13, 23, 10, 0, 0, Math.PI * 2)
        ctx.fill()

        // Tapa abierta hacia atrás: se ve su cara interior
        const lid = ctx.createLinearGradient(0, -27, 0, -9)
        lid.addColorStop(0, '#6b4220')
        lid.addColorStop(1, '#3a2210')
        ctx.fillStyle = lid
        ctx.beginPath()
        ctx.moveTo(-17, -9)
        ctx.lineTo(-20, -24)
        ctx.quadraticCurveTo(0, -30, 20, -24)
        ctx.lineTo(17, -9)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#24140a'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.lineWidth = 0.7
        for (const x of [-9, 0, 9]) {
          ctx.beginPath()
          ctx.moveTo(x, -10)
          ctx.lineTo(x * 1.12, -26)
          ctx.stroke()
        }
        // Herraje de la tapa
        ctx.fillStyle = '#b8923e'
        ctx.beginPath()
        ctx.moveTo(-19.5, -21)
        ctx.quadraticCurveTo(0, -27, 19.5, -21)
        ctx.lineTo(19, -18.5)
        ctx.quadraticCurveTo(0, -24.5, -19, -18.5)
        ctx.closePath()
        ctx.fill()

        // Boca del cofre, rebosante de oro
        ctx.fillStyle = '#2a170a'
        ctx.fillRect(-17, -10, 34, 6)
        const rndC = mulberry32(777)
        for (let i = 0; i < 30; i++) {
          const x = -15 + rndC() * 30
          const y = -9 - rndC() * 5 + Math.abs(x) * 0.12
          const g = ctx.createRadialGradient(x - 0.8, y - 0.8, 0.2, x, y, 2.6)
          g.addColorStop(0, '#fff6c0')
          g.addColorStop(0.5, '#f4c430')
          g.addColorStop(1, '#8f6508')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.ellipse(x, y, 2.6, 2.1, rndC() * 3, 0, Math.PI * 2)
          ctx.fill()
        }
        // Gemas y perlas entre las monedas
        const gem = (x: number, y: number, c1: string, c2: string, r: number) => {
          const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.1, x, y, r)
          g.addColorStop(0, c1)
          g.addColorStop(1, c2)
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.moveTo(x, y - r)
          ctx.lineTo(x + r, y)
          ctx.lineTo(x, y + r)
          ctx.lineTo(x - r, y)
          ctx.closePath()
          ctx.fill()
        }
        gem(-6, -12, '#ffb3c4', '#b0103e', 2.8)
        gem(7, -11, '#c8f0ff', '#2f86b8', 2.5)
        gem(1, -14, '#b9ffd8', '#1c8c52', 2.2)
        ctx.fillStyle = '#fbf6ec'
        for (const [x, y] of [
          [-11, -9],
          [12, -10],
          [3, -9.5],
        ]) {
          ctx.beginPath()
          ctx.arc(x, y, 1.2, 0, Math.PI * 2)
          ctx.fill()
        }

        // Frente del cofre: tablas de madera
        const body = ctx.createLinearGradient(0, -5, 0, 14)
        body.addColorStop(0, '#b27a40')
        body.addColorStop(0.55, '#8a5a2b')
        body.addColorStop(1, '#5a3818')
        ctx.fillStyle = body
        ctx.beginPath()
        ctx.roundRect(-18, -5, 36, 19, 2.5)
        ctx.fill()
        ctx.strokeStyle = 'rgba(40,22,8,0.55)'
        ctx.lineWidth = 0.7
        for (const y of [1.5, 7.5]) {
          ctx.beginPath()
          ctx.moveTo(-18, y)
          ctx.lineTo(18, y)
          ctx.stroke()
        }
        ctx.strokeStyle = '#24140a'
        ctx.lineWidth = 1.1
        ctx.beginPath()
        ctx.roundRect(-18, -5, 36, 19, 2.5)
        ctx.stroke()
        // Luz en el borde superior
        ctx.fillStyle = 'rgba(255,225,170,0.25)'
        ctx.fillRect(-17, -4.5, 34, 1.4)

        // Bandas de hierro dorado con remaches
        for (const x of [-12, 12]) {
          const band = ctx.createLinearGradient(x - 2, 0, x + 2, 0)
          band.addColorStop(0, '#8a6a22')
          band.addColorStop(0.5, '#f0d27a')
          band.addColorStop(1, '#8a6a22')
          ctx.fillStyle = band
          ctx.fillRect(x - 2, -5, 4, 19)
          ctx.fillStyle = '#5a4212'
          for (const y of [-2, 4, 10]) {
            ctx.beginPath()
            ctx.arc(x, y, 0.7, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        // Cerradura
        ctx.fillStyle = '#e8c86a'
        ctx.beginPath()
        ctx.roundRect(-3.5, -3, 7, 8, 1.5)
        ctx.fill()
        ctx.strokeStyle = '#6b4e14'
        ctx.lineWidth = 0.8
        ctx.stroke()
        ctx.fillStyle = '#2a1a06'
        ctx.beginPath()
        ctx.arc(0, 0, 1.1, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(-0.5, 0, 1, 2.6)
        // Destellos
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        for (const [x, y, s] of [
          [-8, -13, 1.6],
          [10, -15, 1.2],
          [3, -8, 1],
        ]) {
          ctx.beginPath()
          ctx.moveTo(x, y - s * 2)
          ctx.lineTo(x + s * 0.5, y)
          ctx.lineTo(x, y + s * 2)
          ctx.lineTo(x - s * 0.5, y)
          ctx.closePath()
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(x - s * 2, y)
          ctx.lineTo(x, y + s * 0.5)
          ctx.lineTo(x + s * 2, y)
          ctx.lineTo(x, y - s * 0.5)
          ctx.closePath()
          ctx.fill()
        }
      },
      3,
    ),
  )
}
