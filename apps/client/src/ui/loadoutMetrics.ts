import { SLOT_ORDER, findTier, type SlotId, type WeaponTier } from '@doblonia/content'
import { computeDerivedStats } from '@doblonia/sim'

export type EquipMap = Partial<Record<SlotId, { branchId: string; tierId: string }>>

export interface LoadoutMetrics {
  /** Daño por segundo teórico sumando todas las armas (incluye quemaduras y minas). */
  firepower: number
  /** Alcance del arma de más alcance. */
  range: number
  speed: number
  turnDeg: number
  ram: number
}

export interface MetricDef {
  key: keyof LoadoutMetrics
  label: string
  cap: number
  color: string
  unit?: string
}

/** Escalas fijas: permiten comparar tarjetas de bandejas distintas con la misma vara de medir. */
export const METRICS: MetricDef[] = [
  { key: 'firepower', label: 'Fuego', cap: 150, color: 'var(--c-damage)' },
  { key: 'range', label: 'Alcance', cap: 720, color: 'var(--c-range)' },
  { key: 'speed', label: 'Velocidad', cap: 230, color: 'var(--c-speed)' },
  { key: 'turnDeg', label: 'Giro', cap: 220, color: 'var(--c-turn)', unit: '°/s' },
  { key: 'ram', label: 'Embestida', cap: 70, color: 'var(--c-ram)' },
]

export function loadoutMetrics(stats: Record<string, number>, equip: EquipMap): LoadoutMetrics {
  const d = computeDerivedStats({ statLevels: stats, equip })
  let firepower = 0
  let range = 0
  for (const slot of SLOT_ORDER) {
    const eq = equip[slot]
    if (!eq) continue
    const tier = findTier(slot, eq.branchId, eq.tierId)
    if (!tier) continue
    const e = tier.effect
    if (e.kind === 'cannon') {
      const perSalvo = e.count * e.damage * d.damageMult
      firepower += perSalvo / ((e.reloadMs * d.reloadMult) / 1000)
      if (e.burn) firepower += e.burn.dps
      range = Math.max(range, e.range + d.rangeBonus)
    } else if (e.kind === 'mine') {
      firepower += e.oil ? e.oil.dps * 0.6 : (e.damage * d.damageMult) / ((e.reloadMs * d.reloadMult) / 1000)
    }
  }
  if (!equip.deck) {
    // Cañoncito inicial mientras no hay arma de Cubierta
    firepower += (8 * d.damageMult) / ((600 * d.reloadMult) / 1000)
    range = Math.max(range, 260 + d.rangeBonus)
  }
  return {
    firepower,
    range,
    speed: d.moveSpeed,
    turnDeg: (d.turnRateRad * 180) / Math.PI,
    ram: d.ramDamage,
  }
}

/** Etiquetas cortas de lo que hace especial a una pieza. */
export function tierTags(tier: WeaponTier): { text: string; cls: string }[] {
  const out: { text: string; cls: string }[] = []
  const e = tier.effect
  if (e.kind === 'cannon') {
    if (e.count > 1) out.push({ text: `×${e.count} cañones`, cls: '' })
    if (e.autoAim) out.push({ text: 'Apunta solo', cls: 'pos' })
    else if (e.aimed) out.push({ text: 'Sigue al ratón', cls: '' })
    if (e.projectile === 'chain' && e.slow)
      out.push({ text: `Ralentiza ${Math.round((1 - e.slow.mult) * 100)}%`, cls: 'ice' })
    if (e.projectile === 'fire' && e.burn) out.push({ text: `Quema ${e.burn.dps}/s`, cls: 'fire' })
    if (e.projectile === 'mortar')
      out.push({ text: `Área ${e.aoe ?? 50}`, cls: 'fire' }, { text: 'Cae donde apuntas', cls: '' })
  } else if (e.kind === 'mine') {
    if (e.oil) out.push({ text: `Aceite: quema ${e.oil.dps}/s`, cls: 'fire' })
    else out.push({ text: `Mina ${e.damage}`, cls: '' })
  } else if (e.kind === 'ram') {
    out.push({ text: `Embestida ×${e.ramDamageMult}`, cls: 'pos' })
  } else if (e.kind === 'rudder') {
    out.push({ text: `Giro +${e.turnRateBonusDeg}°/s`, cls: 'pos' })
  } else if (e.kind === 'oars') {
    out.push({ text: `${e.pairs} pares de remos`, cls: 'pos' })
  }
  if (tier.hitboxScale && tier.hitboxScale > 1)
    out.push({ text: `Casco +${Math.round((tier.hitboxScale - 1) * 100)}%`, cls: 'neg' })
  return out
}

export function fmtMetric(key: keyof LoadoutMetrics, v: number): string {
  if (key === 'turnDeg') return `${Math.round(v)}°`
  return String(Math.round(v))
}
