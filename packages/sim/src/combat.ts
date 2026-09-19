import { findBossDef, findFleetDef } from '@doblonia/content'
import type { Afflictions, Boss, Bullet, FleetUnit, Ship, World, WorldEvent } from './types.js'
import { applyBurn, applySlow } from './status.js'
import { breakSpawnProtection, areAllies } from './types.js'
import { dropLoot, isInsideAnyIsland } from './world.js'
import { derived } from './loadout.js'
import { grantReward } from './economy.js'

const RAM_COOLDOWN_MS = 500
const RAM_TRIGGER_SPEED = 45
export const RESPAWN_DELAY_MS = 2000
const FLEET_RADIUS = 16

export function nameOf(world: World, id: string | null | undefined): string {
  if (!id) return 'el mar'
  const ship = world.ships.get(id)
  if (ship) return ship.name
  const boss = world.bosses.get(id)
  if (boss) return findBossDef(boss.archetype).name
  return 'el mar'
}

export function killShip(
  world: World,
  ship: Ship,
  killedByShipId: string | null,
  events: WorldEvent[],
): void {
  if (!ship.alive) return
  const killerName = nameOf(world, killedByShipId)
  events.push({
    type: 'death',
    shipId: ship.id,
    x: ship.x,
    y: ship.y,
    killedByShipId: killedByShipId ?? undefined,
    victimName: ship.name,
    killerName,
  })
  ship.deaths += 1
  ship.alive = false
  ship.killedByName = killerName
  ship.respawnAt = world.timeMs + RESPAWN_DELAY_MS
  ship.respawnRequested = ship.isBot
  ship.vx = 0
  ship.vy = 0

  for (const fid of ship.fleetIds) {
    const unit = world.fleet.get(fid)
    if (unit) events.push({ type: 'fleetLost', ownerShipId: ship.id, x: unit.x, y: unit.y })
    world.fleet.delete(fid)
  }
  ship.fleetIds = []

  dropLoot(world, ship.x, ship.y, 20 + ship.score * 0.3)

  const killer = killedByShipId ? world.ships.get(killedByShipId) : undefined
  if (killer && killer.alive && killer.id !== ship.id) {
    const reward = Math.round(40 + Math.min(800, ship.score * 0.25))
    grantReward(world, killer, reward, events)
    killer.kills += 1
    if (world.mode === 'tdm' && killer.team) world.teamScores[killer.team] += 1
  }
}

export function damageShip(
  world: World,
  ship: Ship,
  amount: number,
  sourceId: string | null,
  events: WorldEvent[],
): void {
  if (!ship.alive || amount <= 0) return
  if (world.timeMs < ship.spawnProtectedUntil) return
  ship.hp -= amount
  ship.lastDamageAt = world.timeMs
  if (sourceId) ship.lastDamagedBy = sourceId
  events.push({
    type: 'hit',
    x: ship.x,
    y: ship.y,
    damage: amount,
    targetKind: 'ship',
    targetId: ship.id,
    sourceId,
  })
  if (ship.hp <= 0) killShip(world, ship, sourceId, events)
}

export function killBoss(world: World, boss: Boss, events: WorldEvent[]): void {
  if (!boss.alive) return
  const def = findBossDef(boss.archetype)
  boss.alive = false
  boss.hp = 0
  boss.respawnAt = world.timeMs + def.respawnMs
  const killer = boss.lastHitBy ? world.ships.get(boss.lastHitBy) : undefined
  events.push({
    type: 'bossDeath',
    bossId: boss.id,
    archetype: boss.archetype,
    x: boss.x,
    y: boss.y,
    killedByShipId: killer?.id ?? null,
    killerName: killer?.name ?? 'el mar',
    reward: def.rewardCoins,
  })
  if (killer && killer.alive) grantReward(world, killer, def.rewardCoins, events)
  dropLoot(world, boss.x, boss.y, 400)
}

export function damageBoss(
  world: World,
  boss: Boss,
  amount: number,
  sourceShipId: string | null,
  events: WorldEvent[],
): void {
  if (!boss.alive || amount <= 0) return
  boss.hp -= amount
  boss.lastDamageAt = world.timeMs
  if (sourceShipId && world.ships.has(sourceShipId)) boss.lastHitBy = sourceShipId
  events.push({
    type: 'hit',
    x: boss.x,
    y: boss.y,
    damage: amount,
    targetKind: 'boss',
    targetId: boss.id,
    sourceId: sourceShipId,
  })
  if (boss.hp <= 0) killBoss(world, boss, events)
}

