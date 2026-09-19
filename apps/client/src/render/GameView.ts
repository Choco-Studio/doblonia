import { Application, Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js'
import type { Room } from '@colyseus/sdk'
import type {
  RoomStateSchema,
  ShipStateSchema,
  BossStateSchema,
  FleetStateSchema,
  BulletStateSchema,
  MineStateSchema,
  CoinStateSchema,
} from '@doblonia/protocol'
import {
  COIN_DEFS,
  SHIP_BASE,
  TEAM_COLORS,
  findBossDef,
  findFleetDef,
  findSkin,
  findTier,
  type CoinKind,
} from '@doblonia/content'
import {
  computeDerivedStats,
  integrateMotion,
  movementStats,
  resolveWorldBounds,
  applyWhirlpools,
  whirlpoolCurrent,
  CENTER_RADIUS,
  type Island,
  type WorldEvent,
  type WhirlpoolField,
} from '@doblonia/sim'
import { Ocean, MapDecor, ScreenOverlay } from './Ocean.js'
import { Effects } from './Effects.js'
import { ShipSprite, makeSprite, type EquipMap, type ShipLook } from './ShipSprite.js'
import { FortSprite } from './FortSprite.js'
import {
  cannonballTex,
  coinTex,
  glowTex,
  islandTex,
  mineTex,
  paletteFromSkin,
  streakTex,
  HULL_LENGTH,
  HULL_BEAM,
  shade,
  chainShotTex,
  fireballTex,
  targetMarkerTex,
  chestTex,
  whirlFunnelTex,
  whirlArmsTex,
  whirlRimTex,
  oilTex,
  cloudShadowTex,
  gullTex,
  gullShadowTex,
  shoreFoamTex,
  type Tex,
} from './textures.js'
import { sound } from '../audio/Sound.js'
import { settings } from '../settings.js'
import type { FrameInput } from '../input/InputManager.js'

const nameStyle = new TextStyle({
  fontFamily: 'Inter',
  fontSize: 14,
  fontWeight: '700',
  fill: 0xf2f7fa,
  stroke: { color: 0x04121a, width: 4, join: 'round' },
  letterSpacing: 0.2,
})
const tagStyle = new TextStyle({
  fontFamily: 'Inter',
  fontSize: 10,
  fontWeight: '800',
  fill: 0x9fb4be,
  stroke: { color: 0x04121a, width: 3, join: 'round' },
  letterSpacing: 0.8,
})
const bossNameStyle = new TextStyle({
  fontFamily: 'Pirata One',
  fontSize: 24,
  fill: 0xffd27a,
  stroke: { color: 0x1a0d02, width: 5, join: 'round' },
  letterSpacing: 1,
})
const fortNameStyle = new TextStyle({
  fontFamily: 'Pirata One',
  fontSize: 20,
  fill: 0xe8d8b0,
  stroke: { color: 0x1a120a, width: 5, join: 'round' },
  letterSpacing: 1,
})

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

interface ShipEntity {
  sprite: ShipSprite
  label: Container
  nameText: Text
  tagText: Text
  bar: Graphics
  teamRing: Graphics | null
  rx: number
  ry: number
  rangle: number
  raim: number
  turnRate: number
  lastHp: number
  hpVisibleUntil: number
  wakeAcc: number
  wasAlive: boolean
  lookKey: string
  equipRaw: string
  statsRaw: string
  fireAcc: number
}

interface BossEntity {
  sprite: ShipSprite | FortSprite
  fort: boolean
  fireAcc: number
  label: Text
  bar: Graphics
  aura: Graphics
  rx: number
  ry: number
  rangle: number
  raim: number
  lastHp: number
  wasAlive: boolean
  wakeAcc: number
}

interface FleetEntity {
  sprite: ShipSprite
  bar: Graphics
  rx: number
  ry: number
  rangle: number
  lastHp: number
  wakeAcc: number
}

interface CoinEntity {
  sprite: Sprite
  glow: Sprite
  kind: string
  x: number
  y: number
  phase: number
  born: number
}

interface MineEntity {
  sprite: Sprite
  ring: Graphics | null
  armed: boolean
  own: boolean
  oil: boolean
  fireAcc: number
}

interface BulletEntity {
  kind: string
  ball: Sprite
  streak: Sprite
  glow: Sprite | null
  /** Mortero: sombra en el agua y marca del punto de caída. */
  shadow: Sprite | null
  marker: Sprite | null
  baseScale: number
  spin: number
  trailAcc: number
  x: number
  y: number
}

interface WhirlTracer {
  s: Sprite
  x: number
  y: number
  life: number
  max: number
}

interface WhirlEntity {
  field: WhirlpoolField
  x: number
  y: number
  radius: number
  /** Capas de espuma en espiral: cuanto más interior, más rápido giran (como el agua de verdad). */
  arms: { s: Sprite; speed: number }[]
  rim: Sprite
  eye: Sprite
  tracers: WhirlTracer[]
  foamAcc: number
  bubbleAcc: number
}

interface Gull {
  s: Sprite
  shadow: Sprite
  cx: number
  cy: number
  orbit: number
  speed: number
  phase: number
  alt: number
}

interface Cloud {
  s: Sprite
  vx: number
  vy: number
}

const BOSS_LOOKS: Record<
  string,
  {
    variant: ShipLook['variant']
    masts: number
    equip: EquipMap
    hull: number
    dark: number
    deck: number
    sail: number
    trim: number
  }
> = {
  guardian_artillero: {
    variant: 'ship',
    masts: 3,
    equip: {
      side: { branchId: 'side_cannons', tierId: 'side_shots_ultra' },
      deck: { branchId: 'big_cannon', tierId: 'big_cannon_1' },
    },
    hull: 0x8a5a24,
    dark: 0x4a2c0e,
    deck: 0xd9b26e,
    sail: 0x2a2320,
    trim: 0xf0c14b,
  },
  acorazado: {
    variant: 'ironclad',
    masts: 1,
    equip: {
      side: { branchId: 'side_cannons', tierId: 'side_shots' },
      deck: { branchId: 'big_cannon', tierId: 'buster_cannon' },
      front: { branchId: 'ram', tierId: 'ultra_ram' },
    },
    hull: 0x59606b,
    dark: 0x2a2e35,
    deck: 0x8f98a3,
    sail: 0x3a3f46,
    trim: 0xc9ced6,
  },
  interceptor: {
    variant: 'sleek',
    masts: 2,
    equip: {
      side: { branchId: 'rows', tierId: 'ultra_rowers' },
      deck: { branchId: 'swivel_cannon', tierId: 'swivel_cannon_3' },
      front: { branchId: 'ram', tierId: 'greater_ram' },
    },
    hull: 0x1f7a66,
    dark: 0x0e4035,
    deck: 0xa8dccb,
    sail: 0x10261f,
    trim: 0x7fffd4,
  },
}

const FLEET_LOOKS: Record<
  string,
  { scale: number; masts: number; variant: ShipLook['variant']; equip: EquipMap }
> = {
  fishing_boat: { scale: 0.52, masts: 1, variant: 'boat', equip: { deck: undefined } },
  mine_dropper_fleet: {
    scale: 0.62,
    masts: 1,
    variant: 'ship',
    equip: { rear: { branchId: 'mine_dropper', tierId: 'bigger_mines' } },
  },
  battleship: {
    scale: 0.68,
    masts: 2,
    variant: 'ship',
    equip: {
      side: { branchId: 'side_cannons', tierId: 'side_cannons_1' },
      deck: { branchId: 'auto_cannon', tierId: 'auto_cannon_1' },
    },
  },
  man_of_war: {
    scale: 0.85,
    masts: 3,
    variant: 'ship',
    equip: {
      side: { branchId: 'side_cannons', tierId: 'side_shots_x' },
      deck: { branchId: 'swivel_cannon', tierId: 'swivel_cannon_2' },
    },
  },
}

export interface CameraInfo {
  x: number
  y: number
  zoom: number
}

export class GameView {
  readonly stage = new Container()
  private ocean = new Ocean()
  private camera = new Container()
  private decor: MapDecor
  private islandLayer = new Container()
  private coinLayer = new Container()
  private mineLayer = new Container()
  private shadowLayer = new Container()
  private fleetLayer = new Container()
  private bossLayer = new Container()
  private shipLayer = new Container()
  private bulletLayer = new Container()
  private labelLayer = new Container()
  private whirlLayer = new Container()
  private shoreLayer = new Container()
  private skyLayer = new Container()
  private overlay = new ScreenOverlay()
  private whirls: WhirlEntity[] = []
  private get whirlFields(): WhirlpoolField[] {
    return this.whirls.map((w) => w.field)
  }
  private shores: { s: Sprite; phase: number; base: number }[] = []
  private gulls: Gull[] = []
  private clouds: Cloud[] = []
  private mapSize = 5600
  readonly fx = new Effects()

  private ships = new Map<string, ShipEntity>()
  private bosses = new Map<string, BossEntity>()
  private fleet = new Map<string, FleetEntity>()
  private coins = new Map<string, CoinEntity>()
  private mines = new Map<string, MineEntity>()
  private bullets = new Map<string, BulletEntity>()

  private islands: Island[] = []
  private islandsBuilt = false
  private worldTextures: Tex[] = []

  private camX = 0
  private camY = 0
  private zoom = 1
  private time = 0
  private shakeT = 0
  private shakeMag = 0

  private lastServerT = -1
  private lastServerLocal = 0
  private renderT = 0

  private pred = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, ready: false }
  private input: FrameInput = {
    throttle: 0,
    turn: 0,
    aimAngle: 0,
    aimDist: 300,
    firing: false,
    fireCoin: false,
  }
  private recentHits: { x: number; y: number; t: number }[] = []
  private screenW = 1
  private screenH = 1
  /** Zoom fijo opcional (capturas, depuración). null = automático. */
  zoomOverride: number | null = null
  mouseScreenX = 0
  mouseScreenY = 0

  constructor(
    private app: Application,
    private room: Room<RoomStateSchema>,
    readonly myId: string,
  ) {
    this.decor = new MapDecor(this.mapSize, CENTER_RADIUS, true)
    this.stage.addChild(this.ocean.container)
    this.stage.addChild(this.camera)
    this.camera.addChild(this.decor.container)
    this.camera.addChild(this.whirlLayer)
    this.camera.addChild(this.shoreLayer)
    this.camera.addChild(this.islandLayer)
    this.camera.addChild(this.fx.under)
    this.camera.addChild(this.coinLayer)
    this.camera.addChild(this.mineLayer)
    this.camera.addChild(this.shadowLayer)
    this.camera.addChild(this.fleetLayer)
    this.camera.addChild(this.bossLayer)
    this.camera.addChild(this.shipLayer)
    this.camera.addChild(this.bulletLayer)
    this.camera.addChild(this.fx.over)
    this.camera.addChild(this.skyLayer)
    this.camera.addChild(this.labelLayer)
    this.camera.addChild(this.fx.textLayer)
    this.stage.addChild(this.overlay.container)
    this.resize(app.screen.width, app.screen.height)
  }

  resize(w: number, h: number): void {
    this.screenW = w
    this.screenH = h
    this.ocean.resize(w, h)
    this.overlay.resize(w, h)
  }

  destroy(): void {
    this.stage.destroy({ children: true })
    for (const texture of this.worldTextures) texture.texture.destroy(true)
    this.worldTextures = []
    this.thumbCache.clear()
  }

  get cameraInfo(): CameraInfo {
    return { x: this.camX, y: this.camY, zoom: this.zoom }
  }

  get serverTime(): number {
    return this.renderT
  }

  setInput(input: FrameInput): void {
    this.input = input
  }

  /** Posición del ratón en el mundo, para calcular el ángulo de apuntado. */
  mouseWorld(): { x: number; y: number } {
    return {
      x: this.camX + (this.mouseScreenX - this.screenW / 2) / this.zoom,
      y: this.camY + (this.mouseScreenY - this.screenH / 2) / this.zoom,
    }
  }

  private thumbCache = new Map<string, string>()
  /** Equipo que se está previsualizando en tu barco (bandeja de mejoras), o null. */
  private preview: { equip: EquipMap; key: string } | null = null

  /** Muestra en tu propio barco cómo quedaría una mejora y acerca la cámara; null para salir. */
  previewEquip(equip: EquipMap | null): void {
    this.preview = equip ? { equip, key: JSON.stringify(equip) } : null
    const me = this.ships.get(this.myId)
    if (me) {
      me.equipRaw = ''
      if (equip) me.sprite.hitFlash()
    }
  }

  /**
   * Miniatura (data URL) del barco del jugador con un equipo dado, proa hacia arriba.
   * Se usa en la bandeja de mejoras y en el Astillero; se cachea por combinación.
   */
  loadoutThumb(equip: EquipMap, statsJson: string, skin: string, team: string, focus = false): string {
    const stats = parseJson<Record<string, number>>(statsJson, {})
    const d = computeDerivedStats({ statLevels: stats, equip })
    const key = `${JSON.stringify(equip)}|${d.radius.toFixed(2)}|${skin}|${team}|${focus}`
    const hit = this.thumbCache.get(key)
    if (hit) return hit
    const sprite = new ShipSprite(this.shipLook({ skin, team }))
    sprite.setLoadout(equip, d.radius / SHIP_BASE.radius)
    if (focus) sprite.ghostSails(0.22)
    const up = -Math.PI / 2
    sprite.update(0, {
      x: 0,
      y: 0,
      angle: up,
      aim: up + 0.55,
      speed: 0,
      maxSpeed: 1,
      turnRate: 0,
      protectedFor: 0,
    })
    const holder = new Container()
    holder.addChild(sprite.root)
    let url: string
    try {
      const canvas = this.app.renderer.extract.canvas({
        target: holder,
        resolution: 3,
        antialias: true,
      }) as HTMLCanvasElement
      url = canvas.toDataURL('image/png')
    } catch {
      url = ''
    }
    sprite.destroy()
    holder.destroy()
    if (this.thumbCache.size > 120) this.thumbCache.clear()
    if (url) this.thumbCache.set(key, url)
    return url
  }

  myPosition(): { x: number; y: number; alive: boolean } {
    const me = this.room.state?.ships.get(this.myId)
    if (me?.alive && this.pred.ready) return { x: this.pred.x, y: this.pred.y, alive: true }
    return { x: me?.x ?? this.camX, y: me?.y ?? this.camY, alive: false }
  }

  shake(mag: number, seconds: number): void {
    if (!settings.screenShake) return
    this.shakeMag = Math.max(this.shakeMag, mag)
    this.shakeT = Math.max(this.shakeT, seconds)
  }

  // -------------------------------------------------------------------------
  // Eventos del servidor
  // -------------------------------------------------------------------------

  handleEvents(events: WorldEvent[]): void {
    const me = this.myId
    const pos = this.myPosition()
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const strong = e.damage >= 18
          this.fx.hit(e.x + (Math.random() - 0.5) * 16, e.y + (Math.random() - 0.5) * 16, strong)
          this.recentHits.push({ x: e.x, y: e.y, t: this.time })
          if (e.targetKind === 'ship') this.ships.get(e.targetId)?.sprite.hitFlash()
          if (e.targetKind === 'boss') this.bosses.get(e.targetId)?.sprite.hitFlash()
          const ent = this.ships.get(e.targetId)
          if (ent) ent.hpVisibleUntil = this.time + 3
          if (e.targetId === me) {
            this.overlay.hurt(Math.min(0.6, e.damage / 60))
            this.shake(Math.min(10, 2 + e.damage * 0.15), 0.2)
            this.fx.damageNumber(pos.x, pos.y - 30, e.damage, 0xff6b5a)
            sound.play('hurt', { volume: 0.9 })
          } else if (e.sourceId === me) {
            this.fx.damageNumber(
              e.x,
              e.y - 20,
              e.damage,
              e.targetKind === 'boss' ? 0xffd27a : 0xffffff,
              e.damage >= 30,
            )
            sound.play('hit', { volume: 0.7, pitch: 1 + Math.random() * 0.2 })
          } else {
            sound.play('hit', { x: e.x, y: e.y, volume: 0.35 })
          }
          break
        }
        case 'ramHit':
          this.fx.hit(e.x, e.y, true)
          this.fx.splash(e.x, e.y, true)
          sound.play('ram', { x: e.x, y: e.y })
          if (Math.hypot(e.x - pos.x, e.y - pos.y) < 120) this.shake(8, 0.25)
          break
        case 'death': {
          this.fx.explosion(e.x, e.y, 1.2)
          sound.play('explosion', { x: e.x, y: e.y })
          if (e.shipId === me) {
            this.overlay.flashScreen(0xff5a3a, 1)
            this.shake(14, 0.6)
          } else if (e.killedByShipId === me) {
            this.overlay.flashScreen(0xf0c14b, 0.4)
          }
          break
        }
        case 'bossDeath':
          this.fx.explosion(e.x, e.y, 2.4)
          this.fx.explosion(e.x + 30, e.y - 20, 1.5)
          this.fx.explosion(e.x - 25, e.y + 25, 1.5)
          sound.play('bossDown', { x: e.x, y: e.y, volume: 1.2 })
          if (Math.hypot(e.x - pos.x, e.y - pos.y) < 900) this.shake(16, 0.8)
          break
        case 'mineExplode':
          this.fx.mineBlast(e.x, e.y, e.radius)
          sound.play('mine', { x: e.x, y: e.y })
          if (Math.hypot(e.x - pos.x, e.y - pos.y) < 200) this.shake(9, 0.3)
          break
        case 'pickup': {
          const def = COIN_DEFS[e.coinKind as CoinKind]
          this.fx.sparkle(e.x, e.y, def?.color ?? 0xffd700)
          const gem =
            e.coinKind === 'ruby' ||
            e.coinKind === 'diamond' ||
            e.coinKind === 'emerald' ||
            e.coinKind === 'chest'
          if (e.coinKind === 'chest') {
            this.fx.explosion(e.x, e.y, 0.4)
            this.fx.ringAt(e.x, e.y, 0xffd24a, 1.2)
          }
          if (e.shipId === me) {
            sound.play(e.coinKind === 'chest' ? 'chest' : gem ? 'gem' : 'coin', {
              volume: 0.6,
              pitch: 0.95 + Math.random() * 0.1,
            })
            this.fx.damageNumber(e.x, e.y - 12, def?.value ?? 0, gem ? 0x9ff6c8 : 0xf0c14b)
          }
          break
        }
        case 'levelUp':
          if (e.shipId === me) {
            this.fx.levelUp(pos.x, pos.y)
            sound.play('levelUp')
          }
          break
        case 'spawn': {
          this.fx.splash(e.x, e.y, true)
          this.fx.ringAt(e.x, e.y, 0x9ff6ff, 1.2)
          const ent = this.ships.get(e.shipId)
          if (ent) {
            ent.rx = e.x
            ent.ry = e.y
          }
          if (e.shipId === me) this.pred.ready = false
          break
        }
        case 'fleetLost':
          this.fx.explosion(e.x, e.y, 0.7)
          sound.play('explosion', { x: e.x, y: e.y, volume: 0.5 })
          break
        case 'splash':
          this.fx.splash(e.x, e.y)
          break
        case 'mortarBlast': {
          this.fx.mortarBlast(e.x, e.y, e.radius)
          sound.play('mortarBlast', { x: e.x, y: e.y })
          const d = Math.hypot(e.x - pos.x, e.y - pos.y)
          if (d < e.radius + 60) this.shake(11, 0.35)
          else if (d < 400) this.shake(4, 0.2)
          break
        }
        case 'chest':
          this.fx.splash(e.x, e.y, true)
          this.fx.ringAt(e.x, e.y, 0xf0c14b, 1.4)
          this.fx.sparkle(e.x, e.y, 0xffd24a)
          sound.play('chest', { x: e.x, y: e.y, volume: 0.6 })
          break
        case 'bossSpawn':
          break
      }
    }
  }

  // -------------------------------------------------------------------------
  // Bucle
  // -------------------------------------------------------------------------

  update(dt: number): void {
    this.time += dt
    const w = this.app.screen.width
    const h = this.app.screen.height
    if (w !== this.screenW || h !== this.screenH) this.resize(w, h)
    const state = this.room.state
    if (!state) return

    const now = performance.now()
    if (state.timeMs !== this.lastServerT) {
      this.lastServerT = state.timeMs
      this.lastServerLocal = now
    }
    this.renderT = this.lastServerT + Math.min(250, now - this.lastServerLocal)
    const extrap = Math.max(0, Math.min(0.25, (this.renderT - state.timeMs) / 1000))

    this.ensureIslands(state)
    this.updateOwnPrediction(dt, state, extrap)
    this.syncShips(dt, state, extrap)
    this.syncBosses(dt, state, extrap)
    this.syncFleet(dt, state, extrap)
    this.syncCoins(dt, state)
    this.syncMines(dt, state)
    this.syncBullets(dt, state)
    this.updateCamera(dt, state)
    this.updateAimMarker(dt, state)

    this.decor.update(dt)
    this.updateAmbient(dt)
    this.fx.update(dt, 1 / this.zoom)
    this.overlay.update(dt)
    this.cullDistantObjects()
    this.recentHits = this.recentHits.filter((h) => this.time - h.t < 0.25)

    const me = state.ships.get(this.myId)
    this.overlay.setLowHp(me?.alive ? me.hp / Math.max(1, me.maxHp) : 1)
    sound.setListener(this.camX, this.camY)
  }

  /** La animación sigue avanzando fuera de cámara, pero no envía sus dibujos a la GPU. */
  private cullDistantObjects(): void {
    for (const e of this.ships.values()) {
      const visible = this.nearCamera(e.rx, e.ry, e.sprite.radius * 4 + 180 / this.zoom)
      e.sprite.root.renderable = e.sprite.shadow.renderable = visible
      e.label.renderable = e.bar.renderable = visible
      if (e.teamRing) e.teamRing.renderable = visible
    }
    for (const e of this.fleet.values()) {
      const visible = this.nearCamera(e.rx, e.ry, e.sprite.radius * 4 + 80)
      e.sprite.root.renderable = e.sprite.shadow.renderable = e.bar.renderable = visible
    }
    for (const e of this.bosses.values()) {
      const visible = this.nearCamera(e.rx, e.ry, 300)
      e.sprite.root.renderable = e.sprite.shadow.renderable = visible
      e.label.renderable = e.bar.renderable = visible
      e.aura.renderable = this.nearCamera(e.rx, e.ry, 900)
    }
    for (const e of this.coins.values()) {
      e.sprite.renderable = e.glow.renderable = this.nearCamera(e.x, e.y, 80)
    }
    for (const layer of [this.islandLayer, this.shoreLayer, this.whirlLayer, this.skyLayer]) {
      for (const child of layer.children) {
        if (child instanceof Sprite) {
          child.renderable = this.nearCamera(child.x, child.y, Math.max(child.width, child.height))
        }
      }
    }
  }

  private ensureIslands(state: RoomStateSchema): void {
    if (this.islandsBuilt || state.islands.length === 0) return
    for (const isl of state.islands) {
      const circles = parseJson<{ dx: number; dy: number; r: number }[]>(isl.circlesJson, [])
      this.islands.push({ id: isl.id, x: isl.x, y: isl.y, circles, seed: isl.seed })
      const island = islandTex(circles, isl.seed)
      const shore = shoreFoamTex(circles)
      this.worldTextures.push(island, shore)
      const s = makeSprite(island)
      s.position.set(isl.x, isl.y)
      this.islandLayer.addChild(s)
      // Rompiente animada alrededor de la costa
      const foam = makeSprite(shore)
      foam.position.set(isl.x, isl.y)
      this.shoreLayer.addChild(foam)
      this.shores.push({ s: foam, phase: isl.seed % 7, base: foam.scale.x })
    }
    this.islandsBuilt = true
    this.mapSize = state.mapSize || this.mapSize
    this.decor.container.destroy({ children: true })
    this.decor = new MapDecor(this.mapSize, CENTER_RADIUS, state.mode !== 'tdm')
    this.camera.addChildAt(this.decor.container, 0)

    state.whirlpools.forEach((w) => {
      const field: WhirlpoolField = { x: w.x, y: w.y, radius: w.radius, strength: w.strength || 170 }
      const funnel = makeSprite(whirlFunnelTex(w.radius))
      funnel.position.set(w.x, w.y)
      this.whirlLayer.addChild(funnel)
      const arms = [
        { v: 0, scale: 1, speed: 0.28, alpha: 0.85 },
        { v: 1, scale: 0.66, speed: 0.62, alpha: 0.9 },
        { v: 2, scale: 0.36, speed: 1.35, alpha: 0.75 },
      ].map((a) => {
        const tex = whirlArmsTex(w.radius, a.v)
        const s = makeSprite(tex)
        s.scale.set(tex.scale * a.scale)
        s.alpha = a.alpha
        s.rotation = a.v * 1.3
        s.position.set(w.x, w.y)
        this.whirlLayer.addChild(s)
        return { s, speed: a.speed }
      })
      const rim = makeSprite(whirlRimTex(w.radius))
      rim.position.set(w.x, w.y)
      this.whirlLayer.addChild(rim)
      // Ojo: agujero oscuro que "respira"
      const eye = makeSprite(glowTex())
      eye.tint = 0x000000
      eye.alpha = 0.55
      eye.scale.set((w.radius * 0.34) / 32)
      eye.position.set(w.x, w.y)
      this.whirlLayer.addChild(eye)
      // Estelas de espuma que siguen la misma corriente que mueve a los barcos
      const tracers: WhirlTracer[] = []
      const streak = streakTex()
      for (let i = 0; i < 34; i++) {
        const s = makeSprite(streak)
        s.blendMode = 'add'
        s.tint = 0xdff6ff
        this.whirlLayer.addChild(s)
        const t: WhirlTracer = { s, x: 0, y: 0, life: 0, max: 1 }
        this.respawnTracer(t, field, true)
        tracers.push(t)
      }
      this.whirls.push({
        field,
        x: w.x,
        y: w.y,
        radius: w.radius,
        arms,
        rim,
        eye,
        tracers,
        foamAcc: 0,
        bubbleAcc: 0,
      })
    })

    this.buildSky()
  }

  /** Gaviotas que orbitan las islas grandes y sombras de nubes que cruzan el mapa. */
  private buildSky(): void {
    const big = [...this.islands]
      .map((isl) => ({ isl, r: Math.max(...isl.circles.map((c) => Math.hypot(c.dx, c.dy) + c.r)) }))
      .sort((a, b) => b.r - a.r)
      .slice(0, 8)
    let seed = 1
    for (const { isl, r } of big) {
      const n = 2 + (seed % 3)
      for (let i = 0; i < n; i++) {
        const s = makeSprite(gullTex())
        const shadow = makeSprite(gullShadowTex())
        this.skyLayer.addChild(shadow, s)
        this.gulls.push({
          s,
          shadow,
          cx: isl.x,
          cy: isl.y,
          orbit: r + 30 + ((seed * 37) % 90),
          speed: (0.25 + ((seed * 13) % 10) / 40) * (seed % 2 ? 1 : -1),
          phase: seed * 1.3,
          alt: 26 + ((seed * 7) % 20),
        })
        seed++
      }
    }
    const half = this.mapSize / 2
    for (let i = 0; i < 9; i++) {
      const s = makeSprite(cloudShadowTex(100 + i))
      s.scale.set(s.scale.x * (2.2 + (i % 3) * 0.6))
      s.position.set(-half + ((i * 2311) % this.mapSize), -half + ((i * 1777) % this.mapSize))
      s.alpha = 0.9
      this.skyLayer.addChild(s)
      this.clouds.push({ s, vx: 14 + (i % 4) * 3, vy: 5 + (i % 3) * 2 })
    }
  }

  private updateAmbient(dt: number): void {
    const t = this.time
    for (const sh of this.shores) {
      const k = Math.sin(t * 0.9 + sh.phase)
      sh.s.scale.set(sh.base * (1 + k * 0.012))
      sh.s.alpha = 0.55 + k * 0.3
    }
    const reduce = settings.reduceEffects
    for (const w of this.whirls) this.updateWhirl(w, dt, t, reduce)
    for (const g of this.gulls) {
      const a = g.phase + t * g.speed
      const x = g.cx + Math.cos(a) * g.orbit
      const y = g.cy + Math.sin(a) * g.orbit * 0.8
      const heading = a + (g.speed > 0 ? Math.PI / 2 : -Math.PI / 2)
      const flap = 0.8 + Math.abs(Math.sin(t * 7 + g.phase)) * 0.35
      g.s.position.set(x, y - g.alt)
      g.s.rotation = heading + Math.PI / 2
      g.s.scale.set(gullTex().scale * 1.9 * flap, gullTex().scale * 1.9)
      g.shadow.position.set(x + g.alt * 0.6, y + g.alt * 0.4)
      g.shadow.rotation = g.s.rotation
      g.shadow.scale.copyFrom(g.s.scale)
    }
    const half = this.mapSize / 2 + 400
    for (const c of this.clouds) {
      c.s.x += c.vx * dt
      c.s.y += c.vy * dt
      if (c.s.x > half) c.s.x = -half
      if (c.s.y > half) c.s.y = -half
    }
  }

  private aimMarker: Sprite | null = null

  /** Con mortero en cubierta, marca en el agua dónde caerá el disparo. */
  private updateAimMarker(dt: number, state: RoomStateSchema): void {
    const me = state.ships.get(this.myId)
    const eq = me?.alive ? parseJson<EquipMap>(me.equipJson, {}).deck : undefined
    const tier = eq?.branchId === 'mortar' ? findTier('deck', eq.branchId, eq.tierId) : undefined
    if (!me || !tier || tier.effect.kind !== 'cannon' || !this.pred.ready) {
      if (this.aimMarker) this.aimMarker.visible = false
      return
    }
    const tex = targetMarkerTex()
    if (!this.aimMarker) {
      this.aimMarker = makeSprite(tex)
      this.mineLayer.addChild(this.aimMarker)
    }
    const d = computeDerivedStats({
      statLevels: parseJson<Record<string, number>>(me.statsJson, {}),
      equip: parseJson<EquipMap>(me.equipJson, {}),
    })
    const maxRange = tier.effect.range + d.rangeBonus
    const dist = Math.max(90, Math.min(maxRange, this.input.aimDist))
    const m = this.aimMarker
    m.visible = true
    m.position.set(
      this.pred.x + Math.cos(this.input.aimAngle) * dist,
      this.pred.y + Math.sin(this.input.aimAngle) * dist,
    )
    m.scale.set(tex.scale * ((tier.effect.aoe ?? 50) / 58))
    m.rotation += dt * 0.6
    m.tint = this.input.aimDist > maxRange ? 0xffd0a0 : 0xffffff
    m.alpha = 0.35 + Math.sin(this.time * 4) * 0.08
  }

  private respawnTracer(tr: WhirlTracer, f: WhirlpoolField, anywhere = false): void {
    const a = Math.random() * Math.PI * 2
    const q = anywhere ? 0.2 + Math.random() * 0.8 : 0.78 + Math.random() * 0.2
    tr.x = f.x + Math.cos(a) * f.radius * q
    tr.y = f.y + Math.sin(a) * f.radius * q
    tr.max = 2.5 + Math.random() * 3.5
    tr.life = anywhere ? Math.random() * tr.max : tr.max
  }

  private updateWhirl(w: WhirlEntity, dt: number, t: number, reduce: boolean): void {
    for (const a of w.arms) a.s.rotation -= a.speed * dt
    w.rim.rotation -= dt * 0.12
    w.rim.alpha = 0.75 + Math.sin(t * 1.3 + w.x) * 0.2
    w.eye.scale.set(((w.radius * 0.34) / 32) * (1 + Math.sin(t * 2.2 + w.y) * 0.08))
    const visible = this.nearCamera(w.x, w.y, w.radius + 120)
    for (const tr of w.tracers) tr.s.visible = visible && !reduce
    if (!visible) return
    const pools = [w.field]
    if (!reduce) {
      for (const tr of w.tracers) {
        const c = whirlpoolCurrent(pools, tr.x, tr.y)
        tr.x += c.vx * dt
        tr.y += c.vy * dt
        tr.life -= dt
        const q = Math.hypot(tr.x - w.x, tr.y - w.y) / w.radius
        if (tr.life <= 0 || q < 0.1 || q >= 1) {
          this.respawnTracer(tr, w.field)
          continue
        }
        const sp = Math.hypot(c.vx, c.vy)
        const age = 1 - tr.life / tr.max
        tr.s.position.set(tr.x, tr.y)
        tr.s.rotation = Math.atan2(c.vy, c.vx)
        tr.s.scale.set(Math.max(0.15, sp / 260), 0.22 + (1 - q) * 0.12)
        // Aparece y se apaga suave; se hunde (se desvanece) al llegar al ojo
        tr.s.alpha = Math.min(1, age * 4, tr.life) * Math.min(1, (q - 0.1) * 4) * 0.45
      }
    }
    // Espuma en la rompiente y burbujas que suben del ojo
    w.foamAcc += dt * (reduce ? 4 : 10)
    while (w.foamAcc >= 1) {
      w.foamAcc -= 1
      const a = Math.random() * Math.PI * 2
      const rr = w.radius * (0.82 + Math.random() * 0.16)
      this.fx.wake(w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr, a - Math.PI / 2, 50, 3)
    }
    w.bubbleAcc += dt * 1.6
    while (w.bubbleAcc >= 1) {
      w.bubbleAcc -= 1
      const a = Math.random() * Math.PI * 2
      const rr = w.radius * Math.random() * 0.12
      this.fx.ringAt(w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr, 0x5f8fa0, 0.06 + Math.random() * 0.06)
    }
  }

  private nearCamera(x: number, y: number, margin: number): boolean {
    const hw = this.screenW / 2 / this.zoom + margin
    const hh = this.screenH / 2 / this.zoom + margin
    return Math.abs(x - this.camX) < hw && Math.abs(y - this.camY) < hh
  }

  private updateOwnPrediction(dt: number, state: RoomStateSchema, extrap: number): void {
    const me = state.ships.get(this.myId)
    if (!me || !me.alive) {
      this.pred.ready = false
      return
    }
    const tx = me.x + me.vx * extrap
    const ty = me.y + me.vy * extrap
    if (!this.pred.ready) {
      Object.assign(this.pred, { x: tx, y: ty, vx: me.vx, vy: me.vy, angle: me.angle, ready: true })
      return
    }
    const stats = parseJson<Record<string, number>>(me.statsJson, {})
    const equip = parseJson<EquipMap>(me.equipJson, {})
    const d = computeDerivedStats({ statLevels: stats, equip })
    integrateMotion(this.pred, this.input, movementStats(d, me.slowMultiplier), dt)
    // Misma corriente que el servidor: sin tirones al navegar por un remolino
    applyWhirlpools(this.pred, this.whirlFields, dt)
    resolveWorldBounds(this.pred, d.radius, { mapSize: state.mapSize, islands: this.islands })

    const err = Math.hypot(tx - this.pred.x, ty - this.pred.y)
    if (err > 160) {
      Object.assign(this.pred, { x: tx, y: ty, vx: me.vx, vy: me.vy, angle: me.angle })
    } else {
      const k = Math.min(1, dt * 5)
      this.pred.x += (tx - this.pred.x) * k
      this.pred.y += (ty - this.pred.y) * k
      const kv = Math.min(1, dt * 3)
      this.pred.vx += (me.vx - this.pred.vx) * kv
      this.pred.vy += (me.vy - this.pred.vy) * kv
      this.pred.angle += wrapAngle(me.angle - this.pred.angle) * Math.min(1, dt * 4)
    }
  }

  private shipLook(s: Pick<ShipStateSchema, 'skin' | 'team'>): ShipLook {
    const skin = findSkin(s.skin)
    const team = s.team === 'red' || s.team === 'blue' ? TEAM_COLORS[s.team] : null
    return {
      key: `${skin.id}:${s.team}`,
      radius: SHIP_BASE.radius,
      palette: paletteFromSkin(skin, team?.color),
      sail: team ? team.sail : skin.sail,
      emblem: team ? team.color : skin.trim,
      flag: team ? team.color : skin.trim,
      variant: 'ship',
      masts: 2,
    }
  }

  private syncShips(dt: number, state: RoomStateSchema, extrap: number): void {
    const seen = new Set<string>()
    state.ships.forEach((s: ShipStateSchema, id: string) => {
      seen.add(id)
      const lookKey = `${s.skin}:${s.team}`
      let e = this.ships.get(id)
      if (e && e.lookKey !== lookKey) {
        this.removeShip(id, e)
        e = undefined
      }
      if (!e) e = this.createShip(id, s, lookKey)

      const isMe = id === this.myId
      if (!s.alive) {
        if (e.wasAlive) e.sprite.startSinking()
        e.wasAlive = false
      } else if (!e.wasAlive) {
        e.sprite.resetSink()
        e.wasAlive = true
        e.rx = s.x
        e.ry = s.y
        e.rangle = s.angle
      }

      const previewing = isMe && this.preview !== null && s.alive
      const equipKey = previewing ? 'preview:' + this.preview!.key : s.equipJson
      if (e.equipRaw !== equipKey || e.statsRaw !== s.statsJson) {
        e.equipRaw = equipKey
        e.statsRaw = s.statsJson
        const equip = previewing ? this.preview!.equip : parseJson<EquipMap>(s.equipJson, {})
        const stats = parseJson<Record<string, number>>(s.statsJson, {})
        const d = computeDerivedStats({ statLevels: stats, equip })
        e.sprite.setLoadout(equip, d.radius / SHIP_BASE.radius)
      }

      let x: number
      let y: number
      let angle: number
      if (isMe && this.pred.ready && s.alive) {
        x = this.pred.x
        y = this.pred.y
        angle = this.pred.angle
        e.raim = this.input.aimAngle
      } else if (s.alive) {
        const tx = s.x + s.vx * extrap
        const ty = s.y + s.vy * extrap
        if (Math.hypot(tx - e.rx, ty - e.ry) > 250) {
          e.rx = tx
          e.ry = ty
        }
        const k = 1 - Math.exp(-dt * 14)
        e.rx += (tx - e.rx) * k
        e.ry += (ty - e.ry) * k
        e.rangle += wrapAngle(s.angle - e.rangle) * k
        e.raim += wrapAngle(s.aimAngle - e.raim) * (1 - Math.exp(-dt * 12))
        x = e.rx
        y = e.ry
        angle = e.rangle
      } else {
        x = e.rx
        y = e.ry
        angle = e.rangle
      }
      if (isMe) {
        e.rx = x
        e.ry = y
        e.rangle = angle
      }

      const angVel = wrapAngle(angle - e.sprite.lastAngle) / Math.max(dt, 0.001)
      e.sprite.lastAngle = angle
      e.turnRate += (angVel - e.turnRate) * Math.min(1, dt * 8)
      const speed = Math.hypot(s.vx, s.vy)
      const maxSpeed = SHIP_BASE.moveSpeed + 60

      e.sprite.update(dt, {
        x,
        y,
        angle,
        aim: e.raim,
        speed,
        maxSpeed,
        turnRate: e.turnRate,
        protectedFor: s.alive ? Math.max(0, s.spawnProtectedUntil - this.renderT) : 0,
      })
      e.sprite.shadow.visible = e.sprite.root.visible = s.alive || !e.sprite.sinkDone

      if (s.alive) this.emitWake(e, x, y, angle, speed, e.sprite.radius, dt)
      e.sprite.setSlowed(s.alive && (s.status & 1) !== 0)
      if (s.alive && (s.status & 2) !== 0) this.emitFire(e, x, y, angle, e.sprite.radius, dt)

      // Etiquetas y vida (en pantalla, sin rotar)
      const inv = 1 / this.zoom
      const r = e.sprite.radius
      e.label.visible = s.alive && settings.showNames
      e.label.position.set(x, y - r * 1.25 - 14 * inv)
      e.label.scale.set(inv)
      e.nameText.text = s.name
      e.nameText.style.fill = isMe
        ? 0xffe08a
        : s.team === 'red'
          ? 0xffa99c
          : s.team === 'blue'
            ? 0x9fd4ff
            : 0xf2f7fa
      e.tagText.text = `NV ${s.equipLevel}`
      e.tagText.position.set(0, 2)

      const hpFrac = Math.max(0, Math.min(1, s.hp / Math.max(1, s.maxHp)))
      if (s.hp < e.lastHp - 0.5) e.hpVisibleUntil = this.time + 3
      e.lastHp = s.hp
      const showBar = s.alive && (isMe || hpFrac < 0.999 || this.time < e.hpVisibleUntil)
      e.bar.visible = showBar
      if (showBar) {
        e.bar.clear()
        const w = 56
        const h = 6
        e.bar.roundRect(-w / 2 - 1.5, -1.5, w + 3, h + 3, 4).fill({ color: 0x04121a, alpha: 0.75 })
        const col = hpFrac > 0.5 ? 0x5fd98a : hpFrac > 0.25 ? 0xf0c14b : 0xff5a4d
        e.bar.roundRect(-w / 2, 0, w * hpFrac, h, 3).fill({ color: col })
        e.bar.roundRect(-w / 2, 0, w * hpFrac, h / 2, 2).fill({ color: 0xffffff, alpha: 0.18 })
        e.bar.position.set(x, y + r * 1.3 + 6 * inv)
        e.bar.scale.set(inv)
      }

      if (e.teamRing) {
        e.teamRing.position.set(x, y)
        e.teamRing.visible = s.alive
      }
    })

    for (const [id, e] of this.ships) {
      if (!seen.has(id)) this.removeShip(id, e)
    }
  }

  private createShip(id: string, s: ShipStateSchema, lookKey: string): ShipEntity {
    const sprite = new ShipSprite(this.shipLook(s))
    this.shadowLayer.addChild(sprite.shadow)
    this.shipLayer.addChild(sprite.root)
    const label = new Container()
    // El color depende del capitán: compartir TextStyle invalidaría todos los nombres cada fotograma.
    const nameText = new Text({ text: s.name, style: nameStyle.clone(), resolution: 2 })
    nameText.anchor.set(0.5, 1)
    const tagText = new Text({ text: '', style: tagStyle, resolution: 2 })
    tagText.anchor.set(0.5, 0)
    label.addChild(nameText, tagText)
    this.labelLayer.addChild(label)
    const bar = new Graphics()
    this.labelLayer.addChild(bar)
    let teamRing: Graphics | null = null
    if (s.team === 'red' || s.team === 'blue') {
      teamRing = new Graphics()
      teamRing
        .circle(0, 0, SHIP_BASE.radius * 1.9)
        .stroke({ width: 3, color: TEAM_COLORS[s.team].color, alpha: 0.55 })
      this.shadowLayer.addChild(teamRing)
    }
    const e: ShipEntity = {
      sprite,
      label,
      nameText,
      tagText,
      bar,
      teamRing,
      rx: s.x,
      ry: s.y,
      rangle: s.angle,
      raim: s.aimAngle,
      turnRate: 0,
      lastHp: s.hp,
      hpVisibleUntil: 0,
      wakeAcc: 0,
      wasAlive: s.alive,
      lookKey,
      equipRaw: '',
      statsRaw: '',
      fireAcc: 0,
    }
    sprite.lastAngle = s.angle
    this.ships.set(id, e)
    return e
  }

  private removeShip(id: string, e: ShipEntity): void {
    e.sprite.destroy()
    e.label.destroy({ children: true })
    e.bar.destroy()
    e.teamRing?.destroy()
    this.ships.delete(id)
  }

  /** Llamas repartidas por la cubierta de algo que arde. */
  private emitFire(
    e: { fireAcc: number },
    x: number,
    y: number,
    angle: number,
    radius: number,
    dt: number,
  ): void {
    if (!this.nearCamera(x, y, 100)) return
    e.fireAcc += dt * (settings.reduceEffects ? 8 : 20)
    const L = radius * HULL_LENGTH * 0.4
    const W = radius * HULL_BEAM * 0.35
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    while (e.fireAcc >= 1) {
      e.fireAcc -= 1
      const u = (Math.random() * 2 - 1) * L
      const v = (Math.random() * 2 - 1) * W
      this.fx.flame(x + c * u - s * v, y + s * u + c * v, radius / 20)
    }
  }

  private emitWake(
    e: { wakeAcc: number },
    x: number,
    y: number,
    angle: number,
    speed: number,
    radius: number,
    dt: number,
  ): void {
    if (speed < 12) return
    e.wakeAcc += speed * dt * (settings.reduceEffects ? 0.05 : 0.12)
    const L = radius * HULL_LENGTH
    const W = radius * HULL_BEAM
    const sx = x - Math.cos(angle) * L * 0.42
    const sy = y - Math.sin(angle) * L * 0.42
    while (e.wakeAcc >= 1) {
      e.wakeAcc -= 1
      this.fx.wake(sx, sy, angle, speed, W)
      if (speed > 90 && Math.random() < 0.35) {
        this.fx.bowWave(x + Math.cos(angle) * L * 0.45, y + Math.sin(angle) * L * 0.45, angle, speed)
      }
    }
  }

  private syncBosses(dt: number, state: RoomStateSchema, extrap: number): void {
    const seen = new Set<string>()
    state.bosses.forEach((b: BossStateSchema, id: string) => {
      seen.add(id)
      const def = findBossDef(b.archetype)
      const fort = b.kind === 'fort'
      let e = this.bosses.get(id)
      if (!e) {
        let sprite: ShipSprite | FortSprite
        if (fort) {
          sprite = new FortSprite(def.radius)
        } else {
          const look = BOSS_LOOKS[b.archetype] ?? BOSS_LOOKS.guardian_artillero
          const ship = new ShipSprite({
            key: `boss:${b.archetype}`,
            radius: def.radius,
            palette: { hull: look.hull, hullDark: look.dark, deck: look.deck, trim: look.trim },
            sail: look.sail,
            emblem: 0xb03a2e,
            flag: 0x111111,
            variant: look.variant,
            masts: look.masts,
          })
          ship.setLoadout(look.equip, 1)
          sprite = ship
        }
        const aura = new Graphics()
        this.shadowLayer.addChild(aura)
        this.shadowLayer.addChild(sprite.shadow)
        this.bossLayer.addChild(sprite.root)
        const label = new Text({ text: def.name, style: bossNameStyle, resolution: 2 })
        label.anchor.set(0.5, 1)
        if (fort) label.style = fortNameStyle
        const bar = new Graphics()
        this.labelLayer.addChild(label, bar)
        e = {
          sprite,
          fort,
          fireAcc: 0,
          label,
          bar,
          aura,
          rx: b.x,
          ry: b.y,
          rangle: b.angle,
          raim: b.angle,
          lastHp: b.hp,
          wasAlive: b.alive,
          wakeAcc: 0,
        }
        if (!b.alive) e.sprite.startSinking()
        this.bosses.set(id, e)
      }

      if (!b.alive && e.wasAlive) e.sprite.startSinking()
      if (b.alive && !e.wasAlive) {
        e.sprite.resetSink()
        e.rx = b.x
        e.ry = b.y
        if (fort) this.fx.ringAt(b.x, b.y, 0xf0c14b, 1.2)
        else this.fx.splash(b.x, b.y, true)
      }
      e.wasAlive = b.alive

      if (b.alive) {
        const tx = b.x + b.vx * extrap
        const ty = b.y + b.vy * extrap
        const k = 1 - Math.exp(-dt * 12)
        e.rx += (tx - e.rx) * k
        e.ry += (ty - e.ry) * k
        e.rangle += wrapAngle(b.angle - e.rangle) * k
        // Torretas hacia el barco más cercano (los fuertes vigilan siempre su radio)
        let aim = fort ? e.raim + dt * 0.25 : e.rangle
        if (b.state === 'chase' || fort) {
          let best = fort ? def.guardRadius + 60 : Infinity
          state.ships.forEach((s) => {
            if (!s.alive) return
            const d = Math.hypot(s.x - b.x, s.y - b.y)
            if (d < best) {
              best = d
              aim = Math.atan2(s.y - b.y, s.x - b.x)
            }
          })
        }
        e.raim += wrapAngle(aim - e.raim) * Math.min(1, dt * 5)
      }
      const speed = Math.hypot(b.vx, b.vy)
      if (e.sprite instanceof FortSprite) {
        e.sprite.update(dt, { x: e.rx, y: e.ry, aim: e.raim })
        // Las ruinas se quedan en la isla hasta que el fuerte se reconstruye
        e.sprite.root.visible = true
        if (!b.alive && Math.random() < dt * 3 && this.nearCamera(e.rx, e.ry, 80)) {
          this.fx.flame(e.rx + (Math.random() - 0.5) * 30, e.ry + (Math.random() - 0.5) * 30, 0.8)
        }
      } else {
        e.sprite.update(dt, {
          x: e.rx,
          y: e.ry,
          angle: e.rangle,
          aim: e.raim,
          speed,
          maxSpeed: def.moveSpeed,
          turnRate: 0,
          protectedFor: 0,
        })
        const visible = b.alive || !e.sprite.sinkDone
        e.sprite.root.visible = e.sprite.shadow.visible = visible
        if (b.alive) this.emitWake(e, e.rx, e.ry, e.rangle, speed, def.radius, dt)
        e.sprite.setSlowed(b.alive && (b.status & 1) !== 0)
      }
      if (b.alive && (b.status & 2) !== 0)
        this.emitFire(e, e.rx, e.ry, e.rangle, fort ? def.radius * 0.5 : def.radius, dt)

      e.aura.clear()
      if (b.alive) {
        const chasing = b.state === 'chase'
        const pulse = 0.5 + Math.sin(this.time * 4) * 0.5
        if (fort) {
          // Radio de tiro del fuerte: aro discontinuo tenue, rojo si está disparando
          const r = def.guardRadius
          const segs = 48
          for (let i = 0; i < segs; i += 2) {
            const a0 = (i / segs) * Math.PI * 2 + this.time * 0.05
            e.aura.moveTo(e.rx + Math.cos(a0) * r, e.ry + Math.sin(a0) * r)
            e.aura.arc(e.rx, e.ry, r, a0, a0 + Math.PI / segs)
          }
          e.aura.stroke({
            width: 3,
            color: chasing ? 0xff5a4d : 0xf0c14b,
            alpha: chasing ? 0.22 + pulse * 0.18 : 0.12,
          })
        } else {
          e.aura
            .circle(e.rx, e.ry, def.radius * 1.9)
            .fill({ color: chasing ? 0xff3b30 : 0xf0c14b, alpha: chasing ? 0.08 + pulse * 0.06 : 0.04 })
          e.aura.circle(e.rx, e.ry, def.radius * 1.9).stroke({
            width: 2,
            color: chasing ? 0xff5a4d : 0xf0c14b,
            alpha: chasing ? 0.35 + pulse * 0.3 : 0.2,
          })
        }
      }

      const inv = 1 / this.zoom
      const top = fort ? def.radius * 1.35 : def.radius * 1.6
      e.label.visible = b.alive
      e.label.position.set(e.rx, e.ry - top - 22 * inv)
      e.label.scale.set(inv)
      if (b.hp < e.lastHp - 0.5) e.sprite.hitFlash()
      e.lastHp = b.hp
      e.bar.visible = b.alive
      if (b.alive) {
        const w = fort ? 80 : 110
        const frac = Math.max(0, Math.min(1, b.hp / Math.max(1, b.maxHp)))
        e.bar.clear()
        e.bar.roundRect(-w / 2 - 2, -2, w + 4, 11, 5).fill({ color: 0x1a0505, alpha: 0.85 })
        e.bar.roundRect(-w / 2, 0, w * frac, 7, 3).fill({ color: fort ? 0xd08a3a : 0xe0413a })
        e.bar.roundRect(-w / 2, 0, w * frac, 3, 2).fill({ color: 0xffffff, alpha: 0.2 })
        e.bar.position.set(e.rx, e.ry - top - 12 * inv)
        e.bar.scale.set(inv)
      }
    })
    for (const [id, e] of this.bosses) {
      if (seen.has(id)) continue
      e.sprite.destroy()
      e.label.destroy()
      e.bar.destroy()
      e.aura.destroy()
      this.bosses.delete(id)
    }
  }

  private syncFleet(dt: number, state: RoomStateSchema, extrap: number): void {
    const seen = new Set<string>()
    state.fleet.forEach((f: FleetStateSchema, id: string) => {
      seen.add(id)
      let e = this.fleet.get(id)
      if (!e) {
        const owner = state.ships.get(f.ownerShipId)
        const look = FLEET_LOOKS[f.defId] ?? FLEET_LOOKS.battleship
        const skin = findSkin(owner?.skin)
        const team = f.team === 'red' || f.team === 'blue' ? TEAM_COLORS[f.team] : null
        const sprite = new ShipSprite({
          key: `fleet:${f.defId}:${skin.id}:${f.team}`,
          radius: Math.round(SHIP_BASE.radius * look.scale),
          palette: paletteFromSkin(skin, team?.color),
          sail: team ? team.sail : shade(skin.sail, -0.05),
          emblem: null,
          flag: team ? team.color : skin.trim,
          variant: look.variant,
          masts: look.masts,
        })
        sprite.setLoadout(look.equip, 1)
        this.shadowLayer.addChild(sprite.shadow)
        this.fleetLayer.addChild(sprite.root)
        const bar = new Graphics()
        this.labelLayer.addChild(bar)
        e = { sprite, bar, rx: f.x, ry: f.y, rangle: f.angle, lastHp: f.hp, wakeAcc: 0 }
        this.fleet.set(id, e)
      }
      const tx = f.x + f.vx * extrap
      const ty = f.y + f.vy * extrap
      const k = 1 - Math.exp(-dt * 12)
      e.rx += (tx - e.rx) * k
      e.ry += (ty - e.ry) * k
      e.rangle += wrapAngle(f.angle - e.rangle) * k
      const owner = state.ships.get(f.ownerShipId)
      const speed = Math.hypot(f.vx, f.vy)
      const def = findFleetDef(f.defId)
      e.sprite.update(dt, {
        x: e.rx,
        y: e.ry,
        angle: e.rangle,
        aim: owner?.aimAngle ?? e.rangle,
        speed,
        maxSpeed: def?.moveSpeed ?? 150,
        turnRate: 0,
        protectedFor: 0,
      })
      this.emitWake(e, e.rx, e.ry, e.rangle, speed, e.sprite.radius, dt)
      if (f.hp < e.lastHp - 0.5) e.sprite.hitFlash()
      e.lastHp = f.hp
      const frac = f.hp / Math.max(1, f.maxHp)
      e.bar.visible = frac < 0.999
      if (e.bar.visible) {
        e.bar.clear()
        e.bar.roundRect(-16, 0, 32, 4, 2).fill({ color: 0x04121a, alpha: 0.7 })
        e.bar.roundRect(-16, 0, 32 * frac, 4, 2).fill({ color: 0x6cc7f0 })
        e.bar.position.set(e.rx, e.ry + e.sprite.radius * 1.4)
        e.bar.scale.set(1 / this.zoom)
      }
    })
    for (const [id, e] of this.fleet) {
      if (seen.has(id)) continue
      e.sprite.destroy()
      e.bar.destroy()
      this.fleet.delete(id)
    }
  }

  private coinTexFor(kind: string): Tex {
    return kind === 'chest' ? chestTex() : coinTex(kind)
  }

  private syncCoins(dt: number, state: RoomStateSchema): void {
    const seen = new Set<string>()
    state.coins.forEach((c: CoinStateSchema, id: string) => {
      seen.add(id)
      let e = this.coins.get(id)
      if (!e) {
        const def = COIN_DEFS[c.kind as CoinKind]
        const glow = makeSprite(glowTex())
        glow.blendMode = 'add'
        glow.tint = def?.color ?? 0xffd700
        const big = c.kind === 'emerald' || c.kind === 'chest'
        glow.scale.set(big ? 1.4 : c.kind === 'ruby' || c.kind === 'diamond' ? 0.75 : 0.45)
        glow.alpha = 0.5
        const sprite = makeSprite(this.coinTexFor(c.kind))
        this.coinLayer.addChild(glow, sprite)
        e = {
          sprite,
          glow,
          kind: c.kind,
          x: c.x,
          y: c.y,
          phase: Math.random() * Math.PI * 2,
          born: this.time,
        }
        this.coins.set(id, e)
      }
      const age = this.time - e.born
      const pop = Math.min(1, age * 4)
      const bob = Math.sin(this.time * 2.2 + e.phase)
      const baseScale = this.coinTexFor(e.kind).scale * 1.3
      e.sprite.position.set(e.x, e.y + bob * 1.5)
      e.glow.position.set(e.x, e.y)
      if (e.kind === 'chest') {
        // Cofre flotando: se mece sobre el oleaje y brilla en dorado
        e.sprite.rotation = Math.sin(this.time * 1.3 + e.phase) * 0.18
        e.sprite.scale.set(chestTex().scale * 0.95 * pop * (1 + bob * 0.02))
        e.sprite.position.set(e.x, e.y + bob * 2.2)
        e.glow.alpha = 0.4 + (0.5 + bob * 0.5) * 0.35
        e.glow.scale.set(1.5 + bob * 0.15)
        if (Math.random() < dt * 3)
          this.fx.sparkle(e.x + (Math.random() - 0.5) * 30, e.y + (Math.random() - 0.5) * 24, 0xffe08a)
        if (Math.random() < dt * 1.5) this.fx.ringAt(e.x, e.y, 0xffffff, 0.35)
        return
      }
      const gem = e.kind === 'ruby' || e.kind === 'diamond' || e.kind === 'emerald'
      if (gem) {
        e.sprite.rotation = Math.sin(this.time * 0.8 + e.phase) * 0.35
        e.sprite.scale.set(baseScale * pop * (1 + bob * 0.04))
        e.glow.alpha = 0.45 + (0.5 + bob * 0.5) * 0.35
      } else {
        // "giro" de moneda: se aplasta en X
        e.sprite.scale.set(
          baseScale * pop * (0.55 + Math.abs(Math.cos(this.time * 2 + e.phase)) * 0.45),
          baseScale * pop,
        )
        e.glow.alpha = 0.25 + (0.5 + bob * 0.5) * 0.2
      }
      if (e.kind === 'emerald') {
        e.glow.scale.set(1.3 + Math.sin(this.time * 3) * 0.2)
        if (Math.random() < dt * 2)
          this.fx.sparkle(e.x + (Math.random() - 0.5) * 20, e.y + (Math.random() - 0.5) * 20, 0x9ff6c8)
      }
    })
    for (const [id, e] of this.coins) {
      if (seen.has(id)) continue
      e.sprite.destroy()
      e.glow.destroy()
      this.coins.delete(id)
    }
  }

  private syncMines(dt: number, state: RoomStateSchema): void {
    const seen = new Set<string>()
    state.mines.forEach((m: MineStateSchema, id: string) => {
      seen.add(id)
      const own = m.owner === this.myId || (m.team !== '' && m.team === state.ships.get(this.myId)?.team)
      let e = this.mines.get(id)
      if (!e) {
        const oil = !!m.oil
        const sprite = makeSprite(oil ? oilTex() : mineTex(m.armed, own))
        sprite.position.set(m.x, m.y)
        let ring: Graphics | null = null
        if (own || oil) {
          ring = new Graphics()
          ring
            .circle(m.x, m.y, oil ? m.radius : m.radius * 1.6)
            .stroke({ width: 1.5, color: oil ? 0xff8a3a : 0x6cf0ff, alpha: oil ? 0.35 : 0.25 })
          this.mineLayer.addChild(ring)
        }
        this.mineLayer.addChild(sprite)
        this.fx.splash(m.x, m.y)
        e = { sprite, ring, armed: m.armed, own, oil, fireAcc: 0 }
        this.mines.set(id, e)
      }
      const remaining = m.expiresAt - this.renderT
      if (e.oil) {
        // Mancha de aceite ardiendo: crece al caer y se desvanece al consumirse
        const t = oilTex()
        e.sprite.scale.set(t.scale * ((m.radius * 2.3) / 96))
        e.sprite.rotation += dt * 0.05
        e.sprite.alpha = Math.min(1, remaining / 1500)
        if (this.nearCamera(m.x, m.y, m.radius + 60)) {
          e.fireAcc += dt * (settings.reduceEffects ? 6 : 16) * Math.min(1, remaining / 1500)
          while (e.fireAcc >= 1) {
            e.fireAcc -= 1
            const a = Math.random() * Math.PI * 2
            const rr = Math.sqrt(Math.random()) * m.radius * 0.85
            this.fx.flame(m.x + Math.cos(a) * rr, m.y + Math.sin(a) * rr, 0.9)
          }
        }
        return
      }
      if (e.armed !== m.armed) {
        e.armed = m.armed
        const t = mineTex(m.armed, e.own)
        e.sprite.texture = t.texture
      }
      const scaleBase = mineTex(m.armed, e.own).scale * (m.radius / 26)
      e.sprite.scale.set(scaleBase * (1 + Math.sin(this.time * 3 + m.x) * 0.03))
      e.sprite.rotation = Math.sin(this.time + m.y) * 0.2
      e.sprite.alpha = remaining < 1000 ? 0.4 + 0.6 * Math.abs(Math.sin(this.time * 12)) : 1
    })
    for (const [id, e] of this.mines) {
      if (seen.has(id)) continue
      e.sprite.destroy()
      e.ring?.destroy()
      this.mines.delete(id)
    }
  }

  private syncBullets(dt: number, state: RoomStateSchema): void {
    const seen = new Set<string>()
    const ballTex = cannonballTex()
    const streak = streakTex()
    state.bullets.forEach((b: BulletStateSchema, id: string) => {
      seen.add(id)
      const t = (this.renderT - b.t0) / 1000
      const mortar = b.kind === 'mortar'
      const fuse = mortar ? Math.max(0.05, b.fuse / 1000) : 0
      const tt = mortar ? Math.min(t, fuse) : t
      const x = b.x + b.vx * tt
      const y = b.y + b.vy * tt
      let e = this.bullets.get(id)
      if (!e) {
        const angle = Math.atan2(b.vy, b.vx)
        const speed = Math.hypot(b.vx, b.vy)
        let tex: Tex = ballTex
        if (b.kind === 'chain') tex = chainShotTex()
        else if (b.kind === 'fire') tex = fireballTex()
        const ball = makeSprite(tex)
        let baseScale = ballTex.scale * (b.radius / 7.5) * 1.3
        if (b.kind === 'chain') baseScale = tex.scale * (b.radius / 6)
        else if (b.kind === 'fire') {
          baseScale = tex.scale * (b.radius / 11)
          ball.blendMode = 'add'
        }
        ball.scale.set(baseScale)
        if (b.kind === 'coin') ball.tint = 0xffd24a
        const st = makeSprite(streak)
        st.blendMode = 'add'
        st.rotation = angle
        st.scale.set((speed * 0.07) / 60, (b.radius * 2.2) / 12)
        st.tint =
          b.kind === 'boss'
            ? 0xff5a3a
            : b.kind === 'coin'
              ? 0xffd24a
              : b.kind === 'fleet'
                ? 0x8fd8ff
                : b.kind === 'fire'
                  ? 0xff7a1e
                  : b.kind === 'chain'
                    ? 0xb8c6d4
                    : b.owner === this.myId
                      ? 0xffe6b0
                      : 0xffc890
        st.alpha = b.kind === 'boss' || b.kind === 'fire' ? 0.8 : 0.5
        st.visible = !mortar
        let glow: Sprite | null = null
        if (b.kind === 'boss' || b.kind === 'fire' || b.radius >= 7 || mortar) {
          glow = makeSprite(glowTex())
          glow.blendMode = 'add'
          glow.tint = b.kind === 'boss' ? 0xff4a2a : b.kind === 'fire' ? 0xff6a10 : 0xffb060
          glow.scale.set((b.radius / 32) * (b.kind === 'fire' ? 4.5 : 3))
          glow.alpha = mortar ? 0.35 : 0.55
          this.bulletLayer.addChild(glow)
        }
        let shadow: Sprite | null = null
        let marker: Sprite | null = null
        if (mortar) {
          shadow = makeSprite(ballTex)
          shadow.tint = 0x000000
          shadow.alpha = 0.35
          const mt = targetMarkerTex()
          marker = makeSprite(mt)
          const lx = b.x + b.vx * fuse
          const ly = b.y + b.vy * fuse
          marker.position.set(lx, ly)
          marker.scale.set(mt.scale * (Math.max(30, b.aoe) / 58))
          marker.alpha = 0
          // La marca va bajo los barcos, sobre el agua
          this.mineLayer.addChild(marker)
          this.bulletLayer.addChild(shadow)
        }
        this.bulletLayer.addChild(st, ball)
        e = {
          kind: b.kind,
          ball,
          streak: st,
          glow,
          shadow,
          marker,
          baseScale,
          spin: b.kind === 'chain' ? 14 * (Math.random() < 0.5 ? -1 : 1) : 0,
          trailAcc: 0,
          x,
          y,
        }
        this.bullets.set(id, e)

        // Fogonazo y sonido al aparecer la bala
        const size = Math.max(0.6, b.radius / 4.5) * (mortar ? 1.5 : 1)
        this.fx.muzzle(b.x, b.y, angle, size)
        const own = b.owner === this.myId
        const where = own ? { volume: 0.55 } : { x: b.x, y: b.y, volume: 0.45 }
        if (mortar) sound.play('mortar', { ...where, pitch: 1 })
        else if (b.kind === 'fire') sound.play('fire', { ...where, pitch: 1 })
        else if (b.kind === 'chain') sound.play('chain', where)
        else
          sound.play(
            b.radius >= 7 ? 'heavyCannon' : 'cannon',
            own
              ? { volume: 0.55, pitch: 1.2 - Math.min(0.5, b.radius / 20) }
              : { x: b.x, y: b.y, volume: 0.45 },
          )
        const shooter = this.ships.get(b.owner) ?? this.bosses.get(b.owner)
        shooter?.sprite.recoil()
      }
      e.x = x
      e.y = y
      if (mortar) {
        // Parábola: la bala sube y baja; la sombra marca la trayectoria sobre el agua
        const p = Math.min(1, t / fuse)
        const h = Math.sin(Math.PI * p)
        const lift = h * Math.min(140, 40 + fuse * 90)
        e.ball.position.set(x, y - lift)
        e.ball.scale.set(e.baseScale * (1 + h * 0.9))
        e.glow?.position.set(x, y - lift)
        e.shadow!.position.set(x + lift * 0.25, y + lift * 0.15)
        e.shadow!.scale.set(e.baseScale * (1 - h * 0.35))
        e.shadow!.alpha = 0.35 - h * 0.15
        const m = e.marker!
        m.alpha = Math.min(0.9, 0.25 + p * 0.8)
        m.rotation += dt * 1.5
        m.tint = p > 0.75 && Math.sin(this.time * 30) > 0 ? 0xffffff : 0xffb090
      } else {
        e.ball.position.set(x, y)
        e.streak.position.set(x, y)
        e.glow?.position.set(x, y)
        if (e.spin) e.ball.rotation += e.spin * dt
        if (e.kind === 'fire' && this.nearCamera(x, y, 60)) {
          e.ball.scale.set(e.baseScale * (0.85 + Math.random() * 0.3))
          e.trailAcc += dt * (settings.reduceEffects ? 10 : 28)
          while (e.trailAcc >= 1) {
            e.trailAcc -= 1
            this.fx.flame(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6, 0.6)
          }
        }
      }
    })
    for (const [id, e] of this.bullets) {
      if (seen.has(id)) continue
      if (e.kind !== 'mortar') {
        const hitNearby = this.recentHits.some((h) => Math.hypot(h.x - e.x, h.y - e.y) < 60)
        if (!hitNearby) this.fx.splash(e.x, e.y)
      }
      e.ball.destroy()
      e.streak.destroy()
      e.glow?.destroy()
      e.shadow?.destroy()
      e.marker?.destroy()
      this.bullets.delete(id)
    }
  }

  private updateCamera(dt: number, state: RoomStateSchema): void {
    const me = state.ships.get(this.myId)
    let tx = this.camX
    let ty = this.camY
    let hitScale = 1
    if (me) {
      const e = this.ships.get(this.myId)
      const px = me.alive && this.pred.ready ? this.pred.x : (e?.rx ?? me.x)
      const py = me.alive && this.pred.ready ? this.pred.y : (e?.ry ?? me.y)
      tx = px
      ty = py
      if (me.alive) {
        // Anticipación: la cámara se adelanta un poco hacia donde apuntas y hacia donde navegas
        const mx = (this.mouseScreenX - this.screenW / 2) / this.zoom
        const my = (this.mouseScreenY - this.screenH / 2) / this.zoom
        const md = Math.hypot(mx, my)
        const lead = Math.min(110, md * 0.16)
        if (md > 1) {
          tx += (mx / md) * lead
          ty += (my / md) * lead
        }
        tx += this.pred.vx * 0.25
        ty += this.pred.vy * 0.25
      }
      hitScale = e ? e.sprite.radius / SHIP_BASE.radius : 1
    }
    const k = 1 - Math.exp(-dt * 6)
    this.camX += (tx - this.camX) * k
    this.camY += (ty - this.camY) * k

    const base = Math.sqrt((this.screenW * this.screenH) / (1500 * 860))
    let targetZoom = Math.max(0.55, Math.min(2.1, base * 1.32)) / (1 + (hitScale - 1) * 0.7)
    let zoomRate = 2
    if (this.preview && this.pred.ready) {
      // Vista previa de mejora: primer plano del barco, algo por encima de la bandeja
      targetZoom *= 2.1
      zoomRate = 5
      this.camX += (this.pred.x - this.camX) * Math.min(1, dt * 6)
      this.camY += (this.pred.y + (this.screenH * 0.14) / this.zoom - this.camY) * Math.min(1, dt * 6)
    }
    this.zoom += ((this.zoomOverride ?? targetZoom) - this.zoom) * Math.min(1, dt * zoomRate)

    let sx = 0
    let sy = 0
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt)
      const m = this.shakeMag * Math.min(1, this.shakeT * 3)
      sx = (Math.random() - 0.5) * m
      sy = (Math.random() - 0.5) * m
      if (this.shakeT === 0) this.shakeMag = 0
    }

    this.camera.scale.set(this.zoom)
    this.camera.position.set(
      this.screenW / 2 - this.camX * this.zoom + sx,
      this.screenH / 2 - this.camY * this.zoom + sy,
    )
    this.ocean.update(
      dt,
      this.camX - sx / this.zoom,
      this.camY - sy / this.zoom,
      this.zoom,
      this.screenW,
      this.screenH,
    )
  }
}
