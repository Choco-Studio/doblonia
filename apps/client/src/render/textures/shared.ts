import { Texture } from 'pixi.js'

/**
 * Texturas procedurales dibujadas con Canvas2D (degradados, sombras suaves,
 * detalle de tablones...) y subidas a la GPU como texturas de Pixi.
 * Se dibujan a escala TEX_SCALE y los sprites se reescalan a 1/TEX_SCALE para
 * que se vean nítidas en pantallas de alta densidad y con zoom.
 */
export const TEX_SCALE = 2

export interface Tex {
  texture: Texture
  /** Escala a aplicar al sprite para que 1 unidad de textura = 1 unidad de mundo. */
  scale: number
  /** Punto de anclaje normalizado. */
  ax: number
  ay: number
}

const cache = new Map<string, Tex>()

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = Math.max(2, Math.ceil(w))
  c.height = Math.max(2, Math.ceil(h))
  const ctx = c.getContext('2d')!
  return [c, ctx]
}

export function cached(key: string, make: () => Tex): Tex {
  let t = cache.get(key)
  if (!t) {
    t = make()
    cache.set(key, t)
  }
  return t
}

/** Crea una textura de mundo de tamaño w×h (unidades de mundo) con el origen en (ox, oy). */
export function worldTex(
  w: number,
  h: number,
  ox: number,
  oy: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  scale = TEX_SCALE,
): Tex {
  const [c, ctx] = canvas(w * scale, h * scale)
  ctx.scale(scale, scale)
  ctx.translate(ox, oy)
  draw(ctx)
  return { texture: Texture.from(c), scale: 1 / scale, ax: ox / w, ay: oy / h }
}

export function hex(color: number, alpha = 1): string {
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255
  return `rgba(${r},${g},${b},${alpha})`
}

export function shade(color: number, amount: number): number {
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))))
  return (f(r) << 16) | (f(g) << 8) | f(b)
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Silueta difuminada para sombras proyectadas. */
export function softShadow(
  w: number,
  h: number,
  ox: number,
  oy: number,
  path: (ctx: CanvasRenderingContext2D) => void,
  blur: number,
): Tex {
  const pad = blur * 2
  return worldTex(w + pad * 2, h + pad * 2, ox + pad, oy + pad, (ctx) => {
    ctx.save()
    // Truco universal para desenfocar: se dibuja la forma fuera del lienzo y solo su sombra cae dentro.
    ctx.shadowColor = 'rgba(0,0,0,1)'
    ctx.shadowBlur = blur * TEX_SCALE
    ctx.shadowOffsetX = 4000 * TEX_SCALE
    ctx.translate(-4000, 0)
    ctx.fillStyle = '#000'
    path(ctx)
    ctx.fill()
    ctx.restore()
  })
}
