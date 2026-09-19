import { Room, SchemaSerializer, CloseCode, type Client, type Serializer } from '@colyseus/core'
import {
  createShip,
  createWorld,
  simulateTick,
  purchaseStat,
  equipPick,
  buyFleet,
  neutralInput,
  grantReward,
  applyBurn,
  applySlow,
  type World,
  type Ship,
  type GameMode,
  type WorldEvent,
} from '@doblonia/sim'
import { SLOT_ORDER, STAT_ORDER, SKINS, DEFAULT_SKIN, type SlotId, type StatId } from '@doblonia/content'
import { RoomStateSchema } from '@doblonia/protocol'
import { syncIslandsOnce, syncWorldToState } from './sync.js'
import { ensureBotPopulation, smallerTeam } from './bots.js'
import { QueuedSchemaSerializer } from './QueuedSchemaSerializer.js'

const TICK_MS = 50 // 20 Hz, coherente con el plan maestro
const TICK_DT = TICK_MS / 1000
const RECONNECT_SECONDS = 20
const MAX_MESSAGES_PER_SECOND = 80
const RECONNECTABLE_CODES: readonly number[] = [
  CloseCode.NORMAL_CLOSURE,
  CloseCode.ABNORMAL_CLOSURE,
  CloseCode.GOING_AWAY,
  CloseCode.NO_STATUS_RECEIVED,
  CloseCode.MAY_TRY_RECONNECT,
]

function clamp(v: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return Math.max(min, Math.min(max, n))
}

const BLOCKED_WORDS = /(admin|moderador|server|servidor)/i

