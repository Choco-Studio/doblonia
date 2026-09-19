import type { SlotId } from './weapons.js'

/**
 * Geometría de montaje de armas en el casco, compartida por servidor (origen de
 * las balas) y cliente (dónde se dibuja cada cañón). Coordenadas locales del
 * barco: `along` positivo = hacia la proa, `across` positivo = estribor.
 */

export interface DeckLayout {
  turrets: number
  barrelsPerTurret: number
  /** true = los cañones de una misma torreta apuntan en direcciones distintas (Doble, Cuádruple). */
  multiDirectional: boolean
  style: 'heavy' | 'sniper' | 'buster' | 'light' | 'auto' | 'gatling' | 'mortar'
  /** Ángulos de los cañones de una torreta multidireccional (si no, repartidos por igual). */
  anglesDeg?: number[]
}

export function deckLayout(tierId: string): DeckLayout {
  switch (tierId) {
    case 'big_cannon_1':
      return { turrets: 1, barrelsPerTurret: 1, multiDirectional: false, style: 'heavy' }
    case 'big_cannon_x':
      return { turrets: 2, barrelsPerTurret: 1, multiDirectional: false, style: 'heavy' }
    case 'big_cannon_3':
      return { turrets: 3, barrelsPerTurret: 1, multiDirectional: false, style: 'heavy' }
    case 'royal_cannon':
      return { turrets: 1, barrelsPerTurret: 1, multiDirectional: false, style: 'buster' }
    case 'sniper_cannon':
      return { turrets: 1, barrelsPerTurret: 1, multiDirectional: false, style: 'sniper' }
    case 'buster_cannon':
      return { turrets: 1, barrelsPerTurret: 1, multiDirectional: false, style: 'buster' }
    case 'dual_cannon_1':
      return { turrets: 1, barrelsPerTurret: 2, multiDirectional: true, style: 'light' }
    case 'twin_cannon':
      return { turrets: 1, barrelsPerTurret: 2, multiDirectional: false, style: 'light' }
    case 'twin_cannon_x':
      return { turrets: 2, barrelsPerTurret: 2, multiDirectional: false, style: 'light' }
    case 'quad_cannon':
      return { turrets: 1, barrelsPerTurret: 4, multiDirectional: true, style: 'light' }
    case 'quad_cannon_x':
      return {
        turrets: 1,
        barrelsPerTurret: 8,
        multiDirectional: true,
        style: 'light',
        anglesDeg: [0, -9, 9, 90, -90, 180, 145, 215],
      }
    case 'auto_cannon_1':
      return { turrets: 1, barrelsPerTurret: 1, multiDirectional: false, style: 'auto' }
    case 'auto_cannon_2':
      return { turrets: 2, barrelsPerTurret: 1, multiDirectional: false, style: 'auto' }
    case 'auto_cannon_3':
      return { turrets: 3, barrelsPerTurret: 1, multiDirectional: false, style: 'auto' }
    case 'auto_cannon_4':
      return { turrets: 4, barrelsPerTurret: 1, multiDirectional: false, style: 'auto' }
    case 'swivel_cannon_1':
      return { turrets: 1, barrelsPerTurret: 1, multiDirectional: false, style: 'light' }
    case 'swivel_cannon_2':
      return { turrets: 2, barrelsPerTurret: 1, multiDirectional: false, style: 'light' }
    case 'swivel_cannon_3':
      return { turrets: 3, barrelsPerTurret: 1, multiDirectional: false, style: 'light' }
    case 'swivel_cannon_4':
      return { turrets: 4, barrelsPerTurret: 1, multiDirectional: false, style: 'light' }
    case 'gatling_cannon':
      return { turrets: 1, barrelsPerTurret: 1, multiDirectional: false, style: 'gatling' }
    case 'gatling_cannon_2':
      return { turrets: 2, barrelsPerTurret: 1, multiDirectional: false, style: 'gatling' }
    case 'gatling_cannon_3':
      return { turrets: 3, barrelsPerTurret: 1, multiDirectional: false, style: 'gatling' }
    case 'mortar_1':
      return { turrets: 1, barrelsPerTurret: 1, multiDirectional: false, style: 'mortar' }
    case 'heavy_mortar':
      return { turrets: 1, barrelsPerTurret: 1, multiDirectional: false, style: 'mortar' }
    case 'mortar_battery':
      return { turrets: 3, barrelsPerTurret: 1, multiDirectional: false, style: 'mortar' }
    case 'siege_mortar':
      return { turrets: 1, barrelsPerTurret: 1, multiDirectional: false, style: 'mortar' }
    case 'grand_battery':
      return { turrets: 4, barrelsPerTurret: 1, multiDirectional: false, style: 'mortar' }
    default:
      return { turrets: 1, barrelsPerTurret: 1, multiDirectional: false, style: 'light' }
  }
}

export function deckTurretAlong(turretIndex: number, turrets: number, radius: number): number {
  return ((turrets - 1) / 2 - turretIndex) * radius * 0.6
}

export function deckBarrelLength(style: DeckLayout['style'], radius: number): number {
  switch (style) {
    case 'sniper':
      return radius * 1.05
    case 'buster':
      return radius * 0.85
    case 'heavy':
      return radius * 0.8
    case 'gatling':
      return radius * 0.7
    case 'auto':
      return radius * 0.55
    case 'mortar':
      return radius * 0.36
    default:
      return radius * 0.62
  }
}

/**
 * Posición local (along/across) de la boca del cañón `index` de una salva de `count`
 * disparos con ángulos `arcsDeg`, para slots fijos al casco (proa, costados, popa).
 */
export function hullMountOffset(
  slot: Exclude<SlotId, 'deck'>,
  arcDeg: number,
  radius: number,
): { along: number; across: number } {
  if (slot === 'front') {
    return { along: radius * 1.3, across: Math.max(-1, Math.min(1, arcDeg / 6)) * radius * 0.2 }
  }
  if (slot === 'rear') {
    const rel = ((((arcDeg - 180) % 360) + 540) % 360) - 180
    return { along: -radius * 1.15, across: Math.max(-1, Math.min(1, rel / 10)) * radius * 0.26 }
  }
  const side = arcDeg >= 0 ? 1 : -1
  const along = -((Math.abs(arcDeg) - 90) / 15) * radius * 0.58
  return { along, across: side * radius * 0.82 }
}

export function localToWorld(
  x: number,
  y: number,
  angle: number,
  along: number,
  across: number,
): { x: number; y: number } {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: x + c * along - s * across, y: y + s * along + c * across }
}
