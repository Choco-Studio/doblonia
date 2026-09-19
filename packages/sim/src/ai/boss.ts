import { findBossDef } from '@doblonia/content'
import type { Boss, Ship, World, WorldEvent } from '../types.js'
import { damageShip } from '../combat.js'
import { freshAfflictions } from '../types.js'
import { derived } from '../loadout.js'
import { leadAngle, spawnBullet } from '../firing.js'

const DEG2RAD = Math.PI / 180

function totalStatPoints(ship: Ship): number {
  let n = 0
  for (const v of Object.values(ship.statLevels)) n += v
  return n
}

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

export function updateBoss(world: World, boss: Boss, dt: number, events: WorldEvent[]): void {
  const def = findBossDef(boss.archetype)

  if (!boss.alive) {
    if (world.timeMs >= boss.respawnAt) {
      boss.alive = true
      boss.hp = def.hp
      boss.x = boss.homeX
      boss.y = boss.homeY
      boss.vx = 0
      boss.vy = 0
      boss.state = 'guard'
      boss.lastHitBy = null
      boss.fx = freshAfflictions()
      boss.weaponCooldowns = def.weapons.map(() => 1500)
      events.push({ type: 'bossSpawn', bossId: boss.id, archetype: boss.archetype })
    }
    return
  }

  const dtMs = dt * 1000
  boss.contactCooldownMs = Math.max(0, boss.contactCooldownMs - dtMs)

  const inCombat = world.timeMs - boss.lastDamageAt < 5000
  if (!inCombat && boss.hp < boss.maxHp) {
    boss.hp = Math.min(boss.maxHp, boss.hp + def.regenPerSecOutOfCombat * dt)
  }

  const distFromHome = Math.hypot(boss.x - boss.homeX, boss.y - boss.homeY)

  // Objetivo: el barco más cercano dentro de la zona de guardia (o quien le atacó recientemente)
  let target: Ship | undefined
  let targetDist = Infinity
  for (const ship of world.ships.values()) {
    if (!ship.alive || world.timeMs < ship.spawnProtectedUntil) continue
    const dHome = Math.hypot(ship.x - boss.homeX, ship.y - boss.homeY)
    const dBoss = Math.hypot(ship.x - boss.x, ship.y - boss.y)
    const provoked = ship.id === boss.lastHitBy && inCombat
    // Los fuertes no disparan a barcos recién salidos de puerto salvo que les ataquen
    if (def.kind === 'fort' && !provoked && ship.equipLevel < 3 && totalStatPoints(ship) < 6) continue
    if ((dHome < def.guardRadius || provoked) && dBoss < targetDist) {
      targetDist = dBoss
      target = ship
    }
  }

  if (boss.state === 'guard' && target) {
    boss.state = 'chase'
    // Tiempo de puntería al detectar a alguien: da margen para ver el aviso y alejarse
    if (def.kind === 'fort') boss.weaponCooldowns = boss.weaponCooldowns.map((c) => Math.max(c, 1200))
  }
  if (boss.state === 'chase' && (!target || distFromHome > def.guardRadius * 1.15)) boss.state = 'return'
  if (boss.state === 'return' && distFromHome < 90) boss.state = 'guard'

  let desired: number
  let throttle: number

  if (boss.state === 'chase' && target) {
    const toTarget = Math.atan2(target.y - boss.y, target.x - boss.x)
    boss.targetShipId = target.id
    if (boss.archetype === 'guardian_artillero') {
      // Mantiene distancia y ofrece el costado
      const side = wrap(toTarget - boss.angle) > 0 ? 1 : -1
      desired = targetDist < 260 ? toTarget + Math.PI : toTarget - side * (Math.PI / 2)
      throttle = 0.7
    } else if (boss.archetype === 'acorazado') {
      desired = toTarget
      throttle = targetDist > 90 ? 1 : 0.3
    } else {
      // Interceptor: ráfagas de persecución y retirada
      const phase = Math.floor(world.timeMs / 2600) % 3
      desired =
        phase === 2
          ? toTarget + Math.PI * 0.6
          : Math.atan2(target.y + target.vy * 0.5 - boss.y, target.x + target.vx * 0.5 - boss.x)
      throttle = 1
    }
  } else if (boss.state === 'return') {
    desired = Math.atan2(boss.homeY - boss.y, boss.homeX - boss.x)
    throttle = 0.9
    boss.targetShipId = undefined
  } else {
    if (world.timeMs > boss.wanderUntil) {
      boss.wanderAngle = Math.atan2(boss.homeY - boss.y, boss.homeX - boss.x) + (world.random() - 0.5) * 2.2
      boss.wanderUntil = world.timeMs + 2500 + world.random() * 2500
    }
    desired = distFromHome > 280 ? Math.atan2(boss.homeY - boss.y, boss.homeX - boss.x) : boss.wanderAngle
    throttle = 0.3
    boss.targetShipId = undefined
  }

  const diff = wrap(desired - boss.angle)
  const turnStep = def.turnRateDeg * DEG2RAD * dt
  boss.angle += Math.max(-turnStep, Math.min(turnStep, diff))

  const speed = def.moveSpeed * throttle
  const tvx = Math.cos(boss.angle) * speed
  const tvy = Math.sin(boss.angle) * speed
  boss.vx += (tvx - boss.vx) * Math.min(1, dt * 2)
  boss.vy += (tvy - boss.vy) * Math.min(1, dt * 2)
  boss.x += boss.vx * dt
  boss.y += boss.vy * dt

  // Disparo
  for (let wi = 0; wi < def.weapons.length; wi++) {
    boss.weaponCooldowns[wi] = Math.max(0, boss.weaponCooldowns[wi] - dtMs)
    if (boss.weaponCooldowns[wi] > 0 || !target || boss.state !== 'chase') continue
    const weapon = def.weapons[wi]
    if (targetDist > weapon.range) continue

    if (weapon.aimed) {
      const aim = leadAngle(boss.x, boss.y, target, weapon.bulletSpeed)
      for (let i = 0; i < weapon.count; i++) {
        const arc = weapon.arcsDeg[i % weapon.arcsDeg.length] ?? 0
        const dir = aim + (arc + (world.random() - 0.5) * weapon.spreadDeg) * DEG2RAD
        spawnBullet(
          world,
          boss.id,
          '',
          'boss',
          boss.x + Math.cos(dir) * def.radius * 0.7,
          boss.y + Math.sin(dir) * def.radius * 0.7,
          dir,
          weapon.bulletSpeed,
          0,
          0,
          weapon.damage,
          weapon.bulletRadius,
          weapon.range,
        )
      }
      boss.weaponCooldowns[wi] = weapon.reloadMs
      continue
    }

    // Andanada: solo el costado que mira al objetivo
    const rel = wrap(Math.atan2(target.y - boss.y, target.x - boss.x) - boss.angle) / DEG2RAD
    const facingArcs = weapon.arcsDeg.filter((a) => Math.abs(wrap((a - rel) * DEG2RAD)) < 40 * DEG2RAD)
    if (facingArcs.length === 0) continue
    for (const arc of facingArcs) {
      const dir = boss.angle + (arc + (world.random() - 0.5) * weapon.spreadDeg) * DEG2RAD
      const along = -((Math.abs(arc) - 90) / 15) * def.radius * 0.5
      const across = Math.sign(arc) * def.radius * 0.8
      const c = Math.cos(boss.angle)
      const s = Math.sin(boss.angle)
      spawnBullet(
        world,
        boss.id,
        '',
        'boss',
        boss.x + c * along - s * across,
        boss.y + s * along + c * across,
        dir,
        weapon.bulletSpeed,
        boss.vx,
        boss.vy,
        weapon.damage,
        weapon.bulletRadius,
        weapon.range,
      )
    }
    boss.weaponCooldowns[wi] = weapon.reloadMs
  }

  // Daño por contacto periódico
  if (boss.contactCooldownMs <= 0) {
    for (const ship of world.ships.values()) {
      if (!ship.alive) continue
      if (Math.hypot(ship.x - boss.x, ship.y - boss.y) < def.radius + derived(ship).radius + 6) {
        damageShip(world, ship, def.contactDamage, boss.id, events)
        boss.contactCooldownMs = 500
      }
    }
  }
}
