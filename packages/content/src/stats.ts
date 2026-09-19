export type StatId = 'hull' | 'repair' | 'range' | 'damage' | 'reload' | 'speed' | 'turn' | 'ram'

export interface StatDef {
  id: StatId
  name: string
  shortName: string
  description: string
  maxLevel: number
}

export const STAT_ORDER: StatId[] = ['hull', 'repair', 'range', 'damage', 'reload', 'speed', 'turn', 'ram']

export const STAT_DEFS: Record<StatId, StatDef> = {
  hull: {
    id: 'hull',
    name: 'Casco',
    shortName: 'HP',
    description: '+65 de vida máxima y cura 65 al instante. -3.5% de velocidad por nivel.',
    maxLevel: 15,
  },
  repair: {
    id: 'repair',
    name: 'Auto-reparación',
    shortName: 'REG',
    description: '+1.5 HP/s de regeneración pasiva fuera de combate.',
    maxLevel: 15,
  },
  range: {
    id: 'range',
    name: 'Alcance',
    shortName: 'ALC',
    description: '+26 de velocidad de bala y +0.3 de longitud de cañón por nivel.',
    maxLevel: 15,
  },
  damage: {
    id: 'damage',
    name: 'Daño de cañón',
    shortName: 'DMG',
    description: '+6% de daño con todas las armas y +0.4 de ancho de proyectil por nivel.',
    maxLevel: 15,
  },
  reload: {
    id: 'reload',
    name: 'Recarga',
    shortName: 'REC',
    description: '-4% de tiempo de recarga por nivel en todas las armas.',
    maxLevel: 15,
  },
  speed: {
    id: 'speed',
    name: 'Movimiento',
    shortName: 'VEL',
    description: '+5 de velocidad por segundo por nivel.',
    maxLevel: 15,
  },
  turn: {
    id: 'turn',
    name: 'Giro',
    shortName: 'GIR',
    description: '+3 grados/s de velocidad de giro por nivel.',
    maxLevel: 15,
  },
  ram: {
    id: 'ram',
    name: 'Embestida',
    shortName: 'RAM',
    description: '+8% de daño por colisión por nivel.',
    maxLevel: 15,
  },
}

export const TOTAL_STAT_POINTS_CAP = 75

/** Coste de la siguiente compra de una estadística con `n` niveles ya comprados (0-indexado). */
export function statUpgradeCost(n: number): number {
  return 10 * (n + 1)
}
