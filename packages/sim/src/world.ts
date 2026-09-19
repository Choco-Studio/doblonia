import {
  COMMON_COIN_KINDS,
  CENTER_COIN_KINDS,
  COIN_DEFS,
  SHIP_BASE,
  STAT_ORDER,
  BOSS_DEFS,
  FORT,
  DEFAULT_SKIN,
  type BossDef,
  type StatId,
  type TeamId,
} from '@doblonia/content'
import type { Boss, Coin, GameMode, Island, Ship, World, WorldEvent } from './types.js'
import { nextWorldId, neutralInput, freshAfflictions } from './types.js'
import { createRandom } from './random.js'

export const MAP_SIZE = 5600
export const CENTER_RADIUS = 1000
export const TARGET_COMMON_COINS = 320
export const TARGET_CENTER_COINS = 34
export const SPAWN_PROTECTION_MS = 5000
const ISLAND_COUNT = 26
const WHIRLPOOL_COUNT = 3
const FORT_COUNT = 5
const MAX_CHESTS = 6
const CHEST_INTERVAL_MS = 18000

export function createWorld(mode: GameMode = 'ffa', seed = Math.floor(Math.random() * 4294967296)): World {
  const world: World = {
    seed: seed >>> 0,
    random: createRandom(seed),
    mode,
    timeMs: 0,
    mapSize: MAP_SIZE,
    ships: new Map(),
    bullets: new Map(),
    mines: new Map(),
    coins: new Map(),
    islands: [],
    whirlpools: [],
    fleet: new Map(),
    bosses: new Map(),
    ramCooldowns: new Map(),
    emeraldCoinId: null,
    lastBotEconomyTick: 0,
    teamScores: { red: 0, blue: 0 },
    nextChestAt: 8000,
    pendingEvents: [],
    _seq: 0,
  }

  generateIslands(world)
  generateWhirlpools(world)
  for (let i = 0; i < TARGET_COMMON_COINS; i++) spawnRandomCoin(world, false)
  if (mode === 'ffa') for (let i = 0; i < TARGET_CENTER_COINS; i++) spawnRandomCoin(world, true)
  spawnEmerald(world)
  if (mode === 'ffa') spawnBosses(world)
  spawnForts(world)

  return world
}

function rand(world: World, min: number, max: number): number {
  return min + world.random() * (max - min)
}

function generateIslands(world: World): void {
  const half = world.mapSize / 2
  const placed: { x: number; y: number }[] = []
  for (let i = 0; i < ISLAND_COUNT; i++) {
    let x = 0
    let y = 0
    let ok = false
    for (let tries = 0; tries < 80 && !ok; tries++) {
      x = rand(world, -half + 340, half - 340)
      y = rand(world, -half + 340, half - 340)
      ok = Math.hypot(x, y) > CENTER_RADIUS + 300 && placed.every((p) => Math.hypot(p.x - x, p.y - y) > 560)
    }
    if (!ok) continue
    placed.push({ x, y })

    const big = world.random() < 0.35
    const circleCount = big ? 5 + Math.floor(world.random() * 3) : 2 + Math.floor(world.random() * 3)
    const spread = big ? 110 : 60
    const circles = []
    for (let c = 0; c < circleCount; c++) {
      circles.push({
        dx: rand(world, -spread, spread),
        dy: rand(world, -spread, spread),
        r: big ? rand(world, 60, 110) : rand(world, 40, 80),
      })
    }
    const island: Island = {
      id: nextWorldId(world, 'isl_'),
      x,
      y,
      circles,
      seed: Math.floor(world.random() * 1e9),
    }
    world.islands.push(island)
  }
}

function generateWhirlpools(world: World): void {
  const half = world.mapSize / 2
  for (let i = 0; i < WHIRLPOOL_COUNT; i++) {
    for (let tries = 0; tries < 60; tries++) {
      const a = (i / WHIRLPOOL_COUNT) * Math.PI * 2 + rand(world, -0.6, 0.6)
      const r = rand(world, CENTER_RADIUS + 450, half - 600)
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (isInsideAnyIsland(world, x, y, 330)) continue
      if (world.whirlpools.some((w) => Math.hypot(w.x - x, w.y - y) < 900)) continue
      world.whirlpools.push({
        id: nextWorldId(world, 'wp_'),
        x,
        y,
        radius: rand(world, 210, 260),
        strength: rand(world, 150, 190),
      })
      break
    }
  }
}

