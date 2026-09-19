import {
  findTier,
  findBossDef,
  SLOT_ORDER,
  deckLayout,
  deckTurretAlong,
  deckBarrelLength,
  hullMountOffset,
  localToWorld,
  type CannonEffect,
  type SlotId,
  type TeamId,
} from '@doblonia/content'
import type { Bullet, BulletKind, Mine, Ship, World, WorldEvent } from './types.js'
import { nextWorldId, breakSpawnProtection, areAllies } from './types.js'
import { derived } from './loadout.js'

const DEG2RAD = Math.PI / 180
const VELOCITY_INHERIT = 0.45

export interface FireTarget {
  x: number
  y: number
  vx: number
  vy: number
}

/** Enemigo más cercano dentro de `range` respetando equipos. Usado por torretas automáticas y la flota. */
export function findNearestEnemy(
  world: World,
  x: number,
  y: number,
  ownerId: string,
  team: TeamId,
  range: number,
  includeBosses = true,
  mercyFrom?: Ship,
): FireTarget | undefined {
  let best: FireTarget | undefined
  let bestDist = range
  for (const ship of world.ships.values()) {
    if (!ship.alive || world.timeMs < ship.spawnProtectedUntil) continue
    if (areAllies(world, team, ownerId, ship.team, ship.id)) continue
    if (mercyFrom && isProtectedNewbie(ship, mercyFrom)) continue
    const d = Math.hypot(ship.x - x, ship.y - y)
    if (d < bestDist) {
      bestDist = d
      best = ship
    }
  }
  if (includeBosses) {
    for (const boss of world.bosses.values()) {
      if (!boss.alive) continue
      // Se mide hasta el borde: jefes y fuertes son grandes y las torretas deben alcanzarlos
      const d = Math.max(0, Math.hypot(boss.x - x, boss.y - y) - findBossDef(boss.archetype).radius)
      if (d < bestDist) {
        bestDist = d
        best = boss
      }
    }
  }
  return best
}

/** Los bots no atacan a humanos novatos (poder < 6) salvo que estos les hayan dañado. */
export function isProtectedNewbie(target: Ship, bot: Ship): boolean {
  if (target.isBot || !bot.isBot) return false
  const power = Object.values(target.statLevels).reduce((a, b) => a + b, 0)
  return power < 6 && bot.lastDamagedBy !== target.id
}

/** Ángulo de tiro con anticipación lineal simple hacia un objetivo en movimiento. */
export function leadAngle(fromX: number, fromY: number, target: FireTarget, bulletSpeed: number): number {
  const dx = target.x - fromX
  const dy = target.y - fromY
  const t = Math.hypot(dx, dy) / Math.max(1, bulletSpeed)
  return Math.atan2(dy + target.vy * t * 0.8, dx + target.vx * t * 0.8)
}

type BulletExtra = Partial<Pick<Bullet, 'slow' | 'burn' | 'aoe' | 'landAt'>>

export function spawnBullet(
  world: World,
  owner: string,
  team: TeamId,
  kind: BulletKind,
  x: number,
  y: number,
  angle: number,
  speed: number,
  inheritVx: number,
  inheritVy: number,
  damage: number,
  radius: number,
  range: number,
  extra?: BulletExtra,
): Bullet {
  const bullet: Bullet = {
    ...extra,
    id: nextWorldId(world, 'b_'),
    ownerShipId: owner,
    team,
    kind,
    x,
    y,
    vx: Math.cos(angle) * speed + inheritVx * VELOCITY_INHERIT,
    vy: Math.sin(angle) * speed + inheritVy * VELOCITY_INHERIT,
    damage,
    radius,
    remainingRange: range,
  }
  world.bullets.set(bullet.id, bullet)
  return bullet
}

function bulletKind(effect: CannonEffect): BulletKind {
  return effect.projectile ?? 'ball'
}

function extraFor(effect: CannonEffect): BulletExtra | undefined {
  if (!effect.slow && !effect.burn) return undefined
  return { slow: effect.slow, burn: effect.burn }
}

