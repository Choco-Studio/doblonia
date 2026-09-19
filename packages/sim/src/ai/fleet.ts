import { findBossDef, findFleetDef } from '@doblonia/content'
import type { FleetUnit, Mine, World, WorldEvent } from '../types.js'
import { nextWorldId } from '../types.js'
import { collectCoin } from '../economy.js'
import { findNearestEnemy, leadAngle, spawnBullet } from '../firing.js'
import { derived } from '../loadout.js'
import { islandContact } from '../world.js'

const DEG2RAD = Math.PI / 180
const FLEET_TURN_RATE = 200 * DEG2RAD

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

export function updateFleetUnit(world: World, unit: FleetUnit, dt: number, events: WorldEvent[]): void {
  const def = findFleetDef(unit.defId)
  const owner = world.ships.get(unit.ownerShipId)
  if (!def || !owner || !owner.alive) return

  unit.cooldown = Math.max(0, unit.cooldown - dt * 1000)

  const ownerR = derived(owner).radius
  const formAngle = owner.angle + unit.slotAngle
  const formDist = ownerR * 2.6 + (def.fleetClass === 'heavy' ? 30 : 0)
  let tx = owner.x + Math.cos(formAngle) * formDist
  let ty = owner.y + Math.sin(formAngle) * formDist
  let urgency = 1

  if (def.role === 'collector') {
    let best: { id: string; x: number; y: number; d: number } | undefined
    for (const [id, coin] of world.coins) {
      const dOwner = Math.hypot(coin.x - owner.x, coin.y - owner.y)
      if (dOwner > 520) continue
      if (inBossZone(world, coin.x, coin.y)) continue
      const d = Math.hypot(coin.x - unit.x, coin.y - unit.y)
      if (!best || d < best.d) best = { id, x: coin.x, y: coin.y, d }
    }
    if (best) {
      tx = best.x
      ty = best.y
      if (best.d < (def.collectRadius ?? 40) * 0.5) collectCoin(world, owner, best.id, events)
    }
  }

  if (def.weapon && unit.cooldown <= 0) {
    const target = findNearestEnemy(
      world,
      unit.x,
      unit.y,
      unit.ownerShipId,
      unit.team,
      def.weapon.range,
      true,
      owner.isBot ? owner : undefined,
    )
    if (target) {
      const aim = leadAngle(unit.x, unit.y, target, def.weapon.bulletSpeed)
      const n = Math.min(def.weapon.count, def.fleetClass === 'heavy' ? 4 : 2)
      for (let i = 0; i < n; i++) {
        const dir = aim + ((i - (n - 1) / 2) * 4 + (world.random() - 0.5) * def.weapon.spreadDeg) * DEG2RAD
        spawnBullet(
          world,
          unit.ownerShipId,
          unit.team,
          'fleet',
          unit.x + Math.cos(dir) * 12,
          unit.y + Math.sin(dir) * 12,
          dir,
          def.weapon.bulletSpeed,
          unit.vx,
          unit.vy,
          def.weapon.damage,
          def.weapon.bulletRadius,
          def.weapon.range,
        )
      }
      unit.cooldown = def.weapon.reloadMs
    }
  }

  if (def.role === 'support' && def.minesEffect && unit.cooldown <= 0 && Math.hypot(unit.vx, unit.vy) > 30) {
    const mine: Mine = {
      id: nextWorldId(world, 'm_'),
      ownerShipId: unit.ownerShipId,
      team: unit.team,
      x: unit.x - Math.cos(unit.angle) * 18,
      y: unit.y - Math.sin(unit.angle) * 18,
      damage: def.minesEffect.damage,
      radius: def.minesEffect.radius,
      placedAt: world.timeMs,
      expiresAt: world.timeMs + def.minesEffect.lifetimeMs,
      armed: false,
    }
    world.mines.set(mine.id, mine)
    unit.cooldown = def.minesEffect.reloadMs
  }

  // Si se queda muy atrás, acelera más allá de su velocidad nominal para no perder la formación
  const distToTarget = Math.hypot(tx - unit.x, ty - unit.y)
  if (Math.hypot(owner.x - unit.x, owner.y - unit.y) > 600) urgency = 1.6

  const desired = Math.atan2(ty - unit.y, tx - unit.x)
  const diff = wrap(desired - unit.angle)
  unit.angle += Math.max(-FLEET_TURN_RATE * dt, Math.min(FLEET_TURN_RATE * dt, diff))

  const arrive = Math.min(1, distToTarget / 70)
  const speed = def.moveSpeed * urgency * arrive * (Math.abs(diff) > 1.3 ? 0.4 : 1)
  const tvx = Math.cos(unit.angle) * speed
  const tvy = Math.sin(unit.angle) * speed
  unit.vx += (tvx - unit.vx) * Math.min(1, dt * 3)
  unit.vy += (tvy - unit.vy) * Math.min(1, dt * 3)
  unit.x += unit.vx * dt
  unit.y += unit.vy * dt

  const contact = islandContact(world, unit.x, unit.y, 14)
  if (contact) {
    unit.x += contact.nx * contact.depth
    unit.y += contact.ny * contact.depth
  }

  // Si el dueño se aleja muchísimo (p. ej. reapareció), la unidad se teletransporta a formación
  if (Math.hypot(owner.x - unit.x, owner.y - unit.y) > 1400) {
    unit.x = owner.x - Math.cos(owner.angle) * formDist
    unit.y = owner.y - Math.sin(owner.angle) * formDist
  }
}

/** El pesquero no se mete a por monedas en la zona de un jefe o fuerte vivo. */
function inBossZone(world: World, x: number, y: number): boolean {
  for (const b of world.bosses.values()) {
    if (b.alive && Math.hypot(b.x - x, b.y - y) < findBossDef(b.archetype).guardRadius * 0.8) return true
  }
  return false
}
