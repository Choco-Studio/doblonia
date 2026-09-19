import {
  findBranch,
  findTier,
  statUpgradeCost,
  STAT_DEFS,
  SHIP_BASE,
  SLOT_UNLOCK_LEVEL,
  TOTAL_STAT_POINTS_CAP,
  xpForEquipLevel,
  MAX_EQUIP_LEVEL,
  MAX_LIGHT_FLEET,
  MAX_HEAVY_FLEET,
  findFleetDef,
  COIN_DEFS,
  type SlotId,
  type StatId,
} from '@doblonia/content'
import type { FleetUnit, Ship, World, WorldEvent } from './types.js'
import { nextWorldId, neutralInput, breakSpawnProtection, freshAfflictions } from './types.js'
import { findSpawnPoint, freshStatLevels, respawnCoin, SPAWN_PROTECTION_MS } from './world.js'
import { derived } from './loadout.js'

/** Límite por tipo de barco de flota, además del límite por clase (ligera/pesada). */
const PER_TYPE_LIMIT: Record<string, number> = {
  fishing_boat: 3,
  mine_dropper_fleet: 2,
  battleship: 2,
  man_of_war: 1,
}

function applyEquipXpLevelUps(ship: Ship, events: WorldEvent[]): void {
  while (ship.equipLevel < MAX_EQUIP_LEVEL && ship.equipXp >= xpForEquipLevel(ship.equipLevel + 1)) {
    ship.equipLevel += 1
    ship.equipPicks += 1
    events.push({ type: 'levelUp', shipId: ship.id, level: ship.equipLevel })
  }
}

/** Monedas + experiencia + puntuación. Toda recompensa emitida por el servidor pasa por aquí. */
export function grantReward(world: World, ship: Ship, value: number, events: WorldEvent[]): void {
  ship.coins += value
  ship.equipXp += value
  ship.score += value
  applyEquipXpLevelUps(ship, events)
}

export function stepCoinPickups(world: World, events: WorldEvent[]): void {
  const pickups: { shipId: string; coinId: string }[] = []
  const taken = new Set<string>()

  for (const ship of world.ships.values()) {
    if (!ship.alive) continue
    const r = derived(ship).radius
    for (const [coinId, coin] of world.coins) {
      if (taken.has(coinId)) continue
      const dx = ship.x - coin.x
      const dy = ship.y - coin.y
      if (Math.abs(dx) > 80 || Math.abs(dy) > 80) continue
      if (Math.hypot(dx, dy) <= r + COIN_DEFS[coin.kind].radius + 4) {
        pickups.push({ shipId: ship.id, coinId })
        taken.add(coinId)
      }
    }
  }

  for (const { shipId, coinId } of pickups) {
    const ship = world.ships.get(shipId)
    if (ship) collectCoin(world, ship, coinId, events)
  }

  for (const [coinId, coin] of world.coins) {
    if (coin.lootExpiresAt !== undefined && world.timeMs > coin.lootExpiresAt) world.coins.delete(coinId)
  }
}

export function collectCoin(world: World, ship: Ship, coinId: string, events: WorldEvent[]): void {
  const coin = world.coins.get(coinId)
  if (!coin) return
  world.coins.delete(coinId)
  grantReward(world, ship, coin.value, events)
  breakSpawnProtection(world, ship)
  events.push({ type: 'pickup', shipId: ship.id, coinKind: coin.kind, x: coin.x, y: coin.y })
  if (coin.lootExpiresAt === undefined) respawnCoin(world, coin.kind)
}

export type PurchaseResult = { ok: true } | { ok: false; reason: string }

export function purchaseStat(ship: Ship, statId: StatId): PurchaseResult {
  if (!ship.alive) return { ok: false, reason: 'dead' }
  const level = ship.statLevels[statId] ?? 0
  if (level >= STAT_DEFS[statId].maxLevel) return { ok: false, reason: 'stat_maxed' }
  const total = Object.values(ship.statLevels).reduce((a, b) => a + b, 0)
  if (total >= TOTAL_STAT_POINTS_CAP) return { ok: false, reason: 'cap_reached' }
  const cost = statUpgradeCost(level)
  if (ship.coins < cost) return { ok: false, reason: 'insufficient_funds' }

  ship.coins -= cost
  ship.statLevels[statId] = level + 1
  ship.loadoutVersion++

  if (statId === 'hull') {
    const newMax = derived(ship).maxHp
    ship.maxHp = newMax
    ship.hp = Math.min(newMax, ship.hp + 65)
  }
  return { ok: true }
}

