import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateSettings } from '../src/settings.js'

test('damaged local preferences cannot introduce invalid audio values or unknown content', () => {
  const result = validateSettings({
    masterVolume: NaN,
    sfxVolume: 42,
    ambientVolume: -1,
    mode: 'unknown',
    skin: '<script>',
    screenShake: 'yes',
    name: 'a'.repeat(500),
  })
  assert.equal(result.masterVolume, 0.7)
  assert.equal(result.sfxVolume, 1)
  assert.equal(result.ambientVolume, 0)
  assert.equal(result.mode, 'ffa')
  assert.equal(result.skin, 'roble')
  assert.equal(result.screenShake, true)
  assert.equal(result.name.length, 16)
  assert.deepEqual(validateSettings(null), validateSettings([]))
})
