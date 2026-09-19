import { Tex, mulberry32, worldTex } from './shared.js'
import { drawPalm, drawBush } from './islandPlants.js'

// ---------------------------------------------------------------------------
// Islas
// ---------------------------------------------------------------------------

export interface IslandCircle {
  dx: number
  dy: number
  r: number
}

function circlesPath(
  ctx: CanvasRenderingContext2D,
  circles: IslandCircle[],
  grow: number,
  roughness = 1.6,
): void {
  ctx.beginPath()
  for (const c of circles) {
    const points: { x: number; y: number }[] = []
    const phase = c.dx * 0.053 + c.dy * 0.041
    for (let i = 0; i < 64; i++) {
      const a = (i * Math.PI * 2) / 64
      // Variación pequeña sobre el borde físico; nunca convierte una playa en un obstáculo invisible.
      const ripple = Math.sin(a * 5 + phase) * 0.55 + Math.sin(a * 11 - phase) * 0.3
      const r = Math.max(1, c.r + grow + ripple * roughness)
      points.push({ x: c.dx + Math.cos(a) * r, y: c.dy + Math.sin(a) * r })
    }
    const last = points.at(-1)!
    ctx.moveTo((last.x + points[0].x) / 2, (last.y + points[0].y) / 2)
    points.forEach((p, i) => {
      const next = points[(i + 1) % points.length]
      ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2)
    })
    ctx.closePath()
  }
}

function drawRock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rnd: () => number,
): void {
  const pts = 6
  const vertices: { x: number; y: number }[] = []
  ctx.fillStyle = 'rgba(30,47,37,0.22)'
  ctx.beginPath()
  ctx.ellipse(x + size * 0.35, y + size * 0.45, size, size * 0.78, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2
    const r = size * (0.7 + rnd() * 0.5)
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r * 0.8
    vertices.push({ x: px, y: py })
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  const g = ctx.createLinearGradient(x - size, y - size, x + size, y + size)
  g.addColorStop(0, '#d3ceae')
  g.addColorStop(1, '#727b6d')
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(40,38,34,0.5)'
  ctx.lineWidth = 1
  ctx.stroke()
  const peak = { x: x - size * 0.22, y: y - size * 0.3 }
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]
    const b = vertices[(i + 1) % vertices.length]
    ctx.beginPath()
    ctx.moveTo(peak.x, peak.y)
    ctx.lineTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.closePath()
    ctx.fillStyle = i < 3 ? 'rgba(43,61,51,0.15)' : 'rgba(255,249,220,0.22)'
    ctx.fill()
  }
}

