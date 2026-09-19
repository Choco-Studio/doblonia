import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createShip,
  createWorld,
  derived,
  equipPick,
  grantReward,
  integrateMotion,
  movementStats,
  purchaseStat,
  stepShipMovement,
  applySlow,
  simulateTick,
} from '../src/index.js'

test('buying hull preserves the armor granted by a ram and heals the full purchase amount', () => {
  const world = createWorld()
  const ship = createShip(world, 'captain', 'Captain', 'captain', false)
  grantReward(world, ship, 2000, [])
  for (const tier of ['battering_ram', 'greater_ram', 'ultra_ram', 'steel_ram']) {
    assert.deepEqual(equipPick(ship, 'front', 'ram', tier), { ok: true })
  }
  assert.equal(ship.maxHp, 310, 'equipment updates maximum health immediately')
  ship.hp = ship.maxHp
  assert.deepEqual(purchaseStat(ship, 'hull'), { ok: true })
  assert.equal(ship.maxHp, 375)
  assert.equal(ship.hp, 375)
  stepShipMovement(ship, 0, world, [])
  assert.equal(ship.hp, 375, 'the next simulation step keeps the result')

  ship.hp = 200
  purchaseStat(ship, 'hull')
  assert.equal(ship.hp, 265)
  assert.equal(ship.maxHp, 440)
})

test('equipping armor raises capacity without providing a hidden heal', () => {
  const world = createWorld()
  const ship = createShip(world, 'captain', 'Captain', 'captain', false)
  grantReward(world, ship, 2000, [])
  ship.hp = 50
  equipPick(ship, 'front', 'ram', 'battering_ram')
  assert.equal(ship.hp, 50)
  assert.equal(ship.maxHp, derived(ship).maxHp)
})

test('client movement and server movement agree while slowed', () => {
  const world = createWorld()
  world.islands = []
  world.whirlpools = []
  const ship = createShip(world, 'captain', 'Captain', 'captain', false)
  ship.x = ship.y = ship.angle = 0
  ship.input.throttle = 1
  ship.input.turn = 0.6
  applySlow(ship.fx, world.timeMs, 0.35, 10_000)
  const prediction = { x: ship.x, y: ship.y, vx: ship.vx, vy: ship.vy, angle: ship.angle }
  for (let i = 0; i < 40; i++) {
    integrateMotion(prediction, ship.input, movementStats(derived(ship), 0.35), 0.05)
    stepShipMovement(ship, 0.05, world, [])
  }
  for (const key of ['x', 'y', 'vx', 'vy', 'angle'] as const) assert.equal(prediction[key], ship[key], key)
})

test('a stale command cannot spend coins while the captain is dead', () => {
  const world = createWorld()
  const ship = createShip(world, 'captain', 'Captain', 'captain', false)
  grantReward(world, ship, 1000, [])
  ship.alive = false
  assert.equal(purchaseStat(ship, 'hull').ok, false)
  assert.equal(equipPick(ship, 'front', 'ram', 'battering_ram').ok, false)
  simulateTick(world, 0.05)
  assert.equal(ship.coins, 1000)
  assert.equal(ship.statLevels.hull, 0)
})
