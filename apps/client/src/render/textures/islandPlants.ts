/** Vegetación pintada en la textura de cada isla; no añade trabajo al bucle de render. */
type Random = () => number

interface Frond {
  angle: number
  length: number
  bend: number
  width: number
  old: boolean
}

function leafPath(ctx: CanvasRenderingContext2D, leaf: Frond): void {
  const { length: l, bend: b, width: w } = leaf
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(l * 0.28, b - w, l * 0.76, b - w * 0.7, l, b * 0.45)
  ctx.bezierCurveTo(l * 0.7, b + w * 0.6, l * 0.25, b + w, 0, 0)
  ctx.closePath()
}

export function drawPalm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rnd: Random,
): void {
  const lean = rnd() * Math.PI * 2
  const cx = x + Math.cos(lean) * size * 0.34
  const cy = y + Math.sin(lean) * size * 0.34 - size * 0.15
  const fronds: Frond[] = []
  const count = 7 + Math.floor(rnd() * 3)
  const phase = rnd() * Math.PI * 2
  for (let i = 0; i < count; i++) {
    fronds.push({
      angle: phase + (i * Math.PI * 2) / count + (rnd() - 0.5) * 0.22,
      length: size * (0.7 + rnd() * 0.4),
      bend: (rnd() - 0.5) * size * 0.4,
      width: size * (0.13 + rnd() * 0.06),
      old: i === 0 && rnd() < 0.35,
    })
  }

  // La sombra conserva la silueta de las hojas y la misma luz noroeste que el resto del mundo.
  ctx.save()
  ctx.translate(cx + size * 0.55, cy + size * 0.75)
  ctx.scale(1.06, 0.8)
  ctx.fillStyle = 'rgba(10,37,29,0.27)'
  for (const leaf of fronds) {
    ctx.save()
    ctx.rotate(leaf.angle)
    leafPath(ctx, leaf)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()

  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(x + (cx - x) * 0.3, y - size * 0.24, cx, cy)
  ctx.strokeStyle = '#594327'
  ctx.lineWidth = size * 0.18
  ctx.stroke()
  ctx.strokeStyle = '#c3a06a'
  ctx.lineWidth = size * 0.095
  ctx.stroke()
  for (let i = 1; i < 6; i++) {
    const t = i / 6
    const px = x + (cx - x) * t
    const py = y + (cy - y) * t - Math.sin(t * Math.PI) * size * 0.08
    ctx.beginPath()
    ctx.moveTo(px - size * 0.06, py)
    ctx.lineTo(px + size * 0.04, py + size * 0.04)
    ctx.strokeStyle = '#79603d'
    ctx.lineWidth = 0.7
    ctx.stroke()
  }

  for (const leaf of fronds) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(leaf.angle)
    const lit = Math.cos(leaf.angle + Math.PI * 0.75) > 0
    const g = ctx.createLinearGradient(0, -leaf.width, 0, leaf.width)
    g.addColorStop(0, leaf.old ? '#aaa15a' : lit ? '#99b953' : '#6f9d46')
    g.addColorStop(0.46, leaf.old ? '#787b36' : '#438342')
    g.addColorStop(1, '#205b3d')
    leafPath(ctx, leaf)
    ctx.fillStyle = g
    ctx.fill()

    // Foliolos: el borde plumoso hace reconocible la palmera incluso a escala de juego.
    for (let i = 1; i <= 7; i++) {
      const t = i / 9
      const px = leaf.length * t
      const py = leaf.bend * Math.sin(t * Math.PI * 0.85)
      const span = leaf.width * Math.sin(t * Math.PI) * 1.28
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(px - leaf.length * 0.13, py)
        ctx.quadraticCurveTo(px, py + side * span * 0.9, px + leaf.length * 0.12, py + side * span)
        ctx.lineTo(px + leaf.length * 0.035, py + side * span * 0.08)
        ctx.closePath()
        ctx.fillStyle = side < 0 ? (lit ? '#86ad50' : '#588d40') : '#33713c'
        ctx.fill()
      }
    }
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(leaf.length * 0.5, leaf.bend, leaf.length, leaf.bend * 0.45)
    ctx.strokeStyle = 'rgba(197,206,116,0.63)'
    ctx.lineWidth = 0.6
    ctx.stroke()
    ctx.restore()
  }
  for (const [dx, dy] of [
    [-1.8, 1.2],
    [1, 2.6],
    [2.4, -0.5],
  ]) {
    ctx.beginPath()
    ctx.arc(cx + dx, cy + dy, size * 0.055, 0, Math.PI * 2)
    ctx.fillStyle = '#674b28'
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(cx - 0.6, cy - 0.8, size * 0.06, 0, Math.PI * 2)
  ctx.fillStyle = '#c1cf70'
  ctx.fill()
}

export function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rnd: Random): void {
  ctx.beginPath()
  ctx.ellipse(x + r * 0.35, y + r * 0.5, r * 1.08, r * 0.82, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(17,45,28,0.25)'
  ctx.fill()
  const warm = rnd() > 0.6
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5
    const px = x + Math.cos(a) * r * 0.42
    const py = y + Math.sin(a) * r * 0.36
    const lobe = r * (0.53 + rnd() * 0.15)
    const light = ctx.createRadialGradient(px - lobe * 0.4, py - lobe * 0.45, 0, px, py, lobe)
    light.addColorStop(0, warm ? '#91ab52' : '#78a45b')
    light.addColorStop(0.55, warm ? '#618947' : '#477f4c')
    light.addColorStop(1, '#2d6240')
    ctx.fillStyle = light
    ctx.beginPath()
    ctx.arc(px, py, lobe, 0, Math.PI * 2)
    ctx.fill()
  }
  if (rnd() < 0.12) {
    ctx.fillStyle = warm ? '#ecd38a' : '#eaa192'
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r, 0.85, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