export function islandTex(circles: IslandCircle[], seed: number): Tex {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of circles) {
    minX = Math.min(minX, c.dx - c.r)
    minY = Math.min(minY, c.dy - c.r)
    maxX = Math.max(maxX, c.dx + c.r)
    maxY = Math.max(maxY, c.dy + c.r)
  }
  const margin = 90
  const w = maxX - minX + margin * 2
  const h = maxY - minY + margin * 2
  const ox = -minX + margin
  const oy = -minY + margin
  const rnd = mulberry32(seed)

  return worldTex(w, h, ox, oy, (ctx) => {
    // Aguas someras: una transición amplia que deja ver el fondo bajo el oleaje.
    for (let g = 84; g >= 16; g -= 4) {
      circlesPath(ctx, circles, g)
      ctx.fillStyle = `rgba(68, 181, 175, ${0.013 + (84 - g) * 0.00045})`
      ctx.fill()
    }
    // Manchas de arena y arrecife sumergido; siempre antes del terreno sólido.
    for (let i = 0; i < circles.length * 16; i++) {
      const c = circles[Math.floor(rnd() * circles.length)]
      const a = rnd() * Math.PI * 2
      const radius = c.r + 12 + rnd() * 28
      const x = c.dx + Math.cos(a) * radius
      const y = c.dy + Math.sin(a) * radius
      ctx.beginPath()
      ctx.ellipse(x, y, 2 + rnd() * 6, 1.5 + rnd() * 3, a, 0, Math.PI * 2)
      ctx.fillStyle = i % 3 ? 'rgba(17,92,96,0.15)' : 'rgba(195,216,162,0.13)'
      ctx.fill()
    }
    // Arrecife / fondo arenoso visible
    circlesPath(ctx, circles, 13)
    ctx.fillStyle = 'rgba(164, 214, 183, 0.24)'
    ctx.fill()
    // Espuma de rompiente
    circlesPath(ctx, circles, 6)
    ctx.fillStyle = 'rgba(229, 248, 231, 0.24)'
    ctx.fill()
    circlesPath(ctx, circles, 3)
    ctx.fillStyle = 'rgba(245, 252, 232, 0.5)'
    ctx.fill()
    // Arena mojada
    circlesPath(ctx, circles, 1)
    ctx.fillStyle = '#b6a272'
    ctx.fill()

    // Arena seca, con relieve
    ctx.save()
    circlesPath(ctx, circles, -5)
    ctx.clip()
    const sand = ctx.createLinearGradient(minX, minY, maxX, maxY)
    sand.addColorStop(0, '#f1dfab')
    sand.addColorStop(0.5, '#e4cc94')
    sand.addColorStop(1, '#c7ac78')
    ctx.fillStyle = sand
    ctx.fillRect(minX - 20, minY - 20, maxX - minX + 40, maxY - minY + 40)
    for (let i = 0; i < 260; i++) {
      const x = minX + rnd() * (maxX - minX)
      const y = minY + rnd() * (maxY - minY)
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(160,120,60,0.18)' : 'rgba(255,250,220,0.25)'
      ctx.fillRect(x, y, 1.4, 1.4)
    }

    // Pequeñas dunas, conchas y guijarros; evitamos trazar círculos interiores sobre las playas.
    for (let i = 0; i < circles.length * 14; i++) {
      const c = circles[Math.floor(rnd() * circles.length)]
      const a = rnd() * Math.PI * 2
      const x = c.dx + Math.cos(a) * c.r * (0.74 + rnd() * 0.17)
      const y = c.dy + Math.sin(a) * c.r * (0.74 + rnd() * 0.17)
      ctx.beginPath()
      ctx.ellipse(x, y, 1.1 + rnd(), 0.65, a, 0, Math.PI * 2)
      ctx.fillStyle = i % 4 ? 'rgba(255,248,218,0.6)' : 'rgba(141,116,77,0.35)'
      ctx.fill()
    }

    // Vegetación en el interior
    const inner = circles
      .map((c) => ({ dx: c.dx * 0.9, dy: c.dy * 0.9, r: c.r * 0.62 }))
      .filter((c) => c.r > 18)
    if (inner.length > 0) {
      // Borde de hierba irregular: matas pequeñas asomando sobre la arena
      for (let i = 0; i < inner.length * 26; i++) {
        const c = inner[Math.floor(rnd() * inner.length)]
        const a = rnd() * Math.PI * 2
        const x = c.dx + Math.cos(a) * (c.r + 1)
        const y = c.dy + Math.sin(a) * (c.r + 1)
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(95,150,60,0.8)' : 'rgba(70,125,48,0.8)'
        ctx.beginPath()
        ctx.arc(x, y, 2.5 + rnd() * 4, 0, Math.PI * 2)
        ctx.fill()
      }
      circlesPath(ctx, inner, 8, 5)
      ctx.fillStyle = 'rgba(159,162,86,0.35)'
      ctx.fill()
      circlesPath(ctx, inner, 0, 5)
      const grass = ctx.createLinearGradient(minX, minY, maxX, maxY)
      grass.addColorStop(0, '#90ad5b')
      grass.addColorStop(0.5, '#66904e')
      grass.addColorStop(1, '#44754b')
      ctx.fillStyle = grass
      ctx.fill()
      ctx.save()
      circlesPath(ctx, inner, 0, 5)
      ctx.clip()
      for (let i = 0; i < 40; i++) {
        const c = inner[Math.floor(rnd() * inner.length)]
        const x = c.dx + (rnd() - 0.5) * c.r * 1.6
        const y = c.dy + (rnd() - 0.5) * c.r * 1.6
        const r = 6 + rnd() * 16
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, rnd() < 0.5 ? 'rgba(30,80,30,0.45)' : 'rgba(150,200,90,0.35)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
      }

      // Colina rocosa en las islas grandes
      const innerArea = inner.reduce((s, c) => s + c.r * c.r, 0)
      if (innerArea > 7500) {
        const top = [...inner].sort((a, b) => b.r - a.r)[0]
        const hx = top.dx + (rnd() - 0.5) * top.r * 0.3
        const hy = top.dy + (rnd() - 0.5) * top.r * 0.3
        const hr = top.r * 0.62
        const hill = ctx.createRadialGradient(hx - hr * 0.2, hy - hr * 0.2, 0, hx, hy, hr)
        hill.addColorStop(0, 'rgba(188,174,117,0.65)')
        hill.addColorStop(0.55, 'rgba(126,144,82,0.45)')
        hill.addColorStop(1, 'rgba(81,127,66,0)')
        ctx.fillStyle = hill
        ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2)
        for (let i = 0; i < 8; i++)
          drawRock(ctx, hx + (rnd() - 0.5) * hr, hy + (rnd() - 0.5) * hr * 0.7, 4 + rnd() * 9, rnd)
      }

      // Dosel de arbustos con volumen (luz arriba-izquierda)
      const bushes = Math.min(105, Math.round(innerArea / 350))
      for (let i = 0; i < bushes; i++) {
        const c = inner[Math.floor(rnd() * inner.length)]
        const a = rnd() * Math.PI * 2
        const d = Math.sqrt(rnd()) * c.r * 0.95
        drawBush(ctx, c.dx + Math.cos(a) * d, c.dy + Math.sin(a) * d, 4.5 + rnd() * 6, rnd)
      }
      ctx.restore()
    }
    ctx.restore()

    // Rocas en la orilla
    for (let i = 0; i < 4 + Math.floor(rnd() * 5); i++) {
      const c = circles[Math.floor(rnd() * circles.length)]
      const a = rnd() * Math.PI * 2
      drawRock(ctx, c.dx + Math.cos(a) * (c.r - 4), c.dy + Math.sin(a) * (c.r - 4), 3 + rnd() * 5, rnd)
    }

    // Centro geométrico de la isla, para orientar muelle y pecio hacia fuera
    const gx = circles.reduce((s, c) => s + c.dx, 0) / circles.length
    const gy = circles.reduce((s, c) => s + c.dy, 0) / circles.length
    const outward = (): { x: number; y: number; a: number } => {
      const c = circles[Math.floor(rnd() * circles.length)]
      let a = Math.atan2(c.dy - gy, c.dx - gx)
      if (Math.hypot(c.dx - gx, c.dy - gy) < 1) a = rnd() * Math.PI * 2
      a += (rnd() - 0.5) * 0.8
      return { x: c.dx + Math.cos(a) * c.r, y: c.dy + Math.sin(a) * c.r, a }
    }

    // Muelle de madera en algunas islas
    if (seed % 3 === 0) {
      const p = outward()
      drawDock(ctx, p.x, p.y, p.a, rnd)
    }
    // Pecio medio enterrado en la arena
    if (seed % 4 === 1) {
      const p = outward()
      drawWreck(
        ctx,
        p.x - Math.cos(p.a) * 14,
        p.y - Math.sin(p.a) * 14,
        p.a + Math.PI / 2 + (rnd() - 0.5),
        rnd,
      )
    }

    // Palmeras: más cuanto mayor es la isla
    const area = circles.reduce((s, c) => s + c.r * c.r, 0)
    const palms = inner.length > 0 ? Math.min(14, 2 + Math.round(area / 7000 + rnd() * 3)) : 1
    const src = inner.length > 0 ? inner : circles.map((c) => ({ ...c, r: c.r * 0.5 }))
    const palmPositions: { x: number; y: number; size: number }[] = []
    for (let attempt = 0; attempt < palms * 10 && palmPositions.length < palms; attempt++) {
      const c = src[Math.floor(rnd() * src.length)]
      const a = rnd() * Math.PI * 2
      const d = Math.sqrt(rnd()) * c.r * 0.85
      const x = c.dx + Math.cos(a) * d
      const y = c.dy + Math.sin(a) * d
      if (palmPositions.some((p) => Math.hypot(p.x - x, p.y - y) < 25)) continue
      palmPositions.push({ x, y, size: 18 + rnd() * 11 })
    }
    for (const palm of palmPositions.sort((a, b) => a.y - b.y)) {
      drawPalm(ctx, palm.x, palm.y, palm.size, rnd)
    }
  })
}

