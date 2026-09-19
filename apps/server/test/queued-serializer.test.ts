import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ClientState, type Client } from '@colyseus/core'
import { Decoder } from '@colyseus/schema'
import { RoomStateSchema } from '@doblonia/protocol'
import { QueuedSchemaSerializer } from '../src/QueuedSchemaSerializer.js'

test('queued state frames remain unchanged while later snapshots and patches are encoded', () => {
  const state = new RoomStateSchema()
  const serializer = new QueuedSchemaSerializer<RoomStateSchema>()
  serializer.reset(state)
  const initial = serializer.getFullState()
  const savedInitial = initial.slice()
  const queued: Uint8Array[] = []
  const client = {
    state: ClientState.JOINED,
    raw: (data: Uint8Array) => {
      queued.push(data)
    },
  } as unknown as Client
  // Emula un transporte que retiene los buffers sin copiarlos hasta recuperar capacidad.
  for (let i = 1; i <= 10; i++) {
    state.timeMs = i * 50
    serializer.applyPatches([client])
    serializer.getFullState()
  }
  assert.deepEqual(initial, savedInitial)
  const decoder = new Decoder(new RoomStateSchema())
  decoder.decode(initial, { offset: 1 })
  for (const [index, frame] of queued.entries()) {
    decoder.decode(frame, { offset: 1 })
    assert.equal(decoder.state.timeMs, (index + 1) * 50)
  }
})
