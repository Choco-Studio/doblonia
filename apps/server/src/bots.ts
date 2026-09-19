import { createShip, nextWorldId, type World } from '@doblonia/sim'
import { SKINS, type TeamId } from '@doblonia/content'
import { randomPlayerName } from './names.js'

export const TARGET_MAIN_SHIPS = 16

export function teamCounts(world: World, humansOnly = false): { red: number; blue: number } {
  let red = 0
  let blue = 0
  for (const s of world.ships.values()) {
    if (humansOnly && s.isBot) continue
    if (s.team === 'red') red++
    else if (s.team === 'blue') blue++
  }
  return { red, blue }
}

export function smallerTeam(world: World, balanceHumans = false): TeamId {
  if (balanceHumans) {
    const humans = teamCounts(world, true)
    if (humans.red !== humans.blue) return humans.red < humans.blue ? 'red' : 'blue'
  }
  const c = teamCounts(world)
  if (c.red === c.blue) return world.teamScores.red <= world.teamScores.blue ? 'red' : 'blue'
  return c.red < c.blue ? 'red' : 'blue'
}

/**
 * Mantiene el número de barcos principales (humanos + bots) cerca de TARGET_MAIN_SHIPS.
 * Los bots se retiran de forma diferida: nunca a mitad de un combate reciente.
 * En TDM, se retira preferentemente un bot del equipo más numeroso.
 */
export function ensureBotPopulation(world: World, botIds: Set<string>): void {
  const humanCount = [...world.ships.values()].filter((s) => !s.isBot).length
  const desiredBots = Math.max(0, TARGET_MAIN_SHIPS - humanCount)

  while (botIds.size < desiredBots) {
    const id = nextWorldId(world, 'bot_')
    const taken = new Set([...world.ships.values()].map((s) => s.name))
    const team = world.mode === 'tdm' ? smallerTeam(world) : ''
    const skin = SKINS[Math.floor(world.random() * SKINS.length)].id
    createShip(
      world,
      id,
      randomPlayerName(() => world.random(), taken),
      null,
      true,
      team,
      skin,
    )
    botIds.add(id)
  }

  while (botIds.size > desiredBots) {
    const counts = teamCounts(world)
    const biggerTeam: TeamId = world.mode === 'tdm' ? (counts.red >= counts.blue ? 'red' : 'blue') : ''
    let candidate: string | undefined
    let fallback: string | undefined
    for (const id of botIds) {
      const ship = world.ships.get(id)
      if (!ship) {
        candidate = id
        break
      }
      const calm = !ship.alive || world.timeMs - ship.lastDamageAt > 3000
      if (!calm) continue
      if (!biggerTeam || ship.team === biggerTeam) {
        candidate = id
        break
      }
      fallback ??= id
    }
    candidate ??= fallback
    if (!candidate) break
    const ship = world.ships.get(candidate)
    if (ship) {
      for (const fid of ship.fleetIds) world.fleet.delete(fid)
      world.ships.delete(candidate)
    }
    botIds.delete(candidate)
  }
}
