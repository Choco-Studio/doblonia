import { CanvasSource, Rectangle, Texture } from 'pixi.js'

const PAGE_SIZE = 1024
const PADDING = 2

/** Agrupa sprites pequeños sin reducir su resolución ni mezclar sus bordes. */
class AtlasPage {
  private canvas = document.createElement('canvas')
  private context: CanvasRenderingContext2D
  private source: CanvasSource
  private x = 0
  private y = 0
  private rowHeight = 0

  constructor() {
    this.canvas.width = this.canvas.height = PAGE_SIZE
    this.context = this.canvas.getContext('2d')!
    this.context.imageSmoothingEnabled = false
    this.source = new CanvasSource({ resource: this.canvas, resolution: 1, transparent: true })
  }

  insert(image: HTMLCanvasElement): Texture | undefined {
    const width = image.width + PADDING * 2
    const height = image.height + PADDING * 2
    const nextRow = this.x + width > PAGE_SIZE
    const x = nextRow ? 0 : this.x
    const y = nextRow ? this.y + this.rowHeight : this.y
    if (y + height > PAGE_SIZE) return undefined

    // Extiende los píxeles del borde como CLAMP_TO_EDGE: el filtrado lineal no
    // toma color de un sprite vecino, incluso con escalas pequeñas o rotación.
    const xs = [
      [0, 1, x, PADDING],
      [0, image.width, x + PADDING, image.width],
      [image.width - 1, 1, x + width - PADDING, PADDING],
    ]
    const ys = [
      [0, 1, y, PADDING],
      [0, image.height, y + PADDING, image.height],
      [image.height - 1, 1, y + height - PADDING, PADDING],
    ]
    for (const [sx, sw, dx, dw] of xs) {
      for (const [sy, sh, dy, dh] of ys) this.context.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
    }
    this.x = x + width
    this.y = y
    this.rowHeight = Math.max(nextRow ? 0 : this.rowHeight, height)
    this.source.update()
    return new Texture({
      source: this.source,
      frame: new Rectangle(x + PADDING, y + PADDING, image.width, image.height),
    })
  }
}

const pages: AtlasPage[] = []

/** Solo para texturas de sprites que comparten la caché durante toda la aplicación. */
export function atlasTexture(texture: Texture): Texture {
  const image = texture.source.resource
  if (!(image instanceof HTMLCanvasElement) || image.width > PAGE_SIZE / 2 || image.height > PAGE_SIZE / 2)
    return texture
  let packed: Texture | undefined
  for (const page of pages) {
    packed = page.insert(image)
    if (packed) break
  }
  if (!packed) {
    const page = new AtlasPage()
    pages.push(page)
    packed = page.insert(image)!
  }
  texture.destroy(true)
  return packed
}