export function isInsideAnyIsland(world: Pick<World, 'islands'>, x: number, y: number, margin = 0): boolean {
  for (const island of world.islands) {
    if (Math.abs(x - island.x) > 420 || Math.abs(y - island.y) > 420) continue
    for (const c of island.circles) {
      if (Math.hypot(x - (island.x + c.dx), y - (island.y + c.dy)) < c.r + margin) return true
    }
  }
  return false
}

/** Devuelve la normal de salida de la isla más penetrada, o null si no hay contacto. */
export function islandContact(
  world: Pick<World, 'islands'>,
  x: number,
  y: number,
  radius: number,
): { nx: number; ny: number; depth: number } | null {
  let best: { nx: number; ny: number; depth: number } | null = null
  for (const island of world.islands) {
    if (Math.abs(x - island.x) > 420 || Math.abs(y - island.y) > 420) continue
    for (const c of island.circles) {
      const cx = island.x + c.dx
      const cy = island.y + c.dy
      const d = Math.hypot(x - cx, y - cy)
      const depth = c.r + radius - d
      if (depth > 0 && (!best || depth > best.depth)) {
        best = { nx: (x - cx) / (d || 1), ny: (y - cy) / (d || 1), depth }
      }
    }
  }
  return best
}

function nearWhirlpool(world: World, x: number, y: number, margin: number): boolean {
  return world.whirlpools.some((w) => Math.hypot(w.x - x, w.y - y) < w.radius + margin)
}

function randomFreePoint(world: World, minR: number, maxR: number): { x: number; y: number } {
  for (let attempt = 0; attempt < 50; attempt++) {
    const angle = world.random() * Math.PI * 2
    const r = Math.sqrt(rand(world, minR * minR, maxR * maxR))
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    if (Math.abs(x) > world.mapSize / 2 - 80 || Math.abs(y) > world.mapSize / 2 - 80) continue
    if (isInsideAnyIsland(world, x, y, 40)) continue
    if (nearWhirlpool(world, x, y, -60)) continue
    return { x, y }
  }
  return { x: rand(world, -minR, minR), y: rand(world, -minR, minR) }
}

function spawnRandomCoin(world: World, center: boolean): void {
  const pool = center ? CENTER_COIN_KINDS : COMMON_COIN_KINDS
  const weights = center ? [0.6, 0.4] : [0.6, 0.28, 0.12]
  let roll = world.random()
  let idx = 0
  for (; idx < weights.length - 1; idx++) {
    if (roll < weights[idx]) break
    roll -= weights[idx]
  }
  const kind = pool[idx]
  const pos = center
    ? randomFreePoint(world, 60, CENTER_RADIUS - 60)
    : randomFreePoint(world, CENTER_RADIUS + 80, world.mapSize * 0.7)
  const coin: Coin = { id: nextWorldId(world, 'c_'), kind, x: pos.x, y: pos.y, value: COIN_DEFS[kind].value }
  world.coins.set(coin.id, coin)
}

export function spawnEmerald(world: World): void {
  const pos = randomFreePoint(world, 400, world.mapSize / 2 - 300)
  const coin: Coin = {
    id: nextWorldId(world, 'c_'),
    kind: 'emerald',
    x: pos.x,
    y: pos.y,
    value: COIN_DEFS.emerald.value,
  }
  world.coins.set(coin.id, coin)
  world.emeraldCoinId = coin.id
}

export function respawnCoin(world: World, kind: Coin['kind']): void {
  if (kind === 'emerald') spawnEmerald(world)
  else if (kind === 'chest') return
  else if ((kind === 'ruby' || kind === 'diamond') && world.mode === 'tdm') spawnRandomCoin(world, false)
  else spawnRandomCoin(world, kind === 'ruby' || kind === 'diamond')
}

