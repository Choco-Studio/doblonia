import type { Afflictions } from './types.js'

export function applySlow(fx: Afflictions, now: number, mult: number, ms: number): void {
  // Se queda el efecto más fuerte; la duración se renueva.
  if (now >= fx.slowUntil || mult < fx.slowMult) fx.slowMult = mult
  fx.slowUntil = Math.max(fx.slowUntil, now + ms)
}

export function applyBurn(
  fx: Afflictions,
  now: number,
  dps: number,
  ms: number,
  sourceId: string | null,
): void {
  if (now >= fx.burnUntil || dps >= fx.burnDps) {
    fx.burnDps = dps
    fx.burnBy = sourceId
  }
  fx.burnUntil = Math.max(fx.burnUntil, now + ms)
}

export function isSlowed(fx: Afflictions, now: number): boolean {
  return now < fx.slowUntil
}

export function isBurning(fx: Afflictions, now: number): boolean {
  return now < fx.burnUntil
}

/** Multiplicador de velocidad actual por ralentización. */
export function slowFactor(fx: Afflictions, now: number): number {
  return now < fx.slowUntil ? fx.slowMult : 1
}

/** Bits de estado para la red: 1 = ralentizado, 2 = ardiendo. */
export function statusBits(fx: Afflictions, now: number): number {
  return (isSlowed(fx, now) ? 1 : 0) | (isBurning(fx, now) ? 2 : 0)
}
