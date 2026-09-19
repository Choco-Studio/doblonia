import { createShip, nextWorldId, type World } from '@doblonia/sim'
import { SKINS, ROOM_CAPACITY, BOT_POPULATION_TARGET, type TeamId } from '@doblonia/content'
import { randomPlayerName } from './names.js'

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
 * Rellena las salas pequeñas sin superar el cupo compartido de humanos y bots.
 * Se intenta terminar los combates antes de retirar un bot, salvo que haga falta su plaza.
 * En TDM, se retira preferentemente un bot del equipo más numeroso.
 */
export function ensureBotPopulation(world: World, botIds: Set<string>, incomingHumans = 0): void {
  const humanCount = [...world.ships.values()].filter((s) => !s.isBot).length
  const desiredBots = Math.max(0, BOT_POPULATION_TARGET - humanCount - incomingHumans)

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
    let fighting: string | undefined
    let fightingFallback: string | undefined
    for (const id of botIds) {
      const ship = world.ships.get(id)
      if (!ship) {
        candidate = id
        break
      }
      const calm = !ship.alive || world.timeMs - ship.lastDamageAt > 3000
      if (!calm) {
        if (!biggerTeam || ship.team === biggerTeam) fighting ??= id
        fightingFallback ??= id
        continue
      }
      if (!biggerTeam || ship.team === biggerTeam) {
        candidate = id
        break
      }
      fallback ??= id
    }
    candidate ??= fallback
    if (world.ships.size + incomingHumans > ROOM_CAPACITY) candidate ??= fighting ?? fightingFallback
    if (!candidate) break
    const ship = world.ships.get(candidate)
    if (ship) {
      for (const fid of ship.fleetIds) world.fleet.delete(fid)
      world.ships.delete(candidate)
    }
    botIds.delete(candidate)
  }
}
