import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Encoder, Decoder } from '@colyseus/schema'
import { RoomStateSchema, BulletStateSchema } from '@doblonia/protocol'
import { pruneDecodedIndexes } from '../src/net/decodedState.js'

test('projectile turnover releases obsolete indexes without losing patches or reused keys', () => {
  Encoder.BUFFER_SIZE = 128 * 1024
  const state = new RoomStateSchema()
  const encoder = new Encoder(state)
  const decoder = new Decoder(new RoomStateSchema())
  decoder.decode(encoder.encodeAll())
  encoder.discardChanges()
  const flush = () => {
    decoder.decode(encoder.encode())
    encoder.discardChanges()
    pruneDecodedIndexes(decoder.state)
    assert.equal(Object.keys(decoder.state.bullets._collectionIndexes).length, state.bullets.size)
    assert.deepEqual(decoder.state.toJSON(), state.toJSON())
  }
  for (let batch = 0; batch < 200; batch++) {
    for (let i = 0; i < 100; i++) {
      const bullet = new BulletStateSchema()
      bullet.x = batch
      state.bullets.set(`bullet-${batch}-${i}`, bullet)
    }
    flush()
    for (const [id, bullet] of state.bullets) {
      if (id.endsWith('-0')) bullet.x++
      else state.bullets.delete(id)
    }
    flush()
    // Una clave eliminada puede reaparecer con un índice de protocolo distinto.
    state.bullets.set('reused', new BulletStateSchema())
    flush()
    state.bullets.delete('reused')
    flush()
  }
  state.bullets.clear()
  flush()
  assert.equal(decoder.root.refs.size, 9, 'Only the root and its eight collections remain')
})
