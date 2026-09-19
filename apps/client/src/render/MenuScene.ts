import { Container, Graphics, Sprite } from 'pixi.js'
import { SKINS, SHIP_BASE, COIN_DEFS, type CoinKind } from '@doblonia/content'
import {
  createWorld,
  createShip,
  simulateTick,
  grantReward,
  updateBotEconomy,
  derived,
  isInsideAnyIsland,
  isBurning,
  isSlowed,
  type Island,
  type Ship,
  type World,
  type WorldEvent,
} from '@doblonia/sim'
import { Ocean } from './Ocean.js'
import { Effects } from './Effects.js'
import { ShipSprite, makeSprite, type EquipMap } from './ShipSprite.js'
import {
  islandTex,
  shoreFoamTex,
  paletteFromSkin,
  mulberry32,
  cannonballTex,
  chainShotTex,
  fireballTex,
  streakTex,
  glowTex,
  coinTex,
  mineTex,
  oilTex,
  HULL_LENGTH,
  HULL_BEAM,
  type Tex,
} from './textures.js'

const ARENA = 2400
const BOTS = 9
const TICK = 0.05
const TARGET_COINS = 28

interface ShipView {
  sprite: ShipSprite
  px: number
  py: number
  pa: number
  equipKey: string
  wasAlive: boolean
  wake: number
  fire: number
}

interface BulletView {
  ball: Sprite
  streak: Sprite | null
  glow: Sprite | null
  kind: string
}

/**
 * Fondo del menú: una partida real en miniatura. Corre en local la misma simulación
 * del servidor, con bots equipados peleando entre islas; la cámara sigue la pelea más viva.
 */
export class MenuScene {
  readonly stage = new Container()
  private ocean = new Ocean()
  private worldLayer = new Container()
  private islandLayer = new Container()
  private coinLayer = new Container()
  private mineLayer = new Container()
  private shadows = new Container()
  private shipLayer = new Container()
  private bulletLayer = new Container()
  private fx = new Effects()
  private world: World
  private views = new Map<string, ShipView>()
  private bullets = new Map<string, BulletView>()
  private coins = new Map<string, Sprite>()
  private mines = new Map<string, Sprite>()
  private islandTextures: Tex[] = []
  private acc = 0
  private t = 0
  private w = 1
  private h = 1
  private camX = 0
  private camY = 0
  private focusId: string | null = null
  private focusUntil = 0

  constructor() {
    this.stage.addChild(this.ocean.container, this.worldLayer)
    this.worldLayer.addChild(
      this.islandLayer,
      this.fx.under,
      this.coinLayer,
      this.mineLayer,
      this.shadows,
      this.shipLayer,
      this.bulletLayer,
      this.fx.over,
    )

    this.world = this.buildWorld()
    this.drawArena()

    for (let i = 0; i < BOTS; i++) {
      const skin = SKINS[i % SKINS.length]
      const s = createShip(this.world, `menu${i}`, skin.name, null, true, '', skin.id)
      this.placeShip(s)
      this.equipShip(s)
    }
    // Arranque en caliente: unos segundos simulados para que el fondo empiece ya en plena acción
    for (let i = 0; i < 60; i++) this.tick()
    this.acc = 0
  }

  private buildWorld(): World {
    const world = createWorld('ffa')
    world.mapSize = ARENA
    world.bosses.clear()
    world.whirlpools = []
    world.coins.clear()
    world.emeraldCoinId = null
    world.nextChestAt = Number.POSITIVE_INFINITY
    const rnd = mulberry32(42)
    const spots = [
      [-560, -300],
      [580, 260],
      [-80, 470],
      [420, -470],
      [-760, 420],
      [760, -180],
    ]
    world.islands = spots.map(([x, y], i): Island => {
      const n = 3 + Math.floor(rnd() * 3)
      const circles = Array.from({ length: n }, () => ({
        dx: (rnd() - 0.5) * 120,
        dy: (rnd() - 0.5) * 120,
        r: 45 + rnd() * 55,
      }))
      return { id: `menu_isl${i}`, x, y, circles, seed: 1000 + i }
    })
    return world
  }

  private drawArena(): void {
    // Borde de la arena, discreto
    const half = ARENA / 2
    const border = new Graphics()
    border.rect(-half, -half, ARENA, ARENA).stroke({ width: 3, color: 0x7fd3c8, alpha: 0.12 })
    this.islandLayer.addChild(border)
    for (const isl of this.world.islands) {
      const island = islandTex(isl.circles, isl.seed)
      const shore = shoreFoamTex(isl.circles)
      this.islandTextures.push(island, shore)
      const foam = makeSprite(shore)
      foam.position.set(isl.x, isl.y)
      foam.alpha = 0.7
      const s = makeSprite(island)
      s.position.set(isl.x, isl.y)
      this.islandLayer.addChild(foam, s)
    }
  }

