import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, createShip, buyFleet } from '@doblonia/sim'
import { ROOM_CAPACITY, BOT_POPULATION_TARGET } from '@doblonia/content'
import { ensureBotPopulation, teamCounts, smallerTeam } from '../src/bots.js'

for (const mode of ['ffa', 'tdm'] as const) {
  test(`${mode}: arrivals displace fighting bots without exceeding map capacity`, () => {
    const world = createWorld(mode, 42)
    const bots = new Set<string>()
    ensureBotPopulation(world, bots)
    assert.equal(world.ships.size, BOT_POPULATION_TARGET)
    for (const ship of world.ships.values()) {
      ship.lastDamageAt = world.timeMs
      ship.coins = 10000
      assert.ok(buyFleet(world, ship, 'fishing_boat').ok)
    }
    for (let i = 0; i < ROOM_CAPACITY; i++) {
      ensureBotPopulation(world, bots, 1)
      createShip(
        world,
        `human-${i}`,
        'Player',
        `human-${i}`,
        false,
        mode === 'tdm' ? smallerTeam(world, true) : '',
      )
      assert.ok(world.ships.size <= ROOM_CAPACITY)
      for (const escort of world.fleet.values()) assert.ok(world.ships.has(escort.ownerShipId))
    }
    assert.equal(bots.size, 0)
    assert.equal(world.fleet.size, 0)
    if (mode === 'tdm') assert.deepEqual(teamCounts(world), { red: 15, blue: 15 })
    for (const id of [...world.ships.keys()].slice(1)) world.ships.delete(id)
    ensureBotPopulation(world, bots)
    assert.equal(world.ships.size, BOT_POPULATION_TARGET)
    assert.equal(bots.size, BOT_POPULATION_TARGET - 1)
  })
}

test('bot retirement prefers a quiet captain when a place is needed', () => {
  const world = createWorld('ffa', 42)
  const bots = new Set<string>()
  ensureBotPopulation(world, bots)
  const quiet = [...bots][3]
  for (const bot of world.ships.values()) bot.lastDamageAt = world.timeMs
  world.ships.get(quiet)!.lastDamageAt = -4000
  ensureBotPopulation(world, bots, 1)
  assert.equal(bots.size, BOT_POPULATION_TARGET - 1)
  assert.ok(!bots.has(quiet))
})
