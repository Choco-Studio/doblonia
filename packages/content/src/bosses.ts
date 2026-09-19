import type { CannonEffect } from './weapons.js'

export type BossArchetypeId = 'guardian_artillero' | 'acorazado' | 'interceptor' | 'fort'

export interface BossDef {
  id: BossArchetypeId
  /** 'fort' = torre fija en una isla (no navega, no embiste). */
  kind: 'boss' | 'fort'
  name: string
  description: string
  hp: number
  contactDamage: number
  moveSpeed: number
  turnRateDeg: number
  radius: number
  guardRadius: number
  regenPerSecOutOfCombat: number
  rewardCoins: number
  respawnMs: number
  weapons: CannonEffect[]
}

/** Dispara salvas amplias de largo alcance, obliga a leer el patrón y romper línea de tiro. */
export const GUARDIAN_ARTILLERO: BossDef = {
  id: 'guardian_artillero',
  kind: 'boss',
  name: 'Guardián Artillero',
  description: 'Lento pero de alcance y potencia de fuego muy altos. Vigila el centro del mapa.',
  hp: 3600,
  contactDamage: 30,
  moveSpeed: 70,
  turnRateDeg: 55,
  radius: 46,
  guardRadius: 620,
  regenPerSecOutOfCombat: 40,
  rewardCoins: 2500,
  respawnMs: 60000,
  weapons: [
    {
      kind: 'cannon',
      count: 8,
      arcsDeg: [70, 82, 94, 106, -70, -82, -94, -106],
      aimed: false,
      autoAim: false,
      damage: 16,
      reloadMs: 1300,
      bulletSpeed: 340,
      bulletRadius: 5,
      range: 420,
      spreadDeg: 2,
    },
    {
      kind: 'cannon',
      count: 1,
      arcsDeg: [0],
      aimed: true,
      autoAim: false,
      damage: 28,
      reloadMs: 1400,
      bulletSpeed: 520,
      bulletRadius: 6,
      range: 520,
      spreadDeg: 0.5,
    },
  ],
}

/** Muy lento y muy resistente. Letal en corto alcance, telegrafía sus embestidas. */
export const ACORAZADO: BossDef = {
  id: 'acorazado',
  kind: 'boss',
  name: 'Acorazado',
  description:
    'El más tanque de los tres. Fácil de esquivar en mar abierto, mortal si te acerca contra una isla.',
  hp: 5200,
  contactDamage: 55,
  moveSpeed: 48,
  turnRateDeg: 34,
  radius: 58,
  guardRadius: 560,
  regenPerSecOutOfCombat: 55,
  rewardCoins: 4000,
  respawnMs: 75000,
  weapons: [
    {
      kind: 'cannon',
      count: 4,
      arcsDeg: [85, 100, -85, -100],
      aimed: false,
      autoAim: false,
      damage: 30,
      reloadMs: 1700,
      bulletSpeed: 300,
      bulletRadius: 7,
      range: 320,
      spreadDeg: 3,
    },
  ],
}

/** Rápido, persigue en ráfagas cortas y se retira. Ventanas de esquiva marcadas. */
export const INTERCEPTOR: BossDef = {
  id: 'interceptor',
  kind: 'boss',
  name: 'Interceptor',
  description: 'El más rápido y ágil. Compensa con menos vida y menos daño por impacto.',
  hp: 2400,
  contactDamage: 22,
  moveSpeed: 165,
  turnRateDeg: 130,
  radius: 34,
  guardRadius: 520,
  regenPerSecOutOfCombat: 30,
  rewardCoins: 1800,
  respawnMs: 50000,
  weapons: [
    {
      kind: 'cannon',
      count: 3,
      arcsDeg: [-8, 0, 8],
      aimed: true,
      autoAim: false,
      damage: 12,
      reloadMs: 500,
      bulletSpeed: 460,
      bulletRadius: 4,
      range: 300,
      spreadDeg: 3,
    },
  ],
}

/**
 * Fuerte de isla: los "combat forts" que el juego original anunció y nunca publicó.
 * No se mueve; vigila su isla con dos cañones y da una buena recompensa al caer.
 */
export const FORT: BossDef = {
  id: 'fort',
  kind: 'fort',
  name: 'Fuerte',
  description: 'Torre artillada en una isla. Dispara a quien se acerque y recompensa a quien la derribe.',
  hp: 1300,
  contactDamage: 0,
  moveSpeed: 0,
  turnRateDeg: 120,
  radius: 38,
  guardRadius: 440,
  regenPerSecOutOfCombat: 25,
  rewardCoins: 450,
  respawnMs: 90000,
  weapons: [
    {
      kind: 'cannon',
      count: 2,
      arcsDeg: [-2.5, 2.5],
      aimed: true,
      autoAim: false,
      damage: 14,
      reloadMs: 1700,
      bulletSpeed: 430,
      bulletRadius: 5.5,
      range: 420,
      spreadDeg: 4.5,
    },
  ],
}

export const BOSS_DEFS: BossDef[] = [GUARDIAN_ARTILLERO, ACORAZADO, INTERCEPTOR]
const ALL_DEFS: BossDef[] = [...BOSS_DEFS, FORT]

export function findBossDef(id: string): BossDef {
  const def = ALL_DEFS.find((b) => b.id === id)
  if (!def) throw new Error(`Boss archetype desconocido: ${id}`)
  return def
}
