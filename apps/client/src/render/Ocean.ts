import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js'
import {
  waterBaseTex,
  waterWavesTex,
  vignetteTex,
  damageVignetteTex,
  sunGlintTex,
  buoyTex,
} from './textures.js'
import { makeSprite } from './ShipSprite.js'

/**
 * Océano en espacio de pantalla: tres capas de mosaico que se desplazan con la
 * cámara a distintas velocidades (paralaje) más una deriva propia del oleaje.
 */
export class Ocean {
  readonly container = new Container()
  private base: TilingSprite
  private waves1: TilingSprite
  private waves2: TilingSprite
  private time = 0

  constructor() {
    this.base = new TilingSprite({ texture: waterBaseTex().texture, width: 100, height: 100 })
    this.waves1 = new TilingSprite({ texture: waterWavesTex(0).texture, width: 100, height: 100 })
    this.waves2 = new TilingSprite({ texture: waterWavesTex(1).texture, width: 100, height: 100 })
    this.waves2.alpha = 0.7
    this.glints = new TilingSprite({ texture: sunGlintTex().texture, width: 100, height: 100 })
    this.glints.blendMode = 'add'
    this.glints.alpha = 0
    this.container.addChild(this.base, this.waves1, this.waves2, this.glints)
  }

  private glints: TilingSprite

  resize(w: number, h: number): void {
    for (const t of [this.base, this.waves1, this.waves2, this.glints]) {
      t.width = w
      t.height = h
    }
  }

  update(dt: number, camX: number, camY: number, zoom: number, screenW: number, screenH: number): void {
    this.time += dt
    const ox = screenW / 2 - camX * zoom
    const oy = screenH / 2 - camY * zoom
    this.base.tileScale.set(zoom * 1.5)
    this.base.tilePosition.set(ox, oy)
    // Mar de fondo: ondas largas que avanzan despacio y "respiran" en vertical
    this.waves1.tileScale.set(zoom * 1.7)
    this.waves1.tilePosition.set(
      ox + this.time * 5 * zoom,
      oy + this.time * 7 * zoom + Math.sin(this.time * 0.5) * 6 * zoom,
    )
    this.waves1.alpha = 1
    // Crestas de espuma: escasas, con un leve vaivén de opacidad
    this.waves2.tileScale.set(zoom * 1.1)
    this.waves2.tilePosition.set(ox - this.time * 6 * zoom, oy + this.time * 3 * zoom)
    this.waves2.alpha = 0.7 + Math.sin(this.time * 0.9) * 0.2
    // Destellos de sol: dos frecuencias desfasadas para que "parpadeen" sobre el oleaje
    this.glints.tileScale.set(zoom * 1.1)
    this.glints.tilePosition.set(ox + this.time * 4 * zoom, oy - this.time * 2 * zoom)
    this.glints.alpha = Math.max(0, Math.sin(this.time * 1.7) * 0.5 + Math.sin(this.time * 0.43) * 0.3) * 0.16
  }
}

/** Elementos fijos del mapa en espacio de mundo: zona central peligrosa y límites. */
export class MapDecor {
  readonly container = new Container()
  private zone = new Graphics()
  private zoneDash = new Graphics()
  private time = 0

