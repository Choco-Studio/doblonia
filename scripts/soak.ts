import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import {
  createWorld,
  createShip,
  simulateTick,
  buyFleet,
  derived,
  type World,
} from '../packages/sim/src/index.js'
import { BRANCHES_BY_SLOT, SLOT_ORDER } from '../packages/content/src/index.js'

const seconds = Number(process.argv[2] ?? 3600)
const seed = Number(process.argv[3] ?? 20260919)
const count = Number(process.argv[4] ?? 24)
const fullFleet = process.argv[5] === 'fleet'
assert.ok(
  Number.isInteger(seconds) && seconds > 0 && seconds <= 86400,
  'Duration must be 1–86400 simulated seconds',
)
assert.ok(Number.isInteger(count) && count >= 1 && count <= 64, 'Ship count must be 1–64')
const world = createWorld('ffa', seed)
for (let i = 0; i < count; i++) createShip(world, `bot${i}`, `Bot ${i}`, null, true)
const durations: number[] = []
let deaths = 0
let peakBullets = 0
let peakCoins = 0
let peakFleet = 0
const started = performance.now()
const initialHeap = process.memoryUsage().heapUsed

/** Escenario sintético: repone las escoltas y devuelve equipamiento avanzado después de cada muerte. */
function replenishFleet(): void {
  for (const [index, ship] of [...world.ships.values()].entries()) {
    if (!ship.alive) continue
    ship.coins = 100000
    if (ship.equipLevel === 1) {
      ship.statLevels = { hull: 15, repair: 15, range: 15, damage: 15, reload: 15, speed: 0, turn: 0, ram: 0 }
      ship.equipLevel = 20
      ship.equipPicks = 0
      for (const slot of SLOT_ORDER) {
        const branches = BRANCHES_BY_SLOT[slot]
        const branch = branches[index % branches.length]
        const tier = branch.tiers.at(-1)!
        ship.equip[slot] = { branchId: branch.id, tierId: tier.id }
      }
      ship.loadoutVersion++
      ship.maxHp = ship.hp = derived(ship).maxHp
    }
    for (const id of ['fishing_boat', 'mine_dropper_fleet', 'battleship', 'man_of_war']) {
      buyFleet(world, ship, id)
    }
  }
}

function verify(world: World): void {
  for (const ship of world.ships.values()) {
    assert.ok(
      [ship.x, ship.y, ship.vx, ship.vy, ship.hp, ship.maxHp].every(Number.isFinite),
      `Invalid ship ${ship.id}`,
    )
    assert.ok(ship.coins >= 0 && ship.hp <= ship.maxHp, `Invalid economy or health ${ship.id}`)
    assert.ok(
      Math.abs(ship.x) <= world.mapSize / 2 && Math.abs(ship.y) <= world.mapSize / 2,
      `Outside the map: ${ship.id}`,
    )
  }
  for (const unit of world.fleet.values()) {
    assert.ok(
      [unit.x, unit.y, unit.vx, unit.vy, unit.hp].every(Number.isFinite),
      `Invalid fleet unit ${unit.id}`,
    )
  }
  assert.ok(
    world.bullets.size < 3000 && world.coins.size < 1200 && world.fleet.size <= count * 4,
    'Unbounded entities',
  )
}

for (let tick = 0; tick < seconds * 20; tick++) {
  if (fullFleet && tick % 20 === 0) replenishFleet()
  const before = performance.now()
  const events = simulateTick(world, 0.05)
  durations.push(performance.now() - before)
  deaths += events.filter((event) => event.type === 'death').length
  peakBullets = Math.max(peakBullets, world.bullets.size)
  peakCoins = Math.max(peakCoins, world.coins.size)
  peakFleet = Math.max(peakFleet, world.fleet.size)
  if (tick % 20 === 0) verify(world)
}
verify(world)
durations.sort((a, b) => a - b)
const percentile = (fraction: number) =>
  Number(durations[Math.min(durations.length - 1, Math.floor(durations.length * fraction))].toFixed(3))
console.log(
  JSON.stringify(
    {
      seed: world.seed,
      simulatedSeconds: seconds,
      ships: count,
      scenario: fullFleet ? 'advanced equipment and replenished fleets' : 'normal progression',
      elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2)),
      tickMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: percentile(1) },
      deaths,
      peaks: { bullets: peakBullets, coins: peakCoins, fleet: peakFleet },
      heapMiB: {
        before: Math.round(initialHeap / 1048576),
        after: Math.round(process.memoryUsage().heapUsed / 1048576),
      },
      scope:
        'Simulation only; excludes network, serialization and browser rendering. Heap samples are not a leak measurement.',
    },
    null,
    2,
  ),
)