/** Cofres a la deriva: aparecen cada cierto tiempo en mar abierto y desaparecen si nadie los recoge. */
export function stepChests(world: World, events: WorldEvent[]): void {
  if (world.timeMs < world.nextChestAt) return
  world.nextChestAt = world.timeMs + CHEST_INTERVAL_MS
  let chests = 0
  for (const c of world.coins.values()) if (c.kind === 'chest') chests++
  if (chests >= MAX_CHESTS) return
  const pos = randomFreePoint(world, CENTER_RADIUS + 300, world.mapSize / 2 - 200)
  const coin: Coin = {
    id: nextWorldId(world, 'ch_'),
    kind: 'chest',
    x: pos.x,
    y: pos.y,
    value: COIN_DEFS.chest.value,
    lootExpiresAt: world.timeMs + 90000,
  }
  world.coins.set(coin.id, coin)
  events.push({ type: 'chest', x: pos.x, y: pos.y })
}

/** Suelta monedas del botín alrededor de un punto (barco hundido). */
export function dropLoot(world: World, x: number, y: number, totalValue: number): void {
  let remaining = Math.min(600, Math.floor(totalValue))
  let n = 0
  while (remaining >= 10 && n < 18) {
    const kind =
      remaining >= 30 && world.random() < 0.4
        ? 'gold'
        : remaining >= 20 && world.random() < 0.5
          ? 'silver'
          : 'bronze'
    const value = COIN_DEFS[kind].value
    const a = world.random() * Math.PI * 2
    const r = 20 + world.random() * 70
    const cx = x + Math.cos(a) * r
    const cy = y + Math.sin(a) * r
    if (!isInsideAnyIsland(world, cx, cy, 10)) {
      const coin: Coin = {
        id: nextWorldId(world, 'l_'),
        kind,
        x: cx,
        y: cy,
        value,
        lootExpiresAt: world.timeMs + 25000,
      }
      world.coins.set(coin.id, coin)
    }
    remaining -= value
    n++
  }
}

function makeBoss(world: World, def: BossDef, x: number, y: number, angle: number): Boss {
  return {
    id: nextWorldId(world, def.kind === 'fort' ? 'fort_' : 'boss_'),
    archetype: def.id,
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    hp: def.hp,
    maxHp: def.hp,
    homeX: x,
    homeY: y,
    weaponCooldowns: def.weapons.map(() => 0),
    state: 'guard',
    lastDamageAt: -99999,
    lastHitBy: null,
    wanderAngle: world.random() * Math.PI * 2,
    wanderUntil: 0,
    alive: true,
    respawnAt: 0,
    contactCooldownMs: 0,
    fx: freshAfflictions(),
  }
}

function spawnBosses(world: World): void {
  const n = BOSS_DEFS.length
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + Math.PI / 6
    const r = CENTER_RADIUS * 0.5
    const boss = makeBoss(world, BOSS_DEFS[i], Math.cos(angle) * r, Math.sin(angle) * r, angle + Math.PI / 2)
    world.bosses.set(boss.id, boss)
  }
}

/** Fuertes en la orilla de las islas más grandes, mirando al mar abierto. */
function spawnForts(world: World): void {
  // Islas grandes, pero repartidas por el mapa: nunca dos fuertes a menos de 1500 entre sí
  const sorted = [...world.islands].sort((a, b) => area(b) - area(a))
  const chosen: Island[] = []
  for (const minGap of [1500, 1000, 0]) {
    for (const isl of sorted) {
      if (chosen.length >= FORT_COUNT) break
      if (chosen.includes(isl)) continue
      if (chosen.every((c) => Math.hypot(c.x - isl.x, c.y - isl.y) >= minGap)) chosen.push(isl)
    }
  }
  for (const isl of chosen) {
    const cx = isl.circles.reduce((s, c) => s + c.dx, 0) / isl.circles.length
    const cy = isl.circles.reduce((s, c) => s + c.dy, 0) / isl.circles.length
    // La orilla más alejada del centro del mapa: el fuerte defiende la ruta exterior.
    let best: { x: number; y: number; score: number } | null = null
    for (const c of isl.circles) {
      const dx = c.dx - cx
      const dy = c.dy - cy
      const d = Math.hypot(dx, dy) || 1
      const px = isl.x + c.dx + (dx / d) * (c.r - 16)
      const py = isl.y + c.dy + (dy / d) * (c.r - 16)
      const score = Math.hypot(px, py)
      if (!best || score > best.score) best = { x: px, y: py, score }
    }
    if (!best) continue
    const fort = makeBoss(world, FORT, best.x, best.y, Math.atan2(best.y - isl.y, best.x - isl.x))
    world.bosses.set(fort.id, fort)
  }
}