export function equipPick(ship: Ship, slot: SlotId, branchId: string, tierId: string): PurchaseResult {
  if (!ship.alive) return { ok: false, reason: 'dead' }
  if (ship.equipPicks <= 0) return { ok: false, reason: 'no_picks' }
  if (ship.equipLevel < SLOT_UNLOCK_LEVEL[slot]) return { ok: false, reason: 'slot_locked' }

  const current = ship.equip[slot]
  if (!current) {
    const branch = findBranch(slot, branchId)
    if (!branch) return { ok: false, reason: 'unknown_branch' }
    if (branch.tiers[0].id !== tierId) return { ok: false, reason: 'not_entry_tier' }
  } else {
    if (current.branchId !== branchId) return { ok: false, reason: 'branch_locked' }
    const currentTier = findTier(slot, current.branchId, current.tierId)
    if (!currentTier?.nextIds?.includes(tierId)) return { ok: false, reason: 'not_next_tier' }
  }

  ship.equip[slot] = { branchId, tierId }
  ship.equipPicks -= 1
  ship.cooldowns[slot] = 0
  ship.loadoutVersion++
  ship.maxHp = derived(ship).maxHp
  ship.hp = Math.min(ship.hp, ship.maxHp)
  return { ok: true }
}

export function countFleet(
  world: World,
  ship: Ship,
): { light: number; heavy: number; byType: Record<string, number> } {
  const byType: Record<string, number> = {}
  let light = 0
  let heavy = 0
  for (const id of ship.fleetIds) {
    const u = world.fleet.get(id)
    if (!u) continue
    const def = findFleetDef(u.defId)
    if (!def) continue
    byType[def.id] = (byType[def.id] ?? 0) + 1
    if (def.fleetClass === 'light') light++
    else heavy++
  }
  return { light, heavy, byType }
}

export function fleetTypeLimit(defId: string): number {
  return PER_TYPE_LIMIT[defId] ?? 1
}

export function buyFleet(world: World, ship: Ship, defId: string): PurchaseResult & { unitId?: string } {
  if (!ship.alive) return { ok: false, reason: 'dead' }
  const def = findFleetDef(defId)
  if (!def) return { ok: false, reason: 'unknown_fleet' }
  if (ship.coins < def.cost) return { ok: false, reason: 'insufficient_funds' }

  ship.fleetIds = ship.fleetIds.filter((id) => world.fleet.has(id))
  const counts = countFleet(world, ship)
  if (def.fleetClass === 'light' && counts.light >= MAX_LIGHT_FLEET)
    return { ok: false, reason: 'light_fleet_full' }
  if (def.fleetClass === 'heavy' && counts.heavy >= MAX_HEAVY_FLEET)
    return { ok: false, reason: 'heavy_fleet_full' }
  if ((counts.byType[defId] ?? 0) >= fleetTypeLimit(defId)) return { ok: false, reason: 'type_limit' }

  ship.coins -= def.cost
  const slotAngle =
    Math.PI * 0.75 + (ship.fleetIds.length % 4) * (Math.PI / 4) * (ship.fleetIds.length % 2 ? 1 : -1)
  const back = derived(ship).radius * 2.4
  const unit: FleetUnit = {
    id: nextWorldId(world, 'f_'),
    ownerShipId: ship.id,
    team: ship.team,
    defId,
    x: ship.x - Math.cos(ship.angle) * back,
    y: ship.y - Math.sin(ship.angle) * back,
    angle: ship.angle,
    vx: 0,
    vy: 0,
    hp: def.hp,
    maxHp: def.hp,
    cooldown: 0,
    slotAngle,
  }
  world.fleet.set(unit.id, unit)
  ship.fleetIds.push(unit.id)
  return { ok: true, unitId: unit.id }
}

export function resetShipForRespawn(world: World, ship: Ship): void {
  const spawn = findSpawnPoint(world, ship.team)
  ship.x = spawn.x
  ship.y = spawn.y
  ship.angle = Math.atan2(-spawn.y, -spawn.x) + ((world.random() < 0.5 ? 1 : -1) * Math.PI) / 2
  ship.vx = 0
  ship.vy = 0
  ship.statLevels = freshStatLevels()
  ship.equip = {}
  ship.loadoutVersion++
  ship.equipXp = 0
  ship.equipLevel = 1
  ship.equipPicks = 0
  ship.coins = 0
  ship.maxHp = SHIP_BASE.maxHp
  ship.hp = SHIP_BASE.maxHp
  ship.alive = true
  ship.spawnProtectedUntil = world.timeMs + SPAWN_PROTECTION_MS
  ship.input = neutralInput()
  ship.input.aimAngle = ship.angle
  ship.cooldowns = { front: 0, side: 0, deck: 0, rear: 0 }
  ship.coinShotCooldownMs = 0
  ship.score = 0
  ship.lastDamagedBy = null
  ship.lastDamageAt = -99999
  ship.fx = freshAfflictions()
  ship.respawnRequested = false
  ship.lifeStartedAt = world.timeMs
  for (const fid of ship.fleetIds) world.fleet.delete(fid)
  ship.fleetIds = []
}

export function stepRespawns(world: World, events: WorldEvent[]): void {
  for (const ship of world.ships.values()) {
    if (ship.alive || world.timeMs < ship.respawnAt) continue
    if (!ship.isBot && !ship.respawnRequested) continue
    resetShipForRespawn(world, ship)
    events.push({ type: 'spawn', shipId: ship.id, x: ship.x, y: ship.y })
  }
}
