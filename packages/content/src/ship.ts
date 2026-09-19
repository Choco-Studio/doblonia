/** Constantes base del casco antes de aplicar estadísticas y equipamiento. */
export const SHIP_BASE = {
  maxHp: 100,
  radius: 22,
  moveSpeed: 130,
  turnRateDeg: 110,
  ramDamage: 12,
  accel: 220,
  brakeDecel: 260,
  drag: 0.985,
}

export const SPAWN_PROTECTION_MS = 5000

/** Nivel de equipamiento L: xp acumulada necesaria para alcanzarlo. */
export function xpForEquipLevel(level: number): number {
  return 32 * Math.pow(level - 1, 2)
}

export function equipLevelForXp(xp: number): number {
  let level = 1
  while (xpForEquipLevel(level + 1) <= xp) level++
  return level
}

export const MAX_EQUIP_LEVEL = 16
