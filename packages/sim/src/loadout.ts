import { findTier, SHIP_BASE, SLOT_ORDER } from '@doblonia/content'
import type { Ship } from './types.js'

export interface DerivedStats {
  maxHp: number
  moveSpeed: number
  turnRateRad: number
  radius: number
  reloadMult: number
  /** Multiplicador de daño de todas las armas (estadística Daño). */
  damageMult: number
  rangeBonus: number
  bulletSpeedBonus: number
  bulletSizeBonus: number
  ramDamage: number
  regenPerSec: number
  /** Multiplicador del daño que recibe al chocar (espolón = proa blindada). */
  ramTakenMult: number
}

interface LoadoutSource {
  statLevels: Partial<Ship['statLevels']>
  equip: Ship['equip']
}

const DEG2RAD = Math.PI / 180

export function computeDerivedStats(ship: LoadoutSource): DerivedStats {
  const lv = (k: keyof Ship['statLevels']) => ship.statLevels[k] ?? 0
  const hullLv = lv('hull')

  let moveSpeedMult = 1 - hullLv * 0.035
  let turnRateDeg = SHIP_BASE.turnRateDeg + lv('turn') * 3
  let turnRateFlatBonusDeg = 0
  let hitboxScale = 1 + hullLv * 0.012
  let ramItemMult = 1
  let ramTakenMult = 1
  let armorHp = 0
  let oarPairs = 0

  for (const slot of SLOT_ORDER) {
    const eq = ship.equip[slot]
    if (!eq) continue
    const tier = findTier(slot, eq.branchId, eq.tierId)
    if (!tier) continue
    if (tier.moveSpeedMult) moveSpeedMult *= tier.moveSpeedMult
    if (tier.turnRateMult) turnRateDeg *= tier.turnRateMult
    if (tier.hitboxScale) hitboxScale *= tier.hitboxScale
    if (tier.effect.kind === 'ram') {
      ramItemMult = tier.effect.ramDamageMult
      ramTakenMult = 0.62 - tier.tier * 0.04
      armorHp = 10 + tier.tier * 50
    }
    if (tier.effect.kind === 'oars') oarPairs = tier.effect.pairs
    if (tier.effect.kind === 'rudder') turnRateFlatBonusDeg += tier.effect.turnRateBonusDeg
  }

  turnRateDeg += turnRateFlatBonusDeg

  return {
    maxHp: SHIP_BASE.maxHp + hullLv * 65 + armorHp,
    moveSpeed: Math.max(40, (SHIP_BASE.moveSpeed + lv('speed') * 5) * moveSpeedMult),
    turnRateRad: turnRateDeg * DEG2RAD,
    radius: SHIP_BASE.radius * hitboxScale,
    reloadMult: Math.pow(0.96, lv('reload')) * (1 - oarPairs * 0.02),
    damageMult: 1 + lv('damage') * 0.06,
    rangeBonus: lv('range') * 8,
    bulletSpeedBonus: lv('range') * 26,
    bulletSizeBonus: lv('damage') * 0.4,
    ramDamage: SHIP_BASE.ramDamage * ramItemMult * (1 + lv('ram') * 0.08) * (1 + oarPairs * 0.1),
    regenPerSec: 0.6 + lv('repair') * 1.5,
    ramTakenMult,
  }
}

const cache = new WeakMap<Ship, { version: number; stats: DerivedStats }>()

/** Versión cacheada: se recalcula solo cuando cambia `loadoutVersion` (compra, equipo, reaparición). */
export function derived(ship: Ship): DerivedStats {
  const hit = cache.get(ship)
  if (hit && hit.version === ship.loadoutVersion) return hit.stats
  const stats = computeDerivedStats(ship)
  cache.set(ship, { version: ship.loadoutVersion, stats })
  return stats
}