export function sanitizeName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.normalize('NFKC').trim().slice(0, 16) : ''
  const cleaned = s
    .replace(/[^\p{L}\p{N} _.'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length === 0 || BLOCKED_WORDS.test(cleaned)) return 'Marinero'
  return cleaned
}

export class DobloniaRoom extends Room<{
  state: RoomStateSchema
  metadata: { mode: GameMode; humans: number; players: number }
}> {
  maxClients = 24
  maxMessagesPerSecond = MAX_MESSAGES_PER_SECOND
  private world!: World
  private botIds = new Set<string>()
  private lastInput = new Map<string, number>()
  private handoffSession: string | undefined

  override checkReconnectionToken(token: string) {
    // Colyseus también usa WITH_ERROR al sustituir un socket que aún no detectó el corte.
    // Solo esa sustitución, autenticada con el token vigente, conserva la reserva.
    this.handoffSession = this.clients.find((client) => client.reconnectionToken === token)?.sessionId
    try {
      return super.checkReconnectionToken(token)
    } finally {
      this.handoffSession = undefined
    }
  }

  override setSerializer(serializer: Serializer<RoomStateSchema>): void {
    super.setSerializer(
      serializer instanceof SchemaSerializer ? new QueuedSchemaSerializer<RoomStateSchema>() : serializer,
    )
  }

  onCreate(options: { mode?: GameMode }): void {
    const mode: GameMode = options?.mode === 'tdm' ? 'tdm' : 'ffa'
    this.world = createWorld(mode)
    this.state = new RoomStateSchema()
    this.state.mode = mode
    this.state.mapSize = this.world.mapSize
    syncIslandsOnce(this.world, this.state)
    ensureBotPopulation(this.world, this.botIds)
    this.setMetadata({ mode, humans: 0, players: this.world.ships.size })

    this.onMessage('input', (client, data: unknown) => {
      const msg = record(data)
      const ship = this.shipFor(client)
      if (!ship || !ship.alive) return
      this.lastInput.set(client.sessionId, this.world.timeMs)
      ship.input = {
        throttle: clamp(msg?.throttle, -1, 1),
        turn: clamp(msg?.turn, -1, 1),
        aimAngle: clamp(msg?.aimAngle, -Math.PI * 4, Math.PI * 4, ship.input.aimAngle),
        aimDist: clamp(msg?.aimDist, 0, 1200, ship.input.aimDist),
        firing: msg?.firing === true,
        fireCoin: msg?.fireCoin === true,
        seq: clamp(msg?.seq, 0, Number.MAX_SAFE_INTEGER),
      }
    })

    this.onMessage('buyStat', (client, data: unknown) => {
      const msg = record(data)
      const ship = this.shipFor(client)
      if (!ship || !STAT_ORDER.includes(msg.statId as StatId)) return
      client.send('actionResult', { action: 'buyStat', ...purchaseStat(ship, msg.statId as StatId) })
    })

    this.onMessage('equipPick', (client, data: unknown) => {
      const msg = record(data)
      const ship = this.shipFor(client)
      if (!ship || !SLOT_ORDER.includes(msg.slot as SlotId)) return
      if (typeof msg?.branchId !== 'string' || typeof msg?.tierId !== 'string') return
      client.send('actionResult', {
        action: 'equipPick',
        ...equipPick(ship, msg.slot as SlotId, msg.branchId, msg.tierId),
      })
    })

    this.onMessage('buyFleet', (client, data: unknown) => {
      const msg = record(data)
      const ship = this.shipFor(client)
      if (!ship || typeof msg?.defId !== 'string') return
      client.send('actionResult', { action: 'buyFleet', ...buyFleet(this.world, ship, msg.defId) })
    })

    this.onMessage('respawn', (client) => {
      const ship = this.shipFor(client)
      if (ship && !ship.alive) ship.respawnRequested = true
    })

    // Solo en desarrollo local (scripts/dev.mjs): atajos para probar progresión y zonas del mapa.
    if (process.env.DOBLONIA_DEV === '1' && process.env.NODE_ENV !== 'production') {
      this.onMessage('dev', (client, data: unknown) => {
        const msg = record(data)
        const ship = this.world.ships.get(client.sessionId)
        if (!ship || !ship.alive) return
        if (typeof msg?.reward === 'number') grantReward(this.world, ship, clamp(msg.reward, 0, 100000), [])
        if (msg?.burn === true) applyBurn(ship.fx, this.world.timeMs, 3, 6000, null)
        if (msg?.slow === true) applySlow(ship.fx, this.world.timeMs, 0.5, 6000)
        if (typeof msg?.x === 'number' && typeof msg?.y === 'number') {
          ship.x = clamp(msg.x, -this.world.mapSize / 2, this.world.mapSize / 2)
          ship.y = clamp(msg.y, -this.world.mapSize / 2, this.world.mapSize / 2)
          ship.vx = ship.vy = 0
        }
      })
    }

    this.onMessage('ping', (client, data: unknown) => {
      const msg = record(data)
      if (typeof msg.t === 'number' && Number.isFinite(msg.t)) client.send('pong', { t: msg.t })
    })

    this.setTimestep(() => this.tick(), TICK_MS)
  }

  private shipFor(client: Client): Ship | undefined {
    return this.world.ships.get(client.sessionId)
  }

  private tick(): void {
    // Un navegador en segundo plano puede mantener el socket abierto sin enviar controles.
    for (const [id, at] of this.lastInput) {
      if (this.world.timeMs - at <= 1000) continue
      const ship = this.world.ships.get(id)
      if (ship) ship.input = { ...neutralInput(), aimAngle: ship.input.aimAngle, seq: ship.input.seq }
      this.lastInput.delete(id)
    }
    const events = simulateTick(this.world, TICK_DT)
    // La población de bots se ajusta sola: se republica la ocupación cada ~5 s
    if (Math.floor(this.world.timeMs / 5000) !== Math.floor((this.world.timeMs - TICK_MS) / 5000))
      this.publishMetadata()
    ensureBotPopulation(this.world, this.botIds)
    syncWorldToState(this.world, this.state)
    this.broadcastEvents(events)
  }

  private broadcastEvents(events: WorldEvent[]): void {
    const relevant = events.filter((e) => e.type !== 'shot')
    if (relevant.length === 0) return
    // Los impactos se agrupan: muchas balas pequeñas no deben inundar la red.
    const out =
      relevant.length > 90 ? relevant.filter((e) => e.type !== 'hit' || e.damage >= 8).slice(0, 90) : relevant
    this.broadcast('events', out)
  }

  onJoin(client: Client, data: unknown): void {
    const options = record(data)
    const skin = SKINS.some((s) => s.id === options?.skin) ? options.skin : DEFAULT_SKIN
    const team = this.world.mode === 'tdm' ? smallerTeam(this.world, true) : ''
    createShip(
      this.world,
      client.sessionId,
      sanitizeName(options?.name),
      client.sessionId,
      false,
      team,
      skin as string,
    )
    this.publishMetadata()
  }

  /** Ocupación pública de la sala: el menú muestra cuántos barcos navegan en ella. */
  private publishMetadata(): void {
    this.setMetadata({ mode: this.world.mode, humans: this.humanCount(), players: this.world.ships.size })
  }

  private humanCount(): number {
    let n = 0
    for (const s of this.world.ships.values()) if (!s.isBot) n++
    return n
  }

  async onDrop(client: Client, code: number): Promise<void> {
    const ship = this.world.ships.get(client.sessionId)
    if (ship) ship.input = { ...neutralInput(), aimAngle: ship.input.aimAngle }

    this.lastInput.delete(client.sessionId)
    // Expulsiones y errores de protocolo no deben reservar una plaza ni demorar el cierre.
    const handoff = code === CloseCode.WITH_ERROR && this.handoffSession === client.sessionId
    if (!handoff && !RECONNECTABLE_CODES.includes(code)) return
    try {
      await this.allowReconnection(client, RECONNECT_SECONDS)
    } catch {
      // Colyseus llama a onLeave cuando vence la reserva.
    }
  }

  onLeave(client: Client): void {
    this.removeShip(client.sessionId)
    this.lastInput.delete(client.sessionId)
    this.publishMetadata()
  }

  private removeShip(id: string): void {
    const ship = this.world.ships.get(id)
    if (!ship) return
    for (const fid of ship.fleetIds) this.world.fleet.delete(fid)
    this.world.ships.delete(id)
  }
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