export function damageFleet(
  world: World,
  unit: FleetUnit,
  amount: number,
  sourceId: string | null,
  events: WorldEvent[],
): void {
  unit.hp -= amount
  events.push({
    type: 'hit',
    x: unit.x,
    y: unit.y,
    damage: amount,
    targetKind: 'fleet',
    targetId: unit.id,
    sourceId,
  })
  if (unit.hp <= 0) {
    world.fleet.delete(unit.id)
    const owner = world.ships.get(unit.ownerShipId)
    if (owner) owner.fleetIds = owner.fleetIds.filter((id) => id !== unit.id)
    events.push({ type: 'fleetLost', ownerShipId: unit.ownerShipId, x: unit.x, y: unit.y })
  }
}

function applyOnHit(world: World, bullet: Bullet, fx: Afflictions): void {
  if (bullet.slow) applySlow(fx, world.timeMs, bullet.slow.mult, bullet.slow.ms)
  if (bullet.burn)
    applyBurn(
      fx,
      world.timeMs,
      bullet.burn.dps,
      bullet.burn.ms,
      bullet.kind === 'boss' ? null : bullet.ownerShipId,
    )
}

export function resolveBulletCollisions(world: World, events: WorldEvent[]): void {
  for (const [bulletId, bullet] of world.bullets) {
    // El mortero vuela por encima de todo: se resuelve al aterrizar.
    if (bullet.kind === 'mortar') continue

    let consumed = false
    const bulletIsBoss = bullet.kind === 'boss'

    // Jefes y fuertes primero: los fuertes están en la orilla y la isla no debe tapar sus impactos.
    if (!bulletIsBoss) {
      for (const boss of world.bosses.values()) {
        if (!boss.alive) continue
        const r = findBossDef(boss.archetype).radius
        if (Math.hypot(boss.x - bullet.x, boss.y - bullet.y) <= r + bullet.radius) {
          damageBoss(world, boss, bullet.damage, bullet.ownerShipId, events)
          if (bullet.burn) applyOnHit(world, { ...bullet, slow: undefined }, boss.fx)
          consumed = true
          break
        }
      }
      if (consumed) {
        world.bullets.delete(bulletId)
        continue
      }
    }

    // Justo delante de un fuerte la isla no frena las balas: el fuerte sobresale de la orilla
    if (
      isInsideAnyIsland(world, bullet.x, bullet.y) &&
      (bulletIsBoss || !nearFort(world, bullet.x, bullet.y, 34))
    ) {
      world.bullets.delete(bulletId)
      if (bullet.kind !== 'fire') events.push({ type: 'splash', x: bullet.x, y: bullet.y })
      continue
    }

    for (const ship of world.ships.values()) {
      if (!ship.alive) continue
      if (!bulletIsBoss && areAllies(world, bullet.team, bullet.ownerShipId, ship.team, ship.id)) continue
      const r = derived(ship).radius
      if (Math.hypot(ship.x - bullet.x, ship.y - bullet.y) <= r + bullet.radius) {
        if (world.timeMs >= ship.spawnProtectedUntil) applyOnHit(world, bullet, ship.fx)
        damageShip(world, ship, bullet.damage, bullet.ownerShipId, events)
        consumed = true
        break
      }
    }
    if (consumed) {
      world.bullets.delete(bulletId)
      continue
    }

    for (const unit of world.fleet.values()) {
      if (!bulletIsBoss && areAllies(world, bullet.team, bullet.ownerShipId, unit.team, unit.ownerShipId))
        continue
      if (Math.hypot(unit.x - bullet.x, unit.y - bullet.y) <= FLEET_RADIUS + bullet.radius) {
        damageFleet(world, unit, bullet.damage, bulletIsBoss ? null : bullet.ownerShipId, events)
        consumed = true
        break
      }
    }
    if (consumed) world.bullets.delete(bulletId)
  }
}

/** Morteros que aterrizan: explosión en área con caída de daño hacia el borde. */
export function resolveMortars(world: World, events: WorldEvent[]): void {
  for (const [id, b] of world.bullets) {
    if (b.kind !== 'mortar' || b.landAt === undefined || world.timeMs < b.landAt) continue
    const R = b.aoe ?? 50
    world.bullets.delete(id)
    events.push({ type: 'mortarBlast', x: b.x, y: b.y, radius: R })
    if (isInsideAnyIsland(world, b.x, b.y) && !nearAnyBoss(world, b.x, b.y, R)) continue
    const falloff = (d: number, r: number) => Math.max(0.35, 1 - Math.max(0, d - r) / R)
    for (const ship of world.ships.values()) {
      if (!ship.alive || areAllies(world, b.team, b.ownerShipId, ship.team, ship.id)) continue
      const r = derived(ship).radius
      const d = Math.hypot(ship.x - b.x, ship.y - b.y)
      if (d <= R + r) damageShip(world, ship, b.damage * falloff(d, r), b.ownerShipId, events)
    }
    for (const boss of world.bosses.values()) {
      if (!boss.alive) continue
      const r = findBossDef(boss.archetype).radius
      const d = Math.hypot(boss.x - b.x, boss.y - b.y)
      if (d <= R + r) damageBoss(world, boss, b.damage * falloff(d, r), b.ownerShipId, events)
    }
    for (const unit of world.fleet.values()) {
      if (areAllies(world, b.team, b.ownerShipId, unit.team, unit.ownerShipId)) continue
      if (Math.hypot(unit.x - b.x, unit.y - b.y) <= R + FLEET_RADIUS)
        damageFleet(world, unit, b.damage * 0.7, b.ownerShipId, events)
    }
  }
}