function fireCannonSalvo(
  world: World,
  ship: Ship,
  slot: SlotId,
  tierId: string,
  effect: CannonEffect,
  aimAngle: number,
  events: WorldEvent[],
): void {
  const d = derived(ship)
  const speed = effect.bulletSpeed + d.bulletSpeedBonus
  const damage = effect.damage * d.damageMult
  const radius = effect.bulletRadius + d.bulletSizeBonus
  const range = effect.range + d.rangeBonus
  const count = Math.max(1, effect.count)
  const kind = bulletKind(effect)
  const extra = extraFor(effect)

  if (kind === 'mortar') {
    const layout = deckLayout(tierId)
    const dist = Math.max(90, Math.min(range, ship.input.aimDist))
    for (let i = 0; i < count; i++) {
      const arc = effect.arcsDeg[i % effect.arcsDeg.length] ?? 0
      const turret = Math.min(layout.turrets - 1, i)
      const base = localToWorld(
        ship.x,
        ship.y,
        ship.angle,
        deckTurretAlong(turret, layout.turrets, d.radius),
        0,
      )
      const dir = aimAngle + (arc + (world.random() - 0.5) * effect.spreadDeg) * DEG2RAD
      const flightMs = (dist / speed) * 1000
      spawnBullet(
        world,
        ship.id,
        ship.team,
        'mortar',
        base.x,
        base.y,
        dir,
        speed,
        0,
        0,
        damage,
        radius,
        dist + 40,
        {
          aoe: (effect.aoe ?? 50) + d.bulletSizeBonus * 3,
          landAt: world.timeMs + flightMs,
        },
      )
      events.push({ type: 'shot', x: base.x, y: base.y, angle: dir })
    }
    return
  }

  if (slot === 'deck') {
    const layout = deckLayout(tierId)
    const barrelLen = deckBarrelLength(layout.style, d.radius)
    for (let i = 0; i < count; i++) {
      const arc = effect.arcsDeg[i % effect.arcsDeg.length] ?? 0
      const turret = Math.min(layout.turrets - 1, Math.floor(i / layout.barrelsPerTurret))
      const along = deckTurretAlong(turret, layout.turrets, d.radius)
      const base = localToWorld(ship.x, ship.y, ship.angle, along, 0)
      const spread = (world.random() - 0.5) * effect.spreadDeg * DEG2RAD
      const dir = aimAngle + (layout.multiDirectional ? arc * DEG2RAD : arc * DEG2RAD * 0.35) + spread
      let mx = base.x + Math.cos(dir) * barrelLen
      let my = base.y + Math.sin(dir) * barrelLen
      if (!layout.multiDirectional && layout.barrelsPerTurret > 1) {
        const b = i % layout.barrelsPerTurret
        const off = (b - (layout.barrelsPerTurret - 1) / 2) * 5
        mx += -Math.sin(dir) * off
        my += Math.cos(dir) * off
      }
      spawnBullet(
        world,
        ship.id,
        ship.team,
        kind,
        mx,
        my,
        dir,
        speed,
        ship.vx,
        ship.vy,
        damage,
        radius,
        range,
        extra,
      )
      events.push({ type: 'shot', x: mx, y: my, angle: dir })
    }
    return
  }

  for (let i = 0; i < count; i++) {
    const arc = effect.arcsDeg[i % effect.arcsDeg.length] ?? 0
    const off = hullMountOffset(slot, arc, d.radius)
    const p = localToWorld(ship.x, ship.y, ship.angle, off.along, off.across)
    const spread = (world.random() - 0.5) * effect.spreadDeg * DEG2RAD
    const dir = ship.angle + arc * DEG2RAD + spread
    spawnBullet(
      world,
      ship.id,
      ship.team,
      kind,
      p.x,
      p.y,
      dir,
      speed,
      ship.vx,
      ship.vy,
      damage,
      radius,
      range,
      extra,
    )
    events.push({ type: 'shot', x: p.x, y: p.y, angle: dir })
  }
}

