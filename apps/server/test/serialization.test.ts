import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Encoder, Decoder } from '@colyseus/schema'
import { RoomStateSchema } from '@doblonia/protocol'
import { createWorld, createShip, simulateTick, buyFleet, derived } from '@doblonia/sim'
import { SLOT_ORDER, BRANCHES_BY_SLOT, FLEET_SHIPS } from '@doblonia/content'
import { syncIslandsOnce, syncWorldToState } from '../src/sync.js'

test('state patches preserve a busy world through additions, removals and large map indexes', (t) => {
  t.mock.method(console, 'warn', (...args: unknown[]) => {
    throw new Error(`Serialization warning: ${String(args[0])}`)
  })
  t.mock.method(console, 'error', (...args: unknown[]) => {
    throw new Error(`Serialization error: ${String(args[0])}`)
  })
  Encoder.BUFFER_SIZE = 128 * 1024
  const world = createWorld('ffa', 20260919)
  for (let i = 0; i < 24; i++) createShip(world, `bot${i}`, `Bot ${i}`, null, true)
  const state = new RoomStateSchema()
  syncIslandsOnce(world, state)
  syncWorldToState(world, state)
  const encoder = new Encoder(state)
  const client = new Decoder(new RoomStateSchema())
  client.decode(encoder.encodeAll())
  encoder.discardChanges()

  for (let tick = 0; tick < 2400; tick++) {
    if (tick % 20 === 0) {
      for (const [index, ship] of [...world.ships.values()].entries()) {
        if (!ship.alive) continue
        ship.coins = 100000
        if (ship.equipLevel === 1) {
          ship.statLevels = {
            hull: 15,
            repair: 15,
            range: 15,
            damage: 15,
            reload: 15,
            speed: 0,
            turn: 0,
            ram: 0,
          }
          ship.equipLevel = 20
          ship.equipPicks = 0
          for (const slot of SLOT_ORDER) {
            const branch = BRANCHES_BY_SLOT[slot][index % BRANCHES_BY_SLOT[slot].length]
            ship.equip[slot] = { branchId: branch.id, tierId: branch.tiers.at(-1)!.id }
          }
          ship.loadoutVersion++
          ship.maxHp = ship.hp = derived(ship).maxHp
        }
        for (const fleet of FLEET_SHIPS) buyFleet(world, ship, fleet.id)
      }
    }
    simulateTick(world, 0.05)
    syncWorldToState(world, state)
    client.decode(encoder.encode())
    encoder.discardChanges()
    if (tick % 20 === 0) {
      const fresh = new Decoder(new RoomStateSchema())
      fresh.decode(encoder.encodeAll())
      assert.deepEqual(
        client.state.toJSON(),
        fresh.state.toJSON(),
        `Patch differs from snapshot at tick ${tick}`,
      )
    }
  }
})
