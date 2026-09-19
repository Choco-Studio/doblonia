import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Client, Room } from '@colyseus/sdk'
import type { RoomStateSchema } from '@doblonia/protocol'
import { Connection } from '../src/net/Connection.js'

function room() {
  const sent: { type: string; data: unknown }[] = []
  let leaves = 0
  const value = {
    reconnectionToken: 'test-token',
    reconnection: { enabled: true },
    connection: { isOpen: true },
    onMessage: () => () => {},
    send: (type: string, data: unknown) => sent.push({ type, data }),
    leave: async () => {
      leaves++
      value.connection.isOpen = false
      return 4000
    },
  }
  return {
    value: value as unknown as Room<RoomStateSchema>,
    sent,
    leaves: () => leaves,
    disconnect: () => {
      value.connection.isOpen = false
    },
  }
}

function client(joined: Room<RoomStateSchema>, reconnect: () => Promise<Room<RoomStateSchema>>) {
  return { joinOrCreate: async () => joined, reconnect } as unknown as Pick<
    Client,
    'joinOrCreate' | 'reconnect'
  >
}

test('reconnection retains the recovered transport and sends fresh input', async () => {
  const first = room()
  const recovered = room()
  const connection = new Connection(client(first.value, async () => recovered.value))
  try {
    await connection.join('ffa', 'Captain', 'roble')
    const input = { throttle: 1, turn: 0, aimAngle: 0, aimDist: 300, firing: false, fireCoin: false }
    connection.sendInput(input)
    assert.equal(await connection.reconnect(), recovered.value)
    assert.equal(connection.state, 'connected')
    assert.equal(recovered.leaves(), 0)
    connection.sendInput(input)
    assert.equal(recovered.sent.length, 1, 'the old input cache does not swallow the first recovered command')
    connection.leave()
    assert.equal(recovered.leaves(), 1)
  } finally {
    connection.leave()
  }
})

test('leaving during recovery disposes a late connection without reopening the session', async () => {
  const first = room()
  const recovered = room()
  let finish!: (value: Room<RoomStateSchema>) => void
  const pending = new Promise<Room<RoomStateSchema>>((resolve) => {
    finish = resolve
  })
  const connection = new Connection(client(first.value, () => pending))
  await connection.join('ffa', 'Captain', 'roble')
  const recovery = connection.reconnect()
  connection.leave()
  finish(recovered.value)
  assert.equal(await recovery, undefined)
  assert.equal(connection.room, undefined)
  assert.equal(connection.state, 'closed')
  assert.equal(recovered.leaves(), 1)
})

test('leaving during matchmaking closes a late reservation', async () => {
  const joined = room()
  let finish!: (value: Room<RoomStateSchema>) => void
  const pending = new Promise<Room<RoomStateSchema>>((resolve) => {
    finish = resolve
  })
  const connection = new Connection({ joinOrCreate: () => pending } as unknown as Client)
  const joining = connection.join('ffa', 'Captain', 'roble')
  connection.leave()
  finish(joined.value)
  await assert.rejects(joining, /cancelled/)
  assert.equal(joined.leaves(), 1)
  assert.equal(connection.state, 'closed')
})

test('commands are not queued while the transport is disconnected', async () => {
  const first = room()
  const connection = new Connection(client(first.value, async () => first.value))
  try {
    await connection.join('ffa', 'Captain', 'roble')
    first.disconnect()
    assert.equal(connection.buyStat('hull'), false)
    assert.equal(connection.respawn(), false)
    assert.equal(first.sent.length, 0)
  } finally {
    connection.leave()
  }
})
