import type { Boss, Ship, World, WorldEvent } from './types.js'
import { damageBoss, damageShip } from './combat.js'
import { whirlpoolCurrent } from './physics.js'

const BURN_TICK_S = 0.5

/** Daño de quemadura agrupado en golpes cada medio segundo (no un evento por tick). */
export function stepAfflictions(world: World, dt: number, events: WorldEvent[]): void {
  const now = world.timeMs
  const burnShip = (ship: Ship) => {
    const fx = ship.fx
    if (!ship.alive || now >= fx.burnUntil) {
      fx.burnAcc = 0
      return
    }
    fx.burnAcc += dt
    if (fx.burnAcc >= BURN_TICK_S) {
      fx.burnAcc -= BURN_TICK_S
      damageShip(world, ship, fx.burnDps * BURN_TICK_S, fx.burnBy, events)
    }
  }
  const burnBoss = (boss: Boss) => {
    const fx = boss.fx
    if (!boss.alive || now >= fx.burnUntil) {
      fx.burnAcc = 0
      return
    }
    fx.burnAcc += dt
    if (fx.burnAcc >= BURN_TICK_S) {
      fx.burnAcc -= BURN_TICK_S
      damageBoss(world, boss, fx.burnDps * BURN_TICK_S, fx.burnBy, events)
    }
  }
  for (const s of world.ships.values()) burnShip(s)
  for (const b of world.bosses.values()) burnBoss(b)
}

/**
 * Remolinos: el arrastre de los barcos va en su movimiento (applyWhirlpools, compartido con la
 * predicción del cliente). Aquí solo el daño del ojo y el arrastre de la flota, con la misma corriente.
 */
export function stepWhirlpools(world: World, dt: number, events: WorldEvent[]): void {
  if (world.whirlpools.length === 0) return
  for (const ship of world.ships.values()) {
    if (!ship.alive || world.timeMs < ship.spawnProtectedUntil) continue
    const c = whirlpoolCurrent(world.whirlpools, ship.x, ship.y)
    if (c.core > 0) damageShip(world, ship, (8 + 22 * c.core) * dt, ship.lastDamagedBy, events)
  }
  for (const unit of world.fleet.values()) {
    const c = whirlpoolCurrent(world.whirlpools, unit.x, unit.y)
    unit.x += c.vx * 0.6 * dt
    unit.y += c.vy * 0.6 * dt
  }
}
