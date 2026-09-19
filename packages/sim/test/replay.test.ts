import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, createShip, simulateTick } from '../src/index.js'

test('a seed reproduces the map, bot choices and combat without sharing a random stream', () => {
  const first = createWorld('ffa', 815)
  const replay = createWorld('ffa', 815)
  const different = createWorld('ffa', 816)
  assert.deepEqual(first.islands, replay.islands)
  assert.notDeepEqual(first.islands, different.islands)
  for (const world of [first, replay]) {
    for (let i = 0; i < 8; i++) createShip(world, `bot${i}`, `Bot ${i}`, null, true)
  }
  for (let tick = 0; tick < 600; tick++) {
    assert.deepEqual(simulateTick(first, 0.05), simulateTick(replay, 0.05))
  }
  assert.deepEqual([...first.ships.values()], [...replay.ships.values()])
  assert.deepEqual([...first.coins.values()], [...replay.coins.values()])
})
