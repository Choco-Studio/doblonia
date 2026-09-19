import { schema, t } from '@colyseus/schema'

/** Estado de red: precisión explícita, valores iniciales y colecciones propias por partida.
 * Las balas sincronizan origen, velocidad y tiempo; el cliente interpola el vuelo
 * mientras el servidor conserva la autoridad de los impactos.
 */

export class ShipStateSchema extends schema(
  {
    id: t.string().default(''),
    name: t.string().default(''),
    team: t.string().default(''),
    skin: t.string().default(''),
    x: t.float32().default(0),
    y: t.float32().default(0),
    vx: t.float32().default(0),
    vy: t.float32().default(0),
    angle: t.float32().default(0),
    aimAngle: t.float32().default(0),
    hp: t.float32().default(0),
    maxHp: t.float32().default(0),
    alive: t.boolean().default(true),
    coins: t.uint32().default(0),
    score: t.uint32().default(0),
    equipXp: t.uint32().default(0),
    equipLevel: t.uint8().default(1),
    equipPicks: t.uint8().default(0),
    spawnProtectedUntil: t.float64().default(0),
    respawnAt: t.float64().default(0),
    lifeStartedAt: t.float64().default(0),
    kills: t.uint16().default(0),
    deaths: t.uint16().default(0),
    killedByName: t.string().default(''),
    statsJson: t.string().default('{}'),
    equipJson: t.string().default('{}'),
    /** Bits: 1 = ralentizado, 2 = ardiendo. */
    status: t.uint8().default(0),
    slowMultiplier: t.float32().default(1),
  },
  'ShipStateSchema',
) {}

export class BulletStateSchema extends schema(
  {
    x: t.float32().default(0),
    y: t.float32().default(0),
    vx: t.float32().default(0),
    vy: t.float32().default(0),
    t0: t.float64().default(0),
    radius: t.float32().default(3),
    kind: t.string().default('ball'),
    owner: t.string().default(''),
    /** Mortero: ms de vuelo hasta el impacto (0 en balas normales). */
    fuse: t.float32().default(0),
    aoe: t.float32().default(0),
  },
  'BulletStateSchema',
) {}

export class MineStateSchema extends schema(
  {
    x: t.float32().default(0),
    y: t.float32().default(0),
    radius: t.float32().default(20),
    armed: t.boolean().default(false),
    owner: t.string().default(''),
    team: t.string().default(''),
    expiresAt: t.float64().default(0),
    oil: t.boolean().default(false),
  },
  'MineStateSchema',
) {}

export class CoinStateSchema extends schema(
  {
    kind: t.string().default('bronze'),
    x: t.float32().default(0),
    y: t.float32().default(0),
    loot: t.boolean().default(false),
  },
  'CoinStateSchema',
) {}

export class IslandStateSchema extends schema(
  {
    id: t.string().default(''),
    x: t.float32().default(0),
    y: t.float32().default(0),
    seed: t.uint32().default(0),
    circlesJson: t.string().default('[]'),
  },
  'IslandStateSchema',
) {}

export class FleetStateSchema extends schema(
  {
    ownerShipId: t.string().default(''),
    team: t.string().default(''),
    defId: t.string().default(''),
    x: t.float32().default(0),
    y: t.float32().default(0),
    vx: t.float32().default(0),
    vy: t.float32().default(0),
    angle: t.float32().default(0),
    hp: t.float32().default(0),
    maxHp: t.float32().default(0),
  },
  'FleetStateSchema',
) {}

export class BossStateSchema extends schema(
  {
    archetype: t.string().default(''),
    x: t.float32().default(0),
    y: t.float32().default(0),
    vx: t.float32().default(0),
    vy: t.float32().default(0),
    angle: t.float32().default(0),
    hp: t.float32().default(0),
    maxHp: t.float32().default(0),
    state: t.string().default('guard'),
    alive: t.boolean().default(true),
    respawnAt: t.float64().default(0),
    homeX: t.float32().default(0),
    homeY: t.float32().default(0),
    kind: t.string().default('boss'),
    status: t.uint8().default(0),
  },
  'BossStateSchema',
) {}

export class WhirlpoolStateSchema extends schema(
  {
    x: t.float32().default(0),
    y: t.float32().default(0),
    radius: t.float32().default(0),
    strength: t.float32().default(0),
  },
  'WhirlpoolStateSchema',
) {}

export class RoomStateSchema extends schema(
  {
    mode: t.string().default('ffa'),
    timeMs: t.float64().default(0),
    mapSize: t.float32().default(0),
    playerCount: t.uint8().default(0),
    scoreRed: t.uint16().default(0),
    scoreBlue: t.uint16().default(0),
    ships: t.map(ShipStateSchema),
    bullets: t.map(BulletStateSchema),
    mines: t.map(MineStateSchema),
    coins: t.map(CoinStateSchema),
    islands: t.array(IslandStateSchema),
    fleet: t.map(FleetStateSchema),
    bosses: t.map(BossStateSchema),
    whirlpools: t.array(WhirlpoolStateSchema),
  },
  'RoomStateSchema',
) {}

/** Mensajes cliente → servidor. */
export interface InputMessage {
  throttle: number
  turn: number
  aimAngle: number
  aimDist: number
  firing: boolean
  fireCoin: boolean
  seq: number
}

export interface JoinOptions {
  name?: string
  skin?: string
}

export interface ActionResult {
  action: 'buyStat' | 'equipPick' | 'buyFleet'
  ok: boolean
  reason?: string
}
