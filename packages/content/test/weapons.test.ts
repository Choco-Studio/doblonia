import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BRANCHES_BY_SLOT, SLOT_ORDER } from '../src/index.js'

test('every weapon branch is reachable, has unique identifiers and only forward upgrades', () => {
  const allIds = new Set<string>()
  for (const slot of SLOT_ORDER) {
    for (const branch of BRANCHES_BY_SLOT[slot]) {
      assert.equal(branch.slot, slot)
      assert.equal(branch.tiers[0].tier, 1)
      const byId = new Map(branch.tiers.map((tier) => [tier.id, tier]))
      assert.equal(byId.size, branch.tiers.length, `Duplicate tier in ${branch.id}`)
      const reached = new Set<string>()
      const visit = (id: string): void => {
        if (reached.has(id)) return
        reached.add(id)
        const tier = byId.get(id)
        assert.ok(tier, `Missing tier ${id}`)
        for (const next of tier.nextIds ?? []) {
          assert.ok(byId.has(next), `Broken upgrade ${id} → ${next}`)
          assert.ok(byId.get(next)!.tier > tier.tier, `Backwards upgrade ${id} → ${next}`)
          visit(next)
        }
      }
      visit(branch.tiers[0].id)
      assert.equal(reached.size, branch.tiers.length, `Unreachable tier in ${branch.id}`)
      for (const tier of branch.tiers) {
        assert.ok(!allIds.has(tier.id), `Duplicate global identifier ${tier.id}`)
        allIds.add(tier.id)
        const effect = tier.effect
        if ('reloadMs' in effect) assert.ok(effect.reloadMs > 0, `Invalid reload for ${tier.id}`)
        if ('damage' in effect) assert.ok(Number.isFinite(effect.damage) && effect.damage >= 0)
      }
    }
  }
})