function drawDock(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, rnd: () => number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(a)
  const len = 34
  ctx.fillStyle = 'rgba(0,20,30,0.3)'
  ctx.fillRect(-8 + 3, -6 + 4, len + 8, 12)
  for (let i = 0; i < 9; i++) {
    const px = -8 + i * ((len + 8) / 9)
    const width = (len + 8) / 9 - 0.6
    const end = 6 - rnd() * 0.6
    ctx.fillStyle = i % 2 ? '#9b7749' : '#b18a54'
    ctx.fillRect(px, -6, width, end + 6)
    ctx.fillStyle = 'rgba(245,221,164,0.3)'
    ctx.fillRect(px, -6, 0.6, end + 6)
    ctx.fillStyle = 'rgba(63,47,30,0.3)'
    ctx.fillRect(px + width * 0.55, -4 + rnd() * 2, 0.4, 5 + rnd() * 3)
    for (const py of [-4.5, 4.5]) {
      ctx.fillStyle = '#58452f'
      ctx.fillRect(px + width * 0.5, py, 0.7, 0.7)
    }
  }
  // Una cuerda baja y los extremos claros de los pilotes ayudan a leer el muelle sobre el agua.
  ctx.strokeStyle = '#bdb18a'
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(4, -7)
  ctx.quadraticCurveTo(11, -5, 18, -7)
  ctx.quadraticCurveTo(25, -5, len - 1, -7)
  ctx.stroke()
  for (const px of [4, 18, len - 1]) {
    for (const py of [-7, 7]) {
      ctx.beginPath()
      ctx.arc(px + 0.5, py + 0.6, 2, 0, Math.PI * 2)
      ctx.fillStyle = '#624329'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(px, py, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = '#cfad73'
      ctx.fill()
    }
  }
  // Barriles y una caja en tierra
  for (const [bx, by] of [
    [-12, -9],
    [-14, -2],
  ]) {
    ctx.beginPath()
    ctx.arc(bx + 1, by + 1.5, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(67,54,31,0.3)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(bx, by, 3.2, 0, Math.PI * 2)
    ctx.fillStyle = '#a8844c'
    ctx.fill()
    ctx.strokeStyle = '#5d513a'
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(bx - 2.5, by - 0.6)
    ctx.lineTo(bx + 2.5, by - 0.6)
    ctx.stroke()
  }
  const boxY = 4 + rnd() * 2
  ctx.fillStyle = '#b5925b'
  ctx.fillRect(-19, boxY, 7, 7)
  ctx.strokeStyle = '#745832'
  ctx.lineWidth = 0.8
  ctx.strokeRect(-19, boxY, 7, 7)
  ctx.beginPath()
  ctx.moveTo(-18, boxY + 1)
  ctx.lineTo(-13, boxY + 6)
  ctx.moveTo(-18, boxY + 6)
  ctx.lineTo(-13, boxY + 1)
  ctx.stroke()
  ctx.restore()
}

function drawWreck(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, rnd: () => number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(a)
  const L = 26
  const W = 10
  ctx.fillStyle = 'rgba(80,55,20,0.3)'
  ctx.beginPath()
  ctx.ellipse(2, 3, L * 0.62, W * 0.8, 0, 0, Math.PI * 2)
  ctx.fill()
  const wood = ctx.createLinearGradient(0, -W, 0, W)
  wood.addColorStop(0, '#a89062')
  wood.addColorStop(1, '#5e4c31')
  ctx.fillStyle = wood
  ctx.beginPath()
  ctx.moveTo(-L / 2, 0)
  ctx.quadraticCurveTo(-L / 4, -W, L / 2, -W * 0.3)
  ctx.lineTo(L / 2 - 4, 0)
  ctx.quadraticCurveTo(-L / 4, W * 0.5, -L / 2, 0)
  ctx.fill()
  ctx.strokeStyle = '#c1ac7e'
  ctx.lineWidth = 0.75
  ctx.beginPath()
  ctx.moveTo(-L / 2 + 1, -0.5)
  ctx.quadraticCurveTo(-L / 4, -W + 1, L / 2 - 1, -W * 0.3)
  ctx.stroke()
  // Cuadernas al aire
  ctx.strokeStyle = '#493921'
  ctx.lineWidth = 1.4
  for (let i = 0; i < 5; i++) {
    const px = -L / 2 + 5 + i * 4.5
    ctx.beginPath()
    ctx.moveTo(px, -W * 0.6 + rnd())
    ctx.quadraticCurveTo(px + 1, W * 0.4, px + 2, W * 0.8)
    ctx.stroke()
  }
  // Tabla desprendida y resto de lona junto al mástil.
  ctx.fillStyle = '#b6a783'
  ctx.beginPath()
  ctx.moveTo(-5, 3)
  ctx.lineTo(-13, 10)
  ctx.lineTo(-3, 8)
  ctx.lineTo(-6, 6)
  ctx.fill()
  ctx.fillStyle = '#9a7d50'
  ctx.fillRect(6, 7, 8, 1.6)
  // Mástil caído
  ctx.strokeStyle = '#6e4a24'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-2, -2)
  ctx.lineTo(-18, 12)
  ctx.stroke()
  ctx.restore()
}

/** Anillo de espuma con la forma de una isla, para la rompiente animada. */
export function shoreFoamTex(circles: IslandCircle[]): Tex {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of circles) {
    minX = Math.min(minX, c.dx - c.r)
    minY = Math.min(minY, c.dy - c.r)
    maxX = Math.max(maxX, c.dx + c.r)
    maxY = Math.max(maxY, c.dy + c.r)
  }
  const margin = 40
  const w = maxX - minX + margin * 2
  const h = maxY - minY + margin * 2
  return worldTex(
    w,
    h,
    -minX + margin,
    -minY + margin,
    (ctx) => {
      circlesPath(ctx, circles, 15)
      ctx.fillStyle = 'rgba(235,255,247,0.38)'
      ctx.fill()
      ctx.globalCompositeOperation = 'destination-out'
      circlesPath(ctx, circles, 12.5)
      ctx.fillStyle = '#000'
      ctx.fill()
      // Pequeños cortes rompen el contorno uniforme y dejan pasar el color del mar.
      const rnd = mulberry32(Math.round(circles[0].r * 97))
      for (const circle of circles) {
        for (let i = 0; i < 18; i++) {
          const a = rnd() * Math.PI * 2
          ctx.beginPath()
          ctx.arc(
            circle.dx + Math.cos(a) * (circle.r + 14),
            circle.dy + Math.sin(a) * (circle.r + 14),
            2 + rnd() * 4,
            0,
            Math.PI * 2,
          )
          ctx.fill()
        }
      }
      ctx.globalCompositeOperation = 'source-over'
    },
    1,
  )
}
