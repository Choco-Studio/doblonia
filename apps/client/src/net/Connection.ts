import { Client, Room } from '@colyseus/sdk'
import { RoomStateSchema } from '@doblonia/protocol'
import type { SlotId, StatId } from '@doblonia/content'

export function serverHttpUrl(): string {
  const env = import.meta.env?.VITE_SERVER_URL
  if (env) return env.replace(/^ws/, 'http')
  if (import.meta.env?.DEV) return `${location.protocol}//${location.hostname}:2567`
  return location.origin
}

function serverWsUrl(): string {
  return serverHttpUrl().replace(/^http/, 'ws')
}

export type Mode = 'ffa' | 'tdm'
type ConnectionState = 'idle' | 'joining' | 'connected' | 'reconnecting' | 'closed'
type RoomClient = Pick<Client, 'joinOrCreate' | 'reconnect'>

/** Un intento cancelado puede terminar en la red más tarde: cerramos también esa reserva. */
function waitForRoom(
  pending: Promise<Room<RoomStateSchema>>,
  signal: AbortSignal,
): Promise<Room<RoomStateSchema>> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('Connection was cancelled or timed out'))
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    pending.then(
      (room) => {
        signal.removeEventListener('abort', abort)
        if (signal.aborted) {
          room.reconnection.enabled = false
          void room.leave(true)
        } else resolve(room)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort)
        reject(error)
      },
    )
  })
}

function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    signal.addEventListener('abort', finish, { once: true })
  })
}

export class Connection {
  room?: Room<RoomStateSchema>
  state: ConnectionState = 'idle'
  rtt = 0
  private seq = 0
  private pingTimer: ReturnType<typeof setInterval> | undefined
  private lastSent = ''
  private lastSentAt = 0
  private generation = 0
  private recovery?: AbortController

  constructor(readonly client: RoomClient = new Client(serverWsUrl())) {}

  async join(mode: Mode, name: string, skin: string): Promise<Room<RoomStateSchema>> {
    if (this.state !== 'idle') throw new Error('Connection is already in use')
    this.state = 'joining'
    const generation = this.generation
    const recovery = new AbortController()
    this.recovery = recovery
    const deadline = setTimeout(() => recovery.abort(), 12000)
    try {
      const room = await waitForRoom(
        this.client.joinOrCreate<RoomStateSchema>(`doblonia_${mode}`, { name, skin }, RoomStateSchema),
        recovery.signal,
      )
      if (generation !== this.generation) {
        void room.leave(true)
        throw new Error('Connection was cancelled')
      }
      this.useRoom(room)
      return room
    } catch (error) {
      if (generation === this.generation) this.state = 'idle'
      throw error
    } finally {
      clearTimeout(deadline)
      if (this.recovery === recovery) this.recovery = undefined
    }
  }

  /** Reintenta volver a la misma sala tras un corte de red (el servidor reserva el barco 20 s). */
  async reconnect(): Promise<Room<RoomStateSchema> | undefined> {
    const token = this.room?.reconnectionToken
    if (!token || this.state === 'closed' || this.state === 'reconnecting') return undefined
    this.stopPing()
    this.state = 'reconnecting'
    const generation = this.generation
    const recovery = new AbortController()
    this.recovery = recovery
    const deadline = setTimeout(() => recovery.abort(), 18000)
    try {
      for (let attempt = 0; !recovery.signal.aborted; attempt++) {
        const delay = [0, 500, 1500, 3000][Math.min(attempt, 3)]
        if (delay) await waitForRetry(delay, recovery.signal)
        if (recovery.signal.aborted) return undefined
        try {
          const room = await waitForRoom(
            this.client.reconnect<RoomStateSchema>(token, RoomStateSchema),
            recovery.signal,
          )
          // Una respuesta tardía nunca debe reabrir una partida abandonada.
          if (generation !== this.generation) {
            void room.leave(true)
            return undefined
          }
          this.recovery = undefined
          this.useRoom(room)
          return room
        } catch {
          if (recovery.signal.aborted) return undefined
        }
      }
      this.recovery = undefined
      return undefined
    } finally {
      clearTimeout(deadline)
      if (this.recovery === recovery) this.recovery = undefined
    }
  }

  leave(): void {
    this.generation++
    this.state = 'closed'
    this.recovery?.abort()
    this.recovery = undefined
    this.stopPing()
    const room = this.room
    this.room = undefined
    if (room) void room.leave(true)
  }

  private useRoom(room: Room<RoomStateSchema>): void {
    // Cada recuperación recibe un snapshot completo y reconstruye la vista de la partida.
    room.reconnection.enabled = false
    this.room = room
    this.state = 'connected'
    this.lastSent = ''
    this.lastSentAt = 0
    this.rtt = 0
    this.startPing()
  }

  private stopPing(): void {
    clearInterval(this.pingTimer)
    this.pingTimer = undefined
  }

  private startPing(): void {
    this.stopPing()
    this.room?.onMessage('pong', (msg: { t: number }) => {
      const sample = performance.now() - msg.t
      if (!Number.isFinite(sample) || sample < 0) return
      this.rtt = this.rtt === 0 ? sample : this.rtt * 0.8 + sample * 0.2
    })
    this.pingTimer = setInterval(() => this.send('ping', { t: performance.now() }), 2000)
  }

  private send(type: string, message?: unknown): boolean {
    if (this.state !== 'connected' || !this.room?.connection.isOpen) return false
    this.room.send(type, message)
    return true
  }

  sendInput(
    input: {
      throttle: number
      turn: number
      aimAngle: number
      aimDist: number
      firing: boolean
      fireCoin: boolean
    },
    force = false,
  ): void {
    if (this.state !== 'connected' || !this.room?.connection.isOpen) return
    const key = `${input.throttle}|${input.turn}|${input.aimAngle.toFixed(2)}|${Math.round(input.aimDist / 10)}|${input.firing}|${input.fireCoin}`
    const now = performance.now()
    // Sin cambios no se reenvía, salvo un latido cada 250 ms (p. ej. tras reaparecer el servidor reinicia el input).
    if (!force && key === this.lastSent && now - this.lastSentAt < 250) return
    this.lastSent = key
    this.lastSentAt = now
    this.seq++
    this.room.send('input', { ...input, seq: this.seq })
  }

  buyStat(statId: StatId): boolean {
    return this.send('buyStat', { statId })
  }

  equipPick(slot: SlotId, branchId: string, tierId: string): boolean {
    return this.send('equipPick', { slot, branchId, tierId })
  }

  buyFleet(defId: string): boolean {
    return this.send('buyFleet', { defId })
  }

  respawn(): boolean {
    return this.send('respawn')
  }
}

export async function fetchStatus(signal?: AbortSignal): Promise<{ ffa: number; tdm: number } | null> {
  try {
    const res = await fetch(`${serverHttpUrl()}/status`, {
      cache: 'no-store',
      signal: signal ?? AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = await res.json()
    if (!json.ok) return null
    return {
      ffa: json.modes.ffa.players ?? json.modes.ffa.humans,
      tdm: json.modes.tdm.players ?? json.modes.tdm.humans,
    }
  } catch {
    return null
  }
}