function nearFort(world: World, x: number, y: number, margin: number): boolean {
  for (const boss of world.bosses.values()) {
    if (!boss.alive) continue
    const def = findBossDef(boss.archetype)
    if (def.kind === 'fort' && Math.hypot(boss.x - x, boss.y - y) < def.radius + margin) return true
  }
  return false
}

function nearAnyBoss(world: World, x: number, y: number, R: number): boolean {
  for (const boss of world.bosses.values()) {
    if (boss.alive && Math.hypot(boss.x - x, boss.y - y) < R + findBossDef(boss.archetype).radius) return true
  }
  return false
}

export function resolveMineCollisions(world: World, events: WorldEvent[]): void {
  for (const [mineId, mine] of world.mines) {
    if (!mine.armed) continue

    // Aceite ardiente: no explota; prende fuego a los enemigos que lo cruzan.
    if (mine.oil) {
      for (const ship of world.ships.values()) {
        if (!ship.alive || world.timeMs < ship.spawnProtectedUntil) continue
        if (areAllies(world, mine.team, mine.ownerShipId, ship.team, ship.id)) continue
        if (Math.hypot(ship.x - mine.x, ship.y - mine.y) <= derived(ship).radius * 0.6 + mine.radius) {
          applyBurn(ship.fx, world.timeMs, mine.oil.dps, mine.oil.ms, mine.ownerShipId)
          ship.lastDamagedBy = mine.ownerShipId
        }
      }
      for (const boss of world.bosses.values()) {
        if (
          boss.alive &&
          Math.hypot(boss.x - mine.x, boss.y - mine.y) <= findBossDef(boss.archetype).radius + mine.radius
        ) {
          applyBurn(boss.fx, world.timeMs, mine.oil.dps, mine.oil.ms, mine.ownerShipId)
        }
      }
      continue
    }

    let triggered = false
    for (const ship of world.ships.values()) {
      if (!ship.alive || areAllies(world, mine.team, mine.ownerShipId, ship.team, ship.id)) continue
      if (Math.hypot(ship.x - mine.x, ship.y - mine.y) <= derived(ship).radius + mine.radius * 0.7) {
        triggered = true
        break
      }
    }
    if (!triggered) {
      for (const boss of world.bosses.values()) {
        if (
          boss.alive &&
          Math.hypot(boss.x - mine.x, boss.y - mine.y) <=
            findBossDef(boss.archetype).radius + mine.radius * 0.7
        ) {
          triggered = true
          break
        }
      }
    }
    if (!triggered) continue

    const blast = mine.radius * 1.6
    events.push({ type: 'mineExplode', x: mine.x, y: mine.y, radius: blast })
    for (const ship of world.ships.values()) {
      if (!ship.alive || areAllies(world, mine.team, mine.ownerShipId, ship.team, ship.id)) continue
      const dist = Math.hypot(ship.x - mine.x, ship.y - mine.y)
      if (dist <= derived(ship).radius + blast) {
        const falloff = 1 - Math.min(0.5, dist / (blast * 2))
        damageShip(world, ship, mine.damage * falloff, mine.ownerShipId, events)
      }
    }
    for (const boss of world.bosses.values()) {
      if (
        boss.alive &&
        Math.hypot(boss.x - mine.x, boss.y - mine.y) <= findBossDef(boss.archetype).radius + blast
      ) {
        damageBoss(world, boss, mine.damage, mine.ownerShipId, events)
      }
    }
    world.mines.delete(mineId)
  }
}

function ramPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function resolveRamCollisions(world: World, dt: number, events: WorldEvent[]): void {
  const ships = [...world.ships.values()].filter((s) => s.alive)

  for (let i = 0; i < ships.length; i++) {
    const a = ships[i]
    const da = derived(a)

    for (let j = i + 1; j < ships.length; j++) {
      const b = ships[j]
      const db = derived(b)
      const dx = a.x - b.x
      const dy = a.y - b.y
      if (Math.abs(dx) > 200 || Math.abs(dy) > 200) continue
      const dist = Math.hypot(dx, dy)
      const minDist = da.radius + db.radius
      if (dist >= minDist || dist === 0) continue

      const nx = dx / dist
      const ny = dy / dist
      const allies = areAllies(world, a.team, a.id, b.team, b.id)

      if (!allies) {
        const key = ramPairKey(a.id, b.id)
        const cooldown = world.ramCooldowns.get(key) ?? 0
        const closingSpeed = -((a.vx - b.vx) * nx + (a.vy - b.vy) * ny)
        // Quien embiste más de frente recibe menos: se reparte según la velocidad propia hacia el otro.
        const aInto = Math.max(0, -(a.vx * nx + a.vy * ny))
        const bInto = Math.max(0, b.vx * nx + b.vy * ny)
        // Con espolón cuenta la velocidad propia de la proa: también se puede embestir a quien huye.
        const aRam = da.ramTakenMult < 1 ? aInto * 0.75 : 0
        const bRam = db.ramTakenMult < 1 ? bInto * 0.75 : 0
        const impact = Math.max(closingSpeed, aRam, bRam)
        if (cooldown <= 0 && impact > RAM_TRIGGER_SPEED) {
          const factor = impact / 160
          const total = aInto + bInto || 1
          const dmgToB = da.ramDamage * factor * (0.5 + aInto / total) * db.ramTakenMult
          const dmgToA = db.ramDamage * factor * (0.5 + bInto / total) * da.ramTakenMult
          events.push({
            type: 'ramHit',
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            damage: Math.max(dmgToA, dmgToB),
          })
          damageShip(world, a, dmgToA, b.id, events)
          damageShip(world, b, dmgToB, a.id, events)
          breakSpawnProtection(world, a)
          breakSpawnProtection(world, b)
          world.ramCooldowns.set(key, RAM_COOLDOWN_MS)
        }
      }

      const overlap = minDist - dist
      a.x += nx * overlap * 0.5
      a.y += ny * overlap * 0.5
      b.x -= nx * overlap * 0.5
      b.y -= ny * overlap * 0.5
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
      if (rel < 0) {
        a.vx -= nx * rel * 0.6
        a.vy -= ny * rel * 0.6
        b.vx += nx * rel * 0.6
        b.vy += ny * rel * 0.6
      }
    }

    for (const bo of world.bosses.values()) {
      if (!bo.alive) continue
      const br = findBossDef(bo.archetype).radius
      const dx = a.x - bo.x
      const dy = a.y - bo.y
      const dist = Math.hypot(dx, dy)
      const minDist = da.radius + br
      if (dist >= minDist || dist === 0) continue
      const nx = dx / dist
      const ny = dy / dist
      const key = ramPairKey(a.id, bo.id)
      const cooldown = world.ramCooldowns.get(key) ?? 0
      const closingSpeed = -((a.vx - bo.vx) * nx + (a.vy - bo.vy) * ny)
      if (cooldown <= 0 && closingSpeed > RAM_TRIGGER_SPEED) {
        events.push({
          type: 'ramHit',
          x: a.x - nx * da.radius,
          y: a.y - ny * da.radius,
          damage: da.ramDamage,
        })
        damageBoss(world, bo, da.ramDamage * (closingSpeed / 160) * 1.5, a.id, events)
        breakSpawnProtection(world, a)
        world.ramCooldowns.set(key, RAM_COOLDOWN_MS)
      }
      const overlap = minDist - dist
      a.x += nx * overlap
      a.y += ny * overlap
      const rel = (a.vx - bo.vx) * nx + (a.vy - bo.vy) * ny
      if (rel < 0) {
        a.vx -= nx * rel * 1.2
        a.vy -= ny * rel * 1.2
      }
    }
  }

  // La flota no se apila sobre los barcos
  for (const unit of world.fleet.values()) {
    for (const s of ships) {
      const dx = unit.x - s.x
      const dy = unit.y - s.y
      const dist = Math.hypot(dx, dy)
      const minDist = derived(s).radius + FLEET_RADIUS
      if (dist > 0 && dist < minDist) {
        unit.x += (dx / dist) * (minDist - dist)
        unit.y += (dy / dist) * (minDist - dist)
      }
    }
  }

  const dtMs = dt * 1000
  for (const [key, ms] of world.ramCooldowns) {
    const remaining = ms - dtMs
    if (remaining <= 0) world.ramCooldowns.delete(key)
    else world.ramCooldowns.set(key, remaining)
  }
}

/** Muertes por causas sin atacante directo (islas). */
export function checkEnvironmentalDeaths(world: World, events: WorldEvent[]): void {
  for (const ship of world.ships.values()) {
    if (ship.alive && ship.hp <= 0) killShip(world, ship, ship.lastDamagedBy, events)
  }
}

export function fleetRadius(defId: string): number {
  return findFleetDef(defId)?.fleetClass === 'heavy' ? FLEET_RADIUS * 1.35 : FLEET_RADIUS
}