export function stepShipWeapons(world: World, ship: Ship, dt: number, events: WorldEvent[]): void {
  if (!ship.alive) return
  const d = derived(ship)
  const dtMs = dt * 1000

  for (const slot of SLOT_ORDER) {
    const eq = ship.equip[slot]
    if (!eq) continue
    const tier = findTier(slot, eq.branchId, eq.tierId)
    if (!tier) continue

    ship.cooldowns[slot] = Math.max(0, ship.cooldowns[slot] - dtMs)
    if (ship.cooldowns[slot] > 0) continue

    const wantsToFire = ship.input.firing
    if (tier.effect.kind === 'cannon') {
      const effect = tier.effect
      let aimAngle = ship.input.aimAngle
      if (effect.autoAim) {
        const target = findNearestEnemy(
          world,
          ship.x,
          ship.y,
          ship.id,
          ship.team,
          effect.range + d.rangeBonus,
          true,
          ship.isBot ? ship : undefined,
        )
        if (!target) continue
        aimAngle = leadAngle(ship.x, ship.y, target, effect.bulletSpeed + d.bulletSpeedBonus)
      } else if (!wantsToFire) {
        continue
      }
      fireCannonSalvo(world, ship, slot, eq.tierId, effect, aimAngle, events)
      ship.cooldowns[slot] = effect.reloadMs * d.reloadMult
      breakSpawnProtection(world, ship)
    } else if (tier.effect.kind === 'mine') {
      if (!wantsToFire) continue
      const p = localToWorld(ship.x, ship.y, ship.angle, -d.radius * 1.4, 0)
      const mine: Mine = {
        id: nextWorldId(world, 'm_'),
        ownerShipId: ship.id,
        team: ship.team,
        x: p.x,
        y: p.y,
        damage: tier.effect.damage * d.damageMult,
        radius: tier.effect.radius,
        placedAt: world.timeMs,
        expiresAt: world.timeMs + tier.effect.lifetimeMs,
        armed: !!tier.effect.oil,
        oil: tier.effect.oil,
      }
      world.mines.set(mine.id, mine)
      ship.cooldowns[slot] = tier.effect.reloadMs * d.reloadMult
      breakSpawnProtection(world, ship)
    }
  }
}

/** Cañón base: antes de elegir Cubierta, el barco dispara un cañoncito ligero hacia la mira. */
export function stepStarterGun(world: World, ship: Ship, dt: number, events: WorldEvent[]): void {
  if (!ship.alive || ship.equip.deck) return
  ship.cooldowns.deck = Math.max(0, ship.cooldowns.deck - dt * 1000)
  if (ship.cooldowns.deck > 0 || !ship.input.firing) return
  const d = derived(ship)
  const dir = ship.input.aimAngle + (world.random() - 0.5) * 0.04
  const mx = ship.x + Math.cos(dir) * d.radius * 0.6
  const my = ship.y + Math.sin(dir) * d.radius * 0.6
  spawnBullet(
    world,
    ship.id,
    ship.team,
    'ball',
    mx,
    my,
    dir,
    420 + d.bulletSpeedBonus,
    ship.vx,
    ship.vy,
    8 * d.damageMult,
    3.6 + d.bulletSizeBonus,
    260 + d.rangeBonus,
  )
  events.push({ type: 'shot', x: mx, y: my, angle: dir })
  ship.cooldowns.deck = 600 * d.reloadMult
  breakSpawnProtection(world, ship)
}

const COIN_SHOT_COST = 10
const COIN_SHOT_COOLDOWN_MS = 260
const COIN_SHOT_DAMAGE = 7
const COIN_SHOT_SPEED = 400
const COIN_SHOT_RANGE = 320

/** Mecánica del original: tecla F lanza una moneda propia como proyectil barato. */
export function stepCoinShot(world: World, ship: Ship, dt: number, events: WorldEvent[]): void {
  if (!ship.alive) return
  ship.coinShotCooldownMs = Math.max(0, ship.coinShotCooldownMs - dt * 1000)
  if (!ship.input.fireCoin || ship.coinShotCooldownMs > 0 || ship.coins < COIN_SHOT_COST) return

  ship.coins -= COIN_SHOT_COST
  ship.coinShotCooldownMs = COIN_SHOT_COOLDOWN_MS
  const angle = ship.input.aimAngle
  const d = derived(ship)
  const x = ship.x + Math.cos(angle) * d.radius
  const y = ship.y + Math.sin(angle) * d.radius
  spawnBullet(
    world,
    ship.id,
    ship.team,
    'coin',
    x,
    y,
    angle,
    COIN_SHOT_SPEED,
    ship.vx,
    ship.vy,
    COIN_SHOT_DAMAGE,
    5,
    COIN_SHOT_RANGE,
  )
  events.push({ type: 'shot', x, y, angle })
  breakSpawnProtection(world, ship)
}

export function stepBulletsAndMines(world: World, dt: number): void {
  const limit = world.mapSize * 0.6
  for (const [id, bullet] of world.bullets) {
    const dist = Math.hypot(bullet.vx, bullet.vy) * dt
    bullet.x += bullet.vx * dt
    bullet.y += bullet.vy * dt
    bullet.remainingRange -= dist
    if (bullet.kind === 'mortar') continue
    if (bullet.remainingRange <= 0 || Math.abs(bullet.x) > limit || Math.abs(bullet.y) > limit) {
      world.bullets.delete(id)
    }
  }

  for (const [id, mine] of world.mines) {
    if (!mine.armed && world.timeMs - mine.placedAt > 350) mine.armed = true
    if (world.timeMs >= mine.expiresAt) world.mines.delete(id)
  }
}
