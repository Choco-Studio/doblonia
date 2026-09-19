import type { World, WorldEvent } from './types.js'
import { stepShipMovement } from './physics.js'
import { stepShipWeapons, stepBulletsAndMines, stepCoinShot, stepStarterGun } from './firing.js'
import {
  checkEnvironmentalDeaths,
  resolveBulletCollisions,
  resolveMineCollisions,
  resolveMortars,
  resolveRamCollisions,
} from './combat.js'
import { stepAfflictions, stepWhirlpools } from './afflictions.js'
import { stepChests } from './world.js'
import { stepCoinPickups, stepRespawns } from './economy.js'
import { updateBotBrain, updateBotEconomy } from './ai/bot.js'
import { updateBoss } from './ai/boss.js'
import { updateFleetUnit } from './ai/fleet.js'

const BOT_ECONOMY_INTERVAL_MS = 700

export function simulateTick(world: World, dt: number): WorldEvent[] {
  const events: WorldEvent[] = world.pendingEvents
  world.pendingEvents = []
  world.timeMs += dt * 1000

  for (const ship of world.ships.values()) {
    if (ship.isBot) updateBotBrain(world, ship)
  }

  if (world.timeMs - world.lastBotEconomyTick > BOT_ECONOMY_INTERVAL_MS) {
    world.lastBotEconomyTick = world.timeMs
    for (const ship of world.ships.values()) {
      if (ship.isBot) updateBotEconomy(world, ship)
    }
  }

  for (const ship of world.ships.values()) {
    stepShipMovement(ship, dt, world, events)
    stepShipWeapons(world, ship, dt, events)
    stepStarterGun(world, ship, dt, events)
    stepCoinShot(world, ship, dt, events)
  }

  for (const unit of world.fleet.values()) updateFleetUnit(world, unit, dt, events)
  for (const boss of world.bosses.values()) updateBoss(world, boss, dt, events)

  stepWhirlpools(world, dt, events)
  stepBulletsAndMines(world, dt)
  resolveBulletCollisions(world, events)
  resolveMortars(world, events)
  resolveMineCollisions(world, events)
  resolveRamCollisions(world, dt, events)
  stepAfflictions(world, dt, events)
  checkEnvironmentalDeaths(world, events)
  stepChests(world, events)
  stepCoinPickups(world, events)
  stepRespawns(world, events)

  return events
}