  constructor(mapSize: number, centerRadius: number, showZone: boolean) {
    const half = mapSize / 2
    const border = new Graphics()
    const far = 6000
    // Mar exterior más oscuro
    border.rect(-far, -far, far * 2, far - half).fill({ color: 0x021521, alpha: 0.6 })
    border.rect(-far, half, far * 2, far - half).fill({ color: 0x021521, alpha: 0.6 })
    border.rect(-far, -half, far - half, mapSize).fill({ color: 0x021521, alpha: 0.6 })
    border.rect(half, -half, far - half, mapSize).fill({ color: 0x021521, alpha: 0.6 })
    // Arrecife perimetral
    for (let i = 0; i < 4; i++) {
      border
        .rect(-half - 6 - i * 6, -half - 6 - i * 6, mapSize + 12 + i * 12, mapSize + 12 + i * 12)
        .stroke({ width: 3, color: 0x7fd3c8, alpha: 0.18 - i * 0.04 })
    }
    border.rect(-half, -half, mapSize, mapSize).stroke({ width: 2, color: 0xe8f7ff, alpha: 0.35 })
    this.container.addChild(border)

    if (showZone) {
      this.zone.circle(0, 0, centerRadius).fill({ color: 0x3a0610, alpha: 0.16 })
      this.zone.circle(0, 0, centerRadius * 0.55).fill({ color: 0x3a0610, alpha: 0.08 })
      this.container.addChild(this.zone)
      this.container.addChild(this.zoneDash)
      // La geometría no cambia: animar su transformación evita reconstruir los arcos cada fotograma.
      const segments = 60
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2
        this.zoneDash.moveTo(Math.cos(a) * centerRadius, Math.sin(a) * centerRadius)
        this.zoneDash.arc(0, 0, centerRadius, a, a + Math.PI / segments)
      }
      this.zoneDash.stroke({ width: 4, color: 0xff6b5a })
      this.zoneDash.alpha = 0.28
      // Boyas de aviso balizando el límite de la zona central
      const count = 36
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        const b = makeSprite(buoyTex())
        b.position.set(Math.cos(a) * (centerRadius + 26), Math.sin(a) * (centerRadius + 26))
        this.container.addChild(b)
        this.buoys.push({ s: b, base: b.scale.x, phase: i * 1.7 })
      }
    }
  }

  private buoys: { s: Sprite; base: number; phase: number }[] = []

  update(dt: number): void {
    this.time += dt
    for (const b of this.buoys) {
      const k = Math.sin(this.time * 2.2 + b.phase)
      b.s.scale.set(b.base * (1 + k * 0.06))
      b.s.rotation = k * 0.25
    }
    if (!this.zoneDash.parent) return
    this.zoneDash.rotation = this.time * 0.04
    this.zoneDash.alpha = 0.28 + Math.sin(this.time * 1.5) * 0.08
  }
}

/** Capa de pantalla: viñeta permanente y viñeta roja de daño/vida baja. */
export class ScreenOverlay {
  readonly container = new Container()
  private vignette: Sprite
  private damage: Sprite
  private flash = new Graphics()
  private damageT = 0
  private flashT = 0
  private flashColor = 0xffffff
  private lowHp = 0
  private time = 0

  constructor() {
    this.vignette = new Sprite(vignetteTex().texture)
    this.damage = new Sprite(damageVignetteTex().texture)
    this.damage.alpha = 0
    this.container.addChild(this.vignette, this.damage, this.flash)
  }

  resize(w: number, h: number): void {
    for (const s of [this.vignette, this.damage]) {
      s.width = w
      s.height = h
    }
    this.flash.clear().rect(0, 0, w, h).fill({ color: 0xffffff })
    this.flash.alpha = 0
  }

  hurt(amount: number): void {
    this.damageT = Math.min(1, this.damageT + amount)
  }

  flashScreen(color: number, strength: number): void {
    this.flashColor = color
    this.flashT = Math.max(this.flashT, strength)
  }

  setLowHp(frac: number): void {
    this.lowHp = frac < 0.3 ? 1 - frac / 0.3 : 0
  }

  update(dt: number): void {
    this.time += dt
    this.damageT = Math.max(0, this.damageT - dt * 1.8)
    this.flashT = Math.max(0, this.flashT - dt * 3)
    const pulse = this.lowHp > 0 ? (0.5 + Math.sin(this.time * 5) * 0.5) * this.lowHp * 0.6 : 0
    this.damage.alpha = Math.min(1, this.damageT * 0.8 + pulse)
    this.flash.tint = this.flashColor
    this.flash.alpha = this.flashT * 0.35
  }
}
