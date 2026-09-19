import { Container, Text, TextStyle } from 'pixi.js'
import { BRANCHES_BY_SLOT, SHIP_BASE, SKINS, SLOT_ORDER, BOSS_DEFS, type SlotId } from '@doblonia/content'
import { computeDerivedStats } from '@doblonia/sim'
import { Ocean } from './Ocean.js'
import { ShipSprite, type EquipMap } from './ShipSprite.js'
import { paletteFromSkin } from './textures.js'

const label = new TextStyle({
  fontFamily: 'Inter',
  fontSize: 11,
  fontWeight: '700',
  fill: 0xeaf2f6,
  stroke: { color: 0x04121a, width: 3 },
})

/**
 * Sala de exposición (solo desarrollo, `?showroom`): dibuja cada nivel de cada
 * rama de arma en su propio barco, y los tres jefes. Sirve para revisar el
 * arte de un vistazo y para comprobar una variante nueva al añadirla.
 */
export class Showroom {
  readonly stage = new Container()
  private ocean = new Ocean()
  private world = new Container()
  private ships: { sprite: ShipSprite; x: number; y: number; angle: number }[] = []
  private t = 0

  constructor(
    private w: number,
    private h: number,
  ) {
    this.stage.addChild(this.ocean.container, this.world)
    const shadows = new Container()
    const hulls = new Container()
    const texts = new Container()
    this.world.addChild(shadows, hulls, texts)

    const skin = SKINS[0]
    const cellW = 150
    const cellH = 120
    let row = 0
    for (const slot of SLOT_ORDER) {
      for (const branch of BRANCHES_BY_SLOT[slot]) {
        branch.tiers.forEach((tier, col) => {
          const equip: EquipMap = { [slot]: { branchId: branch.id, tierId: tier.id } } as EquipMap
          const d = computeDerivedStats({ statLevels: {}, equip })
          const sprite = new ShipSprite({
            key: 'show',
            radius: SHIP_BASE.radius,
            palette: paletteFromSkin(skin),
            sail: skin.sail,
            emblem: skin.trim,
            flag: skin.trim,
            variant: 'ship',
            masts: 2,
          })
          sprite.setLoadout(equip, d.radius / SHIP_BASE.radius)
          const x = 90 + col * cellW
          const y = 60 + row * cellH
          shadows.addChild(sprite.shadow)
          hulls.addChild(sprite.root)
          this.ships.push({ sprite, x, y, angle: -0.35 })
          const t = new Text({ text: `${slotName(slot)} · ${tier.name}`, style: label, resolution: 2 })
          t.anchor.set(0.5, 0)
          t.position.set(x, y + 42)
          texts.addChild(t)
        })
        row++
      }
    }
    BOSS_DEFS.forEach((def, i) => {
      const sprite = new ShipSprite({
        key: `showboss${def.id}`,
        radius: def.radius,
        palette: { hull: 0x8a5a24, hullDark: 0x4a2c0e, deck: 0xd9b26e, trim: 0xf0c14b },
        sail: 0x2a2320,
        emblem: 0xb03a2e,
        flag: 0x111111,
        variant: i === 1 ? 'ironclad' : i === 2 ? 'sleek' : 'ship',
        masts: i === 1 ? 1 : i === 2 ? 2 : 3,
      })
      sprite.setLoadout(
        {
          side: { branchId: 'side_cannons', tierId: 'side_shots_ultra' },
          deck: { branchId: 'big_cannon', tierId: 'buster_cannon' },
        },
        1,
      )
      const x = 780
      const y = 120 + i * 220
      shadows.addChild(sprite.shadow)
      hulls.addChild(sprite.root)
      this.ships.push({ sprite, x, y, angle: -0.35 })
      const t = new Text({ text: def.name, style: label, resolution: 2 })
      t.anchor.set(0.5, 0)
      t.position.set(x, y + def.radius * 2)
      texts.addChild(t)
    })
    this.ocean.resize(w, h)
  }

  update(dt: number, w: number, h: number): void {
    this.t += dt
    if (w !== this.w || h !== this.h) {
      this.w = w
      this.h = h
      this.ocean.resize(w, h)
    }
    const zoom = Math.min(w / 960, h / 1480)
    this.world.scale.set(zoom)
    this.world.position.set(10, 10)
    this.ocean.update(dt, 0, 0, zoom, w, h)
    for (const s of this.ships) {
      s.sprite.update(dt, {
        x: s.x,
        y: s.y,
        angle: s.angle,
        aim: s.angle + Math.sin(this.t) * 1.5,
        speed: 90,
        maxSpeed: 130,
        turnRate: Math.sin(this.t * 2),
        protectedFor: 0,
      })
    }
  }
}

function slotName(slot: SlotId): string {
  return { front: 'Proa', side: 'Costados', deck: 'Cubierta', rear: 'Popa' }[slot]
}
