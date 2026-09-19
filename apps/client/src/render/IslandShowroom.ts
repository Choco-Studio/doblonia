import { Container, Text, TextStyle } from 'pixi.js'
import { Ocean } from './Ocean.js'
import { makeSprite } from './ShipSprite.js'
import { islandTex, shoreFoamTex, type IslandCircle } from './textures.js'

const specimens: { name: string; seed: number; circles: IslandCircle[] }[] = [
  {
    name: 'Cayo · vegetación y playa',
    seed: 8102,
    circles: [
      { dx: -25, dy: 0, r: 82 },
      { dx: 50, dy: 20, r: 55 },
    ],
  },
  {
    name: 'Ensenada · muelle y aguas someras',
    seed: 1203,
    circles: [
      { dx: -65, dy: 10, r: 86 },
      { dx: 45, dy: -30, r: 90 },
      { dx: 92, dy: 65, r: 62 },
    ],
  },
  {
    name: 'Isla grande · roca y dosel',
    seed: 5606,
    circles: [
      { dx: -62, dy: -16, r: 96 },
      { dx: 40, dy: 20, r: 105 },
      { dx: -5, dy: 80, r: 63 },
    ],
  },
  {
    name: 'Bahía · pecio y palmeras',
    seed: 9325,
    circles: [
      { dx: -65, dy: -35, r: 77 },
      { dx: 40, dy: -42, r: 92 },
      { dx: 73, dy: 58, r: 57 },
    ],
  },
]

/** Galería de arte reproducible, disponible solo con ?showroom=islands en desarrollo. */
export class IslandShowroom {
  readonly stage = new Container()
  private ocean = new Ocean()
  private world = new Container()
  private width = 0
  private height = 0

  constructor(w: number, h: number) {
    this.stage.addChild(this.ocean.container, this.world)
    const title = new Text({
      text: 'Archipiélago',
      style: new TextStyle({ fontFamily: 'Pirata One', fontSize: 48, fill: 0xffdf8a }),
      resolution: 2,
    })
    title.anchor.set(0.5, 0)
    title.position.set(640, 24)
    this.world.addChild(title)
    specimens.forEach((island, index) => {
      const x = 320 + (index % 2) * 640
      const y = 260 + Math.floor(index / 2) * 410
      for (const texture of [shoreFoamTex(island.circles), islandTex(island.circles, island.seed)]) {
        const sprite = makeSprite(texture)
        sprite.position.set(x, y)
        this.world.addChild(sprite)
      }
      const label = new Text({
        text: island.name,
        style: new TextStyle({ fontFamily: 'Inter', fontSize: 15, fontWeight: '500', fill: 0xc5dfe2 }),
        resolution: 2,
      })
      label.anchor.set(0.5, 0)
      label.position.set(x, y + 186)
      this.world.addChild(label)
    })
    this.update(0, w, h)
  }

  update(dt: number, w: number, h: number): void {
    if (this.width !== w || this.height !== h) {
      this.width = w
      this.height = h
      this.ocean.resize(w, h)
      const zoom = Math.min(w / 1280, h / 890)
      this.world.scale.set(zoom)
      this.world.position.set((w - 1280 * zoom) / 2, (h - 890 * zoom) / 2)
    }
    this.ocean.update(dt, 0, 0, 1, w, h)
  }
}
