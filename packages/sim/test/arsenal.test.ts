import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BRANCHES_BY_SLOT, SLOT_ORDER, FLEET_SHIPS, type WeaponBranch } from '@doblonia/content'
import {
  createShip,
  createWorld,
  grantReward,
  equipPick,
  derived,
  stepShipWeapons,
  buyFleet,
  simulateTick,
  type WorldEvent,
} from '../src/index.js'

function upgradePath(
  branch: WeaponBranch,
  target: string,
  current = branch.tiers[0].id,
): string[] | undefined {
  if (current === target) return [current]
  for (const next of branch.tiers.find((tier) => tier.id === current)?.nextIds ?? []) {
    const path = upgradePath(branch, target, next)
    if (path) return [current, ...path]
  }
}

test('every weapon upgrade can be purchased and produces its combat effect', async (t) => {
  for (const slot of SLOT_ORDER) {
    for (const branch of BRANCHES_BY_SLOT[slot]) {
      for (const tier of branch.tiers) {
        await t.test(`${slot}/${tier.id}`, () => {
          const world = createWorld('ffa', 20260919)
          world.islands = []
          world.bosses.clear()
          const ship = createShip(world, 'captain', 'Captain', 'captain', false)
          const target = createShip(world, 'target', 'Target', 'target', false)
          Object.assign(ship, { x: 0, y: 0, angle: 0, spawnProtectedUntil: 0 })
          Object.assign(target, { x: 120, y: 0, spawnProtectedUntil: 0 })
          const base = derived(ship)
          grantReward(world, ship, 100000, [])
          const path = upgradePath(branch, tier.id)
          assert.ok(path, 'An upgrade must be reachable from the branch root')
          for (const id of path) assert.equal(equipPick(ship, slot, branch.id, id).ok, true, id)
          assert.equal(ship.equip[slot]?.tierId, tier.id)
          assert.ok(Object.values(derived(ship)).every(Number.isFinite))
          ship.input = { ...ship.input, firing: true, aimAngle: 0, aimDist: 180 }
          const events: WorldEvent[] = []
          stepShipWeapons(world, ship, 0.05, events)

          if (tier.effect.kind === 'cannon') {
            assert.equal(world.bullets.size, tier.effect.count)
            for (const bullet of world.bullets.values()) {
              assert.equal(bullet.kind, tier.effect.projectile ?? 'ball')
              assert.ok(
                [bullet.x, bullet.y, bullet.vx, bullet.vy, bullet.damage, bullet.radius].every(
                  Number.isFinite,
                ),
              )
              assert.ok(bullet.damage > 0 && bullet.remainingRange > 0)
            }
            stepShipWeapons(world, ship, 0.001, events)
            assert.equal(world.bullets.size, tier.effect.count, 'Cooldown prevents an immediate second salvo')
          } else if (tier.effect.kind === 'mine') {
            assert.equal(world.mines.size, 1)
            const mine = [...world.mines.values()][0]
            assert.ok(mine.expiresAt > mine.placedAt)
            assert.ok(mine.oil ? mine.oil.dps > 0 : mine.damage > 0)
            assert.equal(!!mine.oil, !!tier.effect.oil)
            stepShipWeapons(world, ship, 0.001, events)
            assert.equal(world.mines.size, 1, 'Cooldown prevents duplicate mines')
          } else if (tier.effect.kind === 'ram') {
            assert.ok(derived(ship).ramDamage > base.ramDamage)
            assert.ok(derived(ship).maxHp > base.maxHp)
          } else if (tier.effect.kind === 'rudder') {
            assert.ok(derived(ship).turnRateRad > base.turnRateRad)
          } else {
            assert.ok(derived(ship).reloadMult < base.reloadMult)
            assert.ok(derived(ship).moveSpeed > base.moveSpeed)
          }
        })
      }
    }
  }
})

test('every fleet type is charged once and remains valid during combat', async (t) => {
  for (const fleet of FLEET_SHIPS) {
    await t.test(fleet.id, () => {
      const world = createWorld('ffa', 20260919)
      const ship = createShip(world, 'captain', 'Captain', 'captain', false)
      ship.coins = fleet.cost
      const purchase = buyFleet(world, ship, fleet.id)
      assert.equal(purchase.ok, true)
      assert.ok(purchase.unitId)
      assert.equal(ship.coins, 0)
      assert.equal(world.fleet.get(purchase.unitId)?.defId, fleet.id)
      assert.equal(buyFleet(world, ship, fleet.id).ok, false)
      for (let i = 0; i < 200; i++) simulateTick(world, 0.05)
      for (const unit of world.fleet.values()) {
        assert.ok([unit.x, unit.y, unit.vx, unit.vy, unit.hp].every(Number.isFinite))
      }
      assert.ok(ship.coins >= 0)
    })
  }
})
