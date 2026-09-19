import { SHIP_BASE } from '@doblonia/content'
import type { Ship, ShipInput, World, WorldEvent } from './types.js'
import { derived, type DerivedStats } from './loadout.js'
import { islandContact } from './world.js'
import { slowFactor } from './status.js'

const OUT_OF_COMBAT_MS = 4000

export interface MotionBody {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
}

/** El mismo efecto de aparejo roto se aplica al servidor y a la predicción. */
export function movementStats(
  d: Pick<DerivedStats, 'moveSpeed' | 'turnRateRad'>,
  slow = 1,
): Pick<DerivedStats, 'moveSpeed' | 'turnRateRad'> {
  return { moveSpeed: d.moveSpeed * slow, turnRateRad: d.turnRateRad * (0.5 + slow * 0.5) }
}

/**
 * Integración pura del movimiento de un barco (sin mundo). La usan el servidor
 * y la predicción local del cliente, para que ambos muevan el barco igual.
 */
export function integrateMotion(
  body: MotionBody,
  input: Pick<ShipInput, 'throttle' | 'turn'>,
  d: Pick<DerivedStats, 'moveSpeed' | 'turnRateRad'>,
  dt: number,
): void {
  // Girar es más lento casi parado y alcanza su máximo a media velocidad.
  const speedNow = Math.hypot(body.vx, body.vy)
  const turnFactor = 0.55 + 0.45 * Math.min(1, speedNow / (d.moveSpeed * 0.5))
  body.angle += Math.max(-1, Math.min(1, input.turn)) * d.turnRateRad * turnFactor * dt

  const throttle = Math.max(-1, Math.min(1, input.throttle))
  const accel = throttle >= 0 ? SHIP_BASE.accel : SHIP_BASE.brakeDecel
  const fx = Math.cos(body.angle)
  const fy = Math.sin(body.angle)
  body.vx += fx * throttle * accel * dt
  body.vy += fy * throttle * accel * dt

  // Arrastre lateral fuerte (el casco "muerde" el agua) y longitudinal suave.
  const forward = body.vx * fx + body.vy * fy
  const lateral = -body.vx * fy + body.vy * fx
  const nf = forward * Math.pow(SHIP_BASE.drag, dt * 60)
  const nl = lateral * Math.pow(0.9, dt * 60)
  body.vx = fx * nf - fy * nl
  body.vy = fy * nf + fx * nl

  // Marcha atrás limitada
  const maxReverse = d.moveSpeed * 0.4
  const fwd = body.vx * fx + body.vy * fy
  if (fwd < -maxReverse) {
    body.vx -= fx * (fwd + maxReverse)
    body.vy -= fy * (fwd + maxReverse)
  }

  const speed = Math.hypot(body.vx, body.vy)
  if (speed > d.moveSpeed) {
    const k = d.moveSpeed / speed
    body.vx *= k
    body.vy *= k
  }

  body.x += body.vx * dt
  body.y += body.vy * dt
}

/** Datos mínimos de un remolino (los tienen tanto el mundo del servidor como el estado del cliente). */
export interface WhirlpoolField {
  x: number
  y: number
  radius: number
  strength: number
}

/** Radio del ojo, como fracción del radio: ahí el giro es máximo y la corriente daña. */
export const WHIRL_CORE = 0.26

export interface WhirlCurrent {
  vx: number
  vy: number
  /** Giro que imprime al casco (rad/s; negativo = antihorario en pantalla, como el dibujo). */
  spin: number
  /** 0 fuera del ojo, 1 en el centro exacto. */
  core: number
}

/**
 * Corriente del agua en un punto: vórtice de Rankine suavizado. La velocidad tangencial
 * crece hasta el borde del ojo y decae hacia fuera; la succión hacia el centro se hace
 * más fuerte al acercarse y se desvanece justo en el centro (sin tirones).
 */