function area(isl: Island): number {
  return isl.circles.reduce((s, c) => s + c.r * c.r, 0)
}

export function freshStatLevels(): Record<StatId, number> {
  const levels: Partial<Record<StatId, number>> = {}
  for (const id of STAT_ORDER) levels[id] = 0
  return levels as Record<StatId, number>
}

export function findSpawnPoint(world: World, team: TeamId = ''): { x: number; y: number } {
  const half = world.mapSize / 2
  for (let attempt = 0; attempt < 50; attempt++) {
    let x: number
    let y: number
    if (world.mode === 'tdm' && team) {
      const side = team === 'red' ? -1 : 1
      x = side * rand(world, half - 700, half - 200)
      y = rand(world, -half + 300, half - 300)
    } else {
      const angle = world.random() * Math.PI * 2
      const r = rand(world, CENTER_RADIUS + 420, half - 260)
      x = Math.cos(angle) * r
      y = Math.sin(angle) * r
      if (Math.abs(x) > half - 150 || Math.abs(y) > half - 150) continue
    }
    if (isInsideAnyIsland(world, x, y, 70)) continue
    if (nearWhirlpool(world, x, y, 250)) continue
    let tooClose = false
    for (const boss of world.bosses.values()) {
      if (boss.alive && Math.hypot(boss.x - x, boss.y - y) < (boss.archetype === 'fort' ? 600 : 750))
        tooClose = true
    }
    for (const ship of world.ships.values()) {
      if (!ship.alive) continue
      if (world.mode === 'tdm' && ship.team === team) continue
      if (Math.hypot(ship.x - x, ship.y - y) < 500) tooClose = true
    }
    if (!tooClose) return { x, y }
  }
  return { x: rand(world, -half / 2, half / 2), y: rand(world, -half / 2, half / 2) }
}

export function createShip(
  world: World,
  id: string,
  name: string,
  ownerSessionId: string | null,
  isBot: boolean,
  team: TeamId = '',
  skin: string = DEFAULT_SKIN,
): Ship {
  const spawn = findSpawnPoint(world, team)
  const ship: Ship = {
    id,
    ownerSessionId,
    name,
    isBot,
    team,
    skin,
    x: spawn.x,
    y: spawn.y,
    angle: Math.atan2(-spawn.y, -spawn.x) + ((world.random() < 0.5 ? 1 : -1) * Math.PI) / 2,
    vx: 0,
    vy: 0,
    hp: SHIP_BASE.maxHp,
    maxHp: SHIP_BASE.maxHp,
    alive: true,
    coins: 0,
    statLevels: freshStatLevels(),
    equip: {},
    loadoutVersion: 0,
    equipXp: 0,
    equipLevel: 1,
    equipPicks: 0,
    spawnProtectedUntil: world.timeMs + SPAWN_PROTECTION_MS,
    input: neutralInput(),
    cooldowns: { front: 0, side: 0, deck: 0, rear: 0 },
    coinShotCooldownMs: 0,
    lastDamageAt: -99999,
    lastDamagedBy: null,
    fleetIds: [],
    respawnAt: 0,
    respawnRequested: false,
    kills: 0,
    deaths: 0,
    score: 0,
    lifeStartedAt: world.timeMs,
    killedByName: '',
    fx: freshAfflictions(),
  }
  ship.input.aimAngle = ship.angle
  world.ships.set(id, ship)
  return ship
}
