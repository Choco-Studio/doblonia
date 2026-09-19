import type { BossArchetypeId, CoinKind, SlotId, StatId, TeamId } from '@doblonia/content'

export type GameMode = 'ffa' | 'tdm'

export interface ShipInput {
  throttle: number // -1..1, W/S
  turn: number // -1..1, A/D
  aimAngle: number // radianes
  /** Distancia del punto de mira (para el mortero). */
  aimDist: number
  firing: boolean
  fireCoin: boolean
  seq: number
}

export function neutralInput(): ShipInput {
  return { throttle: 0, turn: 0, aimAngle: 0, aimDist: 300, firing: false, fireCoin: false, seq: 0 }
}

export interface EquippedWeapon {
  branchId: string
  tierId: string
}

export type BotProfile = 'gunner' | 'rammer' | 'turret' | 'skirmisher' | 'burner' | 'mortarist'

export interface BotMemory {
  profile: BotProfile
  wanderAngle: number
  wanderUntil: number
  aimError: number
  /** Retraso humano antes de abrir fuego tras cambiar de objetivo. */
  reactionAt: number
  targetId: string | null
  /** Detección de atasco: segundos con poca velocidad pese a acelerar. */
  stuckTimer: number
  unstickUntil: number
  unstickTurn: number
  /** Embestidor: se separa tras el choque para volver a cargar con velocidad. */
  ramBackoffUntil?: number
}

/** Estados alterados comunes a barcos y jefes. */
export interface Afflictions {
  slowUntil: number
  slowMult: number
  burnUntil: number
  burnDps: number
  burnBy: string | null
  burnAcc: number
}

export function freshAfflictions(): Afflictions {
  return { slowUntil: 0, slowMult: 1, burnUntil: 0, burnDps: 0, burnBy: null, burnAcc: 0 }
}

export interface Ship {
  id: string
  ownerSessionId: string | null
  name: string
  isBot: boolean
  team: TeamId
  skin: string
  x: number
  y: number
  angle: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  alive: boolean
  coins: number
  statLevels: Record<StatId, number>
  equip: Partial<Record<SlotId, EquippedWeapon>>
  loadoutVersion: number
  equipXp: number
  equipLevel: number
  equipPicks: number
  spawnProtectedUntil: number
  input: ShipInput
  cooldowns: Record<SlotId, number>
  coinShotCooldownMs: number
  lastDamageAt: number
  lastDamagedBy: string | null
  fleetIds: string[]
  respawnAt: number
  respawnRequested: boolean
  kills: number
  deaths: number
  score: number
  lifeStartedAt: number
  killedByName: string
  fx: Afflictions
  botState?: BotMemory
}

export type BulletKind = 'ball' | 'coin' | 'boss' | 'fleet' | 'chain' | 'fire' | 'mortar'

export interface Bullet {
  id: string
  ownerShipId: string
  team: TeamId
  kind: BulletKind
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  radius: number
  remainingRange: number
  slow?: { mult: number; ms: number }
  burn?: { dps: number; ms: number }
  /** Mortero: explota en área al llegar a su destino. */
  aoe?: number
  landAt?: number
}

export interface Mine {
  id: string
  ownerShipId: string
  team: TeamId
  x: number
  y: number
  damage: number
  radius: number
  placedAt: number
  expiresAt: number
  armed: boolean
  /** Mancha de aceite ardiente: no explota, quema a quien la cruza. */
  oil?: { dps: number; ms: number }
}

export interface Coin {
  id: string
  kind: CoinKind
  x: number
  y: number
  value: number
  /** Botín soltado por un barco hundido: no reaparece al recogerse y caduca. */
  lootExpiresAt?: number
}

export interface IslandCircle {
  dx: number
  dy: number
  r: number
}

export interface Island {
  id: string
  x: number
  y: number
  circles: IslandCircle[]
  seed: number
}

export interface FleetUnit {
  id: string
  ownerShipId: string
  team: TeamId
  defId: string
  x: number
  y: number
  angle: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  cooldown: number
  slotAngle: number
}

export interface Boss {
  id: string
  archetype: BossArchetypeId
  x: number
  y: number
  angle: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  homeX: number
  homeY: number
  weaponCooldowns: number[]
  targetShipId?: string
  state: 'guard' | 'chase' | 'return'
  lastDamageAt: number
  lastHitBy: string | null
  wanderAngle: number
  wanderUntil: number
  alive: boolean
  respawnAt: number
  contactCooldownMs: number
  fx: Afflictions
}

/** Remolino: arrastra y hace girar a los barcos; su núcleo daña. */
export interface Whirlpool {
  id: string
  x: number
  y: number
  radius: number
  strength: number
}

export type WorldEvent =
  | {
      type: 'hit'
      x: number
      y: number
      damage: number
      targetKind: 'ship' | 'boss' | 'fleet'
      targetId: string
      sourceId: string | null
    }
  | {
      type: 'death'
      shipId: string
      x: number
      y: number
      killedByShipId?: string
      victimName: string
      killerName: string
    }
  | {
      type: 'bossDeath'
      bossId: string
      archetype: BossArchetypeId
      x: number
      y: number
      killedByShipId: string | null
      killerName: string
      reward: number
    }
  | { type: 'bossSpawn'; bossId: string; archetype: BossArchetypeId }
  | { type: 'pickup'; shipId: string; coinKind: CoinKind; x: number; y: number }
  | { type: 'mineExplode'; x: number; y: number; radius: number }
  | { type: 'shot'; x: number; y: number; angle: number }
  | { type: 'ramHit'; x: number; y: number; damage: number }
  | { type: 'spawn'; shipId: string; x: number; y: number }
  | { type: 'levelUp'; shipId: string; level: number }
  | { type: 'fleetLost'; ownerShipId: string; x: number; y: number }
  | { type: 'splash'; x: number; y: number }
  | { type: 'mortarBlast'; x: number; y: number; radius: number }
  | { type: 'chest'; x: number; y: number }

export interface World {
  seed: number
  random: () => number
  mode: GameMode
  timeMs: number
  mapSize: number
  ships: Map<string, Ship>
  bullets: Map<string, Bullet>
  mines: Map<string, Mine>
  coins: Map<string, Coin>
  islands: Island[]
  whirlpools: Whirlpool[]
  fleet: Map<string, FleetUnit>
  bosses: Map<string, Boss>
  ramCooldowns: Map<string, number>
  emeraldCoinId: string | null
  lastBotEconomyTick: number
  teamScores: { red: number; blue: number }
  nextChestAt: number
  pendingEvents: WorldEvent[]
  _seq: number
}

export function nextWorldId(world: World, prefix: string): string {
  world._seq += 1
  return `${prefix}${world._seq.toString(36)}`
}

/** Disparar, embestir o recoger una recompensa rompe la protección de reaparición. */
export function breakSpawnProtection(world: World, ship: Ship): void {
  if (ship.spawnProtectedUntil > world.timeMs) ship.spawnProtectedUntil = world.timeMs
}

/** En TDM, dos entidades del mismo equipo no se dañan. En FFA solo el propio dueño es aliado. */
export function areAllies(
  world: World,
  teamA: TeamId,
  ownerA: string,
  teamB: TeamId,
  ownerB: string,
): boolean {
  if (ownerA === ownerB) return true
  if (world.mode === 'tdm' && teamA !== '' && teamA === teamB) return true
  return false
}