  private freePoint(margin: number): { x: number; y: number } {
    const half = ARENA / 2 - 160
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() * 2 - 1) * half
      const y = (Math.random() * 2 - 1) * half
      if (!isInsideAnyIsland(this.world, x, y, margin)) return { x, y }
    }
    return { x: 0, y: 0 }
  }

  private placeShip(s: Ship): void {
    const p = this.freePoint(80)
    s.x = p.x
    s.y = p.y
    s.angle = Math.random() * Math.PI * 2
    s.vx = s.vy = 0
    s.spawnProtectedUntil = this.world.timeMs + 1500
  }

  /** Progresión aleatoria (nivel, armas y estadísticas), comprada con las mismas reglas que un jugador. */
  private equipShip(s: Ship): void {
    // Fuerza baja-media: niveles 3-6 y pocos puntos de estadística
    grantReward(this.world, s, 150 + Math.random() * 750, [])
    for (let i = 0; i < 8; i++) updateBotEconomy(this.world, s)
    s.coins = 0
    s.hp = s.maxHp = derived(s).maxHp
  }

  resize(w: number, h: number): void {
    this.w = w
    this.h = h
    this.ocean.resize(w, h)
  }

  private tick(): WorldEvent[] {
    const events = simulateTick(this.world, TICK)
    // Sin flota en el fondo del menú
    if (this.world.fleet.size) {
      this.world.fleet.clear()
      for (const s of this.world.ships.values()) s.fleetIds = []
    }
    // Tope de progresión: las bajas no los convierten en barcos al máximo
    for (const s of this.world.ships.values()) {
      const power = Object.values(s.statLevels).reduce((x, y) => x + y, 0)
      if (s.coins > 120 || power >= 20) s.coins = power >= 20 ? 0 : 120
      if (s.equipXp > 1000) s.equipXp = 1000
    }
    // Monedas solo dentro de la arena, y siempre unas cuantas a la vista
    const half = ARENA / 2 - 60
    for (const [id, c] of this.world.coins)
      if (Math.abs(c.x) > half || Math.abs(c.y) > half || c.kind === 'emerald') this.world.coins.delete(id)
    while (this.world.coins.size < TARGET_COINS) {
      const p = this.freePoint(30)
      const roll = Math.random()
      const kind: CoinKind = roll < 0.6 ? 'bronze' : roll < 0.88 ? 'silver' : 'gold'
      const id = `mc${++this.world._seq}`
      this.world.coins.set(id, { id, kind, x: p.x, y: p.y, value: COIN_DEFS[kind].value })
    }
    // Reaparición dentro de la arena y ya equipado, para que el combate siga siendo vistoso
    for (const e of events) {
      if (e.type !== 'spawn') continue
      const s = this.world.ships.get(e.shipId)
      if (!s) continue
      this.placeShip(s)
      this.equipShip(s)
      const v = this.views.get(s.id)
      if (v) {
        v.px = s.x
        v.py = s.y
        v.pa = s.angle
      }
    }
    return events
  }

  update(dt: number, w?: number, h?: number): void {
    this.t += dt
    if (w && h && (w !== this.w || h !== this.h)) this.resize(w, h)

    // Paso fijo de simulación (como el servidor) e interpolación del render entre pasos
    this.acc += Math.min(dt, 0.1)
    while (this.acc >= TICK) {
      this.acc -= TICK
      for (const [id, v] of this.views) {
        const s = this.world.ships.get(id)
        if (s) {
          v.px = s.x
          v.py = s.y
          v.pa = s.angle
        }
      }
      this.handleEvents(this.tick())
    }
    const alpha = this.acc / TICK

    this.syncShips(dt, alpha)
    this.syncBullets(alpha)
    this.syncCoins()
    this.syncMines()
    this.updateCamera(dt)
    this.fx.update(dt, 1 / this.worldLayer.scale.x)
  }

  private syncShips(dt: number, alpha: number): void {
    for (const s of this.world.ships.values()) {
      let v = this.views.get(s.id)
      if (!v) {
        const skin = SKINS.find((k) => k.id === s.skin) ?? SKINS[0]
        const sprite = new ShipSprite({
          key: `menu:${skin.id}`,
          radius: SHIP_BASE.radius,
          palette: paletteFromSkin(skin),
          sail: skin.sail,
          emblem: skin.trim,
          flag: skin.trim,
          variant: 'ship',
          masts: 2,
        })
        this.shadows.addChild(sprite.shadow)
        this.shipLayer.addChild(sprite.root)
        v = { sprite, px: s.x, py: s.y, pa: s.angle, equipKey: '', wasAlive: s.alive, wake: 0, fire: 0 }
        this.views.set(s.id, v)
      }
      const key = JSON.stringify(s.equip)
      if (key !== v.equipKey) {
        v.equipKey = key
        v.sprite.setLoadout(s.equip as EquipMap, derived(s).radius / SHIP_BASE.radius)
      }
      if (!s.alive && v.wasAlive) v.sprite.startSinking()
      if (s.alive && !v.wasAlive) v.sprite.resetSink()
      v.wasAlive = s.alive
      let da = s.angle - v.pa
      while (da > Math.PI) da -= Math.PI * 2
      while (da < -Math.PI) da += Math.PI * 2
      const x = v.px + (s.x - v.px) * alpha
      const y = v.py + (s.y - v.py) * alpha
      const angle = v.pa + da * alpha
      const speed = Math.hypot(s.vx, s.vy)
      v.sprite.update(dt, {
        x,
        y,
        angle,
        aim: s.input.aimAngle,
        speed,
        maxSpeed: 160,
        turnRate: s.input.turn * 2,
        protectedFor: 0,
      })
      v.sprite.root.visible = v.sprite.shadow.visible = s.alive || !v.sprite.sinkDone
      v.sprite.setSlowed(s.alive && isSlowed(s.fx, this.world.timeMs))
      if (!s.alive) continue
      const r = derived(s).radius
      if (speed > 12) {
        v.wake += speed * dt * 0.12
        const L = r * HULL_LENGTH
        while (v.wake >= 1) {
          v.wake -= 1
          this.fx.wake(
            x - Math.cos(angle) * L * 0.42,
            y - Math.sin(angle) * L * 0.42,
            angle,
            speed,
            r * HULL_BEAM,
          )
        }
      }
      if (isBurning(s.fx, this.world.timeMs)) {
        v.fire += dt * 16
        while (v.fire >= 1) {
          v.fire -= 1
          this.fx.flame(x + (Math.random() - 0.5) * r * 2, y + (Math.random() - 0.5) * r, r / 20)
        }
      }
    }
  }

  private bulletTex(kind: string): Tex {
    return kind === 'chain' ? chainShotTex() : kind === 'fire' ? fireballTex() : cannonballTex()
  }

  private syncBullets(alpha: number): void {
    const seen = new Set<string>()
    for (const b of this.world.bullets.values()) {
      seen.add(b.id)
      let v = this.bullets.get(b.id)
      if (!v) {
        const tex = this.bulletTex(b.kind)
        const ball = makeSprite(tex)
        const mortar = b.kind === 'mortar'
        if (b.kind === 'fire') {
          ball.blendMode = 'add'
          ball.scale.set(tex.scale * (b.radius / 11))
        } else if (b.kind === 'chain') {
          ball.scale.set(tex.scale * (b.radius / 6))
        } else {
          ball.scale.set(tex.scale * (b.radius / 7.5) * (mortar ? 1.05 : 1.3))
        }
        let streak: Sprite | null = null
        if (!mortar) {
          streak = makeSprite(streakTex())
          streak.blendMode = 'add'
          streak.rotation = Math.atan2(b.vy, b.vx)
          streak.scale.set((Math.hypot(b.vx, b.vy) * 0.07) / 60, (b.radius * 2.2) / 12)
          streak.tint = b.kind === 'fire' ? 0xff7a1e : b.kind === 'chain' ? 0xb8c6d4 : 0xffc890
          streak.alpha = 0.5
          this.bulletLayer.addChild(streak)
        }
        let glow: Sprite | null = null
        if (b.kind === 'fire' || b.radius >= 7) {
          glow = makeSprite(glowTex())
          glow.blendMode = 'add'
          glow.tint = b.kind === 'fire' ? 0xff6a10 : 0xffb060
          glow.scale.set((b.radius / 32) * 3)
          glow.alpha = 0.5
          this.bulletLayer.addChild(glow)
        }
        this.bulletLayer.addChild(ball)
        v = { ball, streak, glow, kind: b.kind }
        this.bullets.set(b.id, v)
      }
      // Balas en línea recta: se extrapolan dentro del paso de simulación
      const x = b.x + b.vx * TICK * alpha
      const y = b.y + b.vy * TICK * alpha
      v.ball.position.set(x, y)
      v.streak?.position.set(x, y)
      v.glow?.position.set(x, y)
      if (v.kind === 'chain') v.ball.rotation += 0.3
    }
    for (const [id, v] of this.bullets) {
      if (seen.has(id)) continue
      v.ball.destroy()
      v.streak?.destroy()
      v.glow?.destroy()
      this.bullets.delete(id)
    }
  }

  private syncCoins(): void {
    const seen = new Set<string>()
    for (const c of this.world.coins.values()) {
      seen.add(c.id)
      let s = this.coins.get(c.id)
      if (!s) {
        s = makeSprite(coinTex(c.kind))
        s.position.set(c.x, c.y)
        this.coinLayer.addChild(s)
        this.coins.set(c.id, s)
      }
      const base = coinTex(c.kind).scale * 1.3
      s.scale.set(base * (0.55 + Math.abs(Math.cos(this.t * 2 + c.x)) * 0.45), base)
    }
    for (const [id, s] of this.coins) {
      if (seen.has(id)) continue
      s.destroy()
      this.coins.delete(id)
    }
  }

  private syncMines(): void {
    const seen = new Set<string>()
    for (const m of this.world.mines.values()) {
      seen.add(m.id)
      let s = this.mines.get(m.id)
      if (!s) {
        const tex = m.oil ? oilTex() : mineTex(true, false)
        s = makeSprite(tex)
        s.position.set(m.x, m.y)
        s.scale.set(m.oil ? tex.scale * ((m.radius * 2.3) / 96) : tex.scale * (m.radius / 26))
        this.mineLayer.addChild(s)
        this.mines.set(m.id, s)
      }
      if (m.oil && Math.random() < 0.5)
        this.fx.flame(
          m.x + (Math.random() - 0.5) * m.radius * 1.4,
          m.y + (Math.random() - 0.5) * m.radius * 1.4,
          0.8,
        )
    }
    for (const [id, s] of this.mines) {
      if (seen.has(id)) continue
      s.destroy()
      this.mines.delete(id)
    }
  }

  private handleEvents(events: WorldEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          this.fx.muzzle(e.x, e.y, e.angle, 0.9)
          break
        case 'hit':
          this.fx.hit(e.x, e.y, e.damage >= 18)
          if (e.targetKind === 'ship') this.views.get(e.targetId)?.sprite.hitFlash()
          break
        case 'ramHit':
          this.fx.hit(e.x, e.y, true)
          this.fx.splash(e.x, e.y, true)
          break
        case 'death':
          this.fx.explosion(e.x, e.y, 1.2)
          break
        case 'mineExplode':
          this.fx.mineBlast(e.x, e.y, e.radius)
          break
        case 'mortarBlast':
          this.fx.mortarBlast(e.x, e.y, e.radius)
          break
        case 'splash':
          this.fx.splash(e.x, e.y)
          break
        case 'spawn':
          this.fx.splash(e.x, e.y, true)
          break
      }
    }
  }

  /** La cámara sigue al barco en el combate más reñido y cambia de protagonista cada cierto tiempo. */
  private updateCamera(dt: number): void {
    const now = this.world.timeMs
    const current = this.focusId ? this.world.ships.get(this.focusId) : undefined
    if (!current || !current.alive || now > this.focusUntil) {
      let best: Ship | undefined
      let bestScore = -1
      for (const s of this.world.ships.values()) {
        if (!s.alive) continue
        let near = 0
        for (const o of this.world.ships.values())
          if (o !== s && o.alive && Math.hypot(o.x - s.x, o.y - s.y) < 520) near++
        const fighting = now - s.lastDamageAt < 3000 ? 2 : 0
        const score = near + fighting + Math.random() * 0.5
        if (score > bestScore) {
          bestScore = score
          best = s
        }
      }
      if (best) {
        this.focusId = best.id
        this.focusUntil = now + 9000 + Math.random() * 5000
      }
    }
    const f = this.focusId ? this.world.ships.get(this.focusId) : undefined
    if (f) {
      // Centro entre el protagonista y sus rivales cercanos, para que se vea el intercambio
      let sx = f.x
      let sy = f.y
      let n = 1
      for (const o of this.world.ships.values()) {
        if (o !== f && o.alive && Math.hypot(o.x - f.x, o.y - f.y) < 480) {
          sx += o.x
          sy += o.y
          n++
        }
      }
      const k = 1 - Math.exp(-dt * 0.9)
      this.camX += (sx / n - this.camX) * k
      this.camY += (sy / n - this.camY) * k
    }
    const zoom = Math.max(0.75, Math.min(1.35, Math.sqrt((this.w * this.h) / (1500 * 860)))) * 1.05
    const half = ARENA / 2
    const vx = this.w / zoom / 2
    const vy = this.h / zoom / 2
    const cx = vx >= half ? 0 : Math.max(-half + vx, Math.min(half - vx, this.camX))
    const cy = vy >= half ? 0 : Math.max(-half + vy, Math.min(half - vy, this.camY))
    this.worldLayer.scale.set(zoom)
    this.worldLayer.position.set(this.w / 2 - cx * zoom, this.h / 2 - cy * zoom)
    this.ocean.update(dt, cx, cy, zoom, this.w, this.h)
  }

  destroy(): void {
    this.stage.destroy({ children: true })
    for (const texture of this.islandTextures) texture.texture.destroy(true)
    this.islandTextures = []
  }
}