export function whirlpoolCurrent(pools: readonly WhirlpoolField[], x: number, y: number): WhirlCurrent {
  const out: WhirlCurrent = { vx: 0, vy: 0, spin: 0, core: 0 }
  for (const w of pools) {
    const dx = w.x - x
    const dy = w.y - y
    const d = Math.hypot(dx, dy)
    if (d >= w.radius || d < 0.5) continue
    const q = d / w.radius
    const nx = dx / d
    const ny = dy / d
    const vt = w.strength * (q < WHIRL_CORE ? q / WHIRL_CORE : Math.pow((1 - q) / (1 - WHIRL_CORE), 1.3))
    const vr = w.strength * 0.34 * Math.pow(1 - q, 0.7) * Math.min(1, q / 0.1)
    // Tangente antihoraria en pantalla (y hacia abajo): coincide con el giro dibujado
    out.vx += nx * vr - ny * vt
    out.vy += ny * vr + nx * vt
    out.spin -= (vt / Math.max(d, 40)) * 0.5
    if (q < WHIRL_CORE) out.core = Math.max(out.core, 1 - q / WHIRL_CORE)
  }
  return out
}

/** Arrastra un cuerpo con la corriente (servidor y predicción del cliente). Devuelve lo metido que está en el ojo. */
export function applyWhirlpools(body: MotionBody, pools: readonly WhirlpoolField[], dt: number): number {
  if (pools.length === 0) return 0
  const c = whirlpoolCurrent(pools, body.x, body.y)
  body.x += c.vx * dt
  body.y += c.vy * dt
  body.angle += c.spin * dt
  return c.core
}

/** Límites del mapa y choque con islas. Devuelve la velocidad de impacto contra la isla (0 si no hubo). */
export function resolveWorldBounds(
  body: MotionBody,
  radius: number,
  world: Pick<World, 'mapSize' | 'islands'>,
): { impact: number; nx: number; ny: number } {
  const half = world.mapSize / 2 - radius
  if (body.x > half) {
    body.x = half
    body.vx = Math.min(0, body.vx) * 0.3
  }
  if (body.x < -half) {
    body.x = -half
    body.vx = Math.max(0, body.vx) * 0.3
  }
  if (body.y > half) {
    body.y = half
    body.vy = Math.min(0, body.vy) * 0.3
  }
  if (body.y < -half) {
    body.y = -half
    body.vy = Math.max(0, body.vy) * 0.3
  }

  const contact = islandContact(world, body.x, body.y, radius)
  if (!contact) return { impact: 0, nx: 0, ny: 0 }
  body.x += contact.nx * contact.depth
  body.y += contact.ny * contact.depth
  const into = body.vx * contact.nx + body.vy * contact.ny
  if (into >= 0) return { impact: 0, nx: contact.nx, ny: contact.ny }
  body.vx -= contact.nx * into * 1.5
  body.vy -= contact.ny * into * 1.5
  return { impact: -into, nx: contact.nx, ny: contact.ny }
}

export function stepShipMovement(ship: Ship, dt: number, world: World, events: WorldEvent[]): void {
  if (!ship.alive) return
  const d = derived(ship)
  const slow = slowFactor(ship.fx, world.timeMs)
  integrateMotion(ship, ship.input, movementStats(d, slow), dt)
  // La corriente se aplica antes de las colisiones: un remolino nunca mete un barco en una isla
  applyWhirlpools(ship, world.whirlpools, dt)
  const hit = resolveWorldBounds(ship, d.radius, world)
  if (hit.impact > 60 && world.timeMs >= ship.spawnProtectedUntil) {
    const dmg = hit.impact * 0.06
    ship.hp -= dmg
    ship.lastDamageAt = world.timeMs
    events.push({ type: 'ramHit', x: ship.x - hit.nx * d.radius, y: ship.y - hit.ny * d.radius, damage: dmg })
  }

  ship.maxHp = d.maxHp
  if (ship.hp > ship.maxHp) ship.hp = ship.maxHp

  const inCombat = world.timeMs - ship.lastDamageAt < OUT_OF_COMBAT_MS
  if (!inCombat && ship.hp < ship.maxHp) {
    ship.hp = Math.min(ship.maxHp, ship.hp + d.regenPerSec * dt)
  }
}
