export type SlotId = 'front' | 'side' | 'deck' | 'rear'

export interface CannonEffect {
  kind: 'cannon'
  /** Número de proyectiles disparados por salva. */
  count: number
  /** Ángulos (grados) de cada cañón relativos a `aimed ? mira : rumbo del barco`. Se reutiliza en ciclo si count > arcsDeg.length. */
  arcsDeg: number[]
  /** true = apunta al ratón (Cubierta); false = fijo respecto al casco (Proa/Laterales/Popa). */
  aimed: boolean
  /** true = ignora el input de apuntado y dispara solo a un enemigo cercano detectado por el servidor. */
  autoAim: boolean
  damage: number
  reloadMs: number
  bulletSpeed: number
  bulletRadius: number
  range: number
  spreadDeg: number
  /** Tipo de proyectil: bola normal, palanqueta (ralentiza), fuego (quema) o mortero (parabólico con área). */
  projectile?: ProjectileKind
  /** Al impactar ralentiza al objetivo: multiplica su velocidad durante ms. */
  slow?: { mult: number; ms: number }
  /** Al impactar le prende fuego: daño por segundo durante ms. */
  burn?: { dps: number; ms: number }
  /** Radio de explosión (mortero). */
  aoe?: number
}

export type ProjectileKind = 'ball' | 'chain' | 'fire' | 'mortar'

export interface MineEffect {
  kind: 'mine'
  damage: number
  radius: number
  reloadMs: number
  lifetimeMs: number
  /** Mancha de aceite ardiente: no explota, quema a quien la cruce. */
  oil?: { dps: number; ms: number }
}

export interface RamEffect {
  kind: 'ram'
  ramDamageMult: number
}

export interface RudderEffect {
  kind: 'rudder'
  turnRateBonusDeg: number
}

export interface OarsEffect {
  kind: 'oars'
  pairs: number
}

export type WeaponEffect = CannonEffect | MineEffect | RamEffect | RudderEffect | OarsEffect

export interface WeaponTier {
  id: string
  name: string
  tier: number
  /** Una línea para la tarjeta de elección. */
  blurb: string
  effect: WeaponEffect
  moveSpeedMult?: number
  turnRateMult?: number
  hitboxScale?: number
  /** IDs de los siguientes nodos alcanzables desde este (dentro de la misma rama). Vacío/ausente = nodo terminal. */
  nextIds?: string[]
}

export interface WeaponBranch {
  id: string
  slot: SlotId
  name: string
  description: string
  tiers: WeaponTier[]
}

function cannon(partial: Omit<CannonEffect, 'kind'>): CannonEffect {
  return { kind: 'cannon', ...partial }
}

// ---------------------------------------------------------------------------
// PROA
// ---------------------------------------------------------------------------

const FRONT_CHASE: WeaponBranch = {
  id: 'chase_cannon',
  slot: 'front',
  name: 'Cañones de Caza',
  description: 'Cañones fijos de proa. Se ramifica en batería de fuego rápido o en largo alcance.',
  tiers: [
    {
      id: 'chase_cannon_1',
      name: 'Cañones de Caza',
      tier: 1,
      blurb: 'Dos cañones fijos hacia delante.',
      effect: cannon({
        count: 2,
        arcsDeg: [-4, 4],
        aimed: false,
        autoAim: false,
        damage: 9,
        reloadMs: 750,
        bulletSpeed: 480,
        bulletRadius: 4,
        range: 300,
        spreadDeg: 2,
      }),
      nextIds: ['chase_cannon_x', 'long_chase'],
    },
    {
      id: 'chase_cannon_x',
      name: 'Cañones de Caza X',
      tier: 2,
      blurb: 'Tres cañones de proa en abanico cerrado.',
      effect: cannon({
        count: 3,
        arcsDeg: [-6, 0, 6],
        aimed: false,
        autoAim: false,
        damage: 9.5,
        reloadMs: 720,
        bulletSpeed: 490,
        bulletRadius: 4.2,
        range: 310,
        spreadDeg: 2,
      }),
      nextIds: ['bow_battery'],
    },
    {
      id: 'bow_battery',
      name: 'Batería de Proa',
      tier: 3,
      blurb: 'Cuatro cañones de proa: una lluvia al frente.',
      effect: cannon({
        count: 4,
        arcsDeg: [-9, -3, 3, 9],
        aimed: false,
        autoAim: false,
        damage: 10,
        reloadMs: 700,
        bulletSpeed: 500,
        bulletRadius: 4.4,
        range: 320,
        spreadDeg: 2,
      }),
      turnRateMult: 0.95,
    },
    {
      id: 'long_chase',
      name: 'Caza de Largo Alcance',
      tier: 2,
      blurb: 'Dos cañones largos y rápidos que alcanzan muy lejos.',
      effect: cannon({
        count: 2,
        arcsDeg: [-2, 2],
        aimed: false,
        autoAim: false,
        damage: 13,
        reloadMs: 850,
        bulletSpeed: 620,
        bulletRadius: 4.5,
        range: 430,
        spreadDeg: 0.8,
      }),
      nextIds: ['bow_bombard'],
    },
    {
      id: 'bow_bombard',
      name: 'Bombarda de Proa',
      tier: 3,
      blurb: 'Un único proyectil enorme hacia delante.',
      effect: cannon({
        count: 1,
        arcsDeg: [0],
        aimed: false,
        autoAim: false,
        damage: 46,
        reloadMs: 1500,
        bulletSpeed: 560,
        bulletRadius: 8.5,
        range: 440,
        spreadDeg: 0.5,
      }),
      moveSpeedMult: 0.96,
    },
  ],
}

const FRONT_RAM: WeaponBranch = {
  id: 'ram',
  slot: 'front',
  name: 'Espolón',
  description:
    'Embestida cuerpo a cuerpo. La proa blindada da vida extra y reduce el daño que recibes al chocar.',
  tiers: [
    {
      id: 'battering_ram',
      name: 'Ariete',
      tier: 1,
      blurb: 'Embestidas un 80% más dañinas, +60 de vida y +6% de velocidad.',
      effect: { kind: 'ram', ramDamageMult: 1.8 },
      moveSpeedMult: 1.06,
      nextIds: ['greater_ram'],
    },
    {
      id: 'greater_ram',
      name: 'Gran Ariete',
      tier: 2,
      blurb: 'Embestidas con 2,5 veces el daño, +110 de vida y +9% de velocidad.',
      effect: { kind: 'ram', ramDamageMult: 2.5 },
      moveSpeedMult: 1.09,
      nextIds: ['ultra_ram'],
    },
    {
      id: 'ultra_ram',
      name: 'Ultra Ariete',
      tier: 3,
      blurb: 'Más del triple de daño de embestida, +160 de vida y +12% de velocidad.',
      effect: { kind: 'ram', ramDamageMult: 3.2 },
      moveSpeedMult: 1.12,
      nextIds: ['steel_ram'],
    },
    {
      id: 'steel_ram',
      name: 'Espolón de Acero',
      tier: 4,
      blurb: 'Casi cuatro veces el daño de embestida, +210 de vida y +15% de velocidad.',
      effect: { kind: 'ram', ramDamageMult: 3.9 },
      moveSpeedMult: 1.15,
    },
  ],
}

const FRONT_FIRE: WeaponBranch = {
  id: 'greek_fire',
  slot: 'front',
  name: 'Fuego Griego',
  description: 'Lanzallamas de proa de corto alcance. Deja al enemigo ardiendo varios segundos.',
  tiers: [
    {
      id: 'greek_fire_1',
      name: 'Fuego Griego',
      tier: 1,
      blurb: 'Chorro de fuego; quema 7/s durante 2,5 s.',
      effect: cannon({
        count: 2,
        arcsDeg: [-6, 6],
        aimed: false,
        autoAim: false,
        damage: 3,
        reloadMs: 210,
        bulletSpeed: 330,
        bulletRadius: 7,
        range: 150,
        spreadDeg: 9,
        projectile: 'fire',
        burn: { dps: 7, ms: 2500 },
      }),
      nextIds: ['greek_fire_x'],
    },
    {
      id: 'greek_fire_x',
      name: 'Fuego Griego X',
      tier: 2,
      blurb: 'Chorro más ancho y largo; quema 11/s.',
      effect: cannon({
        count: 3,
        arcsDeg: [-12, 0, 12],
        aimed: false,
        autoAim: false,
        damage: 3.4,
        reloadMs: 180,
        bulletSpeed: 350,
        bulletRadius: 8,
        range: 185,
        spreadDeg: 9,
        projectile: 'fire',
        burn: { dps: 11, ms: 3000 },
      }),
      nextIds: ['dragon_fire'],
    },
    {
      id: 'dragon_fire',
      name: 'Aliento de Dragón',
      tier: 3,
      blurb: 'Cuatro chorros de fuego; quema 13/s durante casi 3 s.',
      effect: cannon({
        count: 4,
        arcsDeg: [-15, -5, 5, 15],
        aimed: false,
        autoAim: false,
        damage: 3.6,
        reloadMs: 175,
        bulletSpeed: 370,
        bulletRadius: 9,
        range: 215,
        spreadDeg: 8,
        projectile: 'fire',
        burn: { dps: 13, ms: 2800 },
      }),
    },
  ],
}

export const FRONT_BRANCHES: WeaponBranch[] = [FRONT_CHASE, FRONT_RAM, FRONT_FIRE]

// ---------------------------------------------------------------------------
// LATERALES
// ---------------------------------------------------------------------------

const SIDE_SCATTER: WeaponBranch = {
  id: 'scatter',
  slot: 'side',
  name: 'Metralla',
  description: 'Disparo en abanico a ambos costados. Corto alcance, mucha área.',
  tiers: [
    {
      id: 'scatter_cannon',
      name: 'Cañón de Metralla',
      tier: 1,
      blurb: 'Tres perdigones por costado en abanico.',
      effect: cannon({
        count: 6,
        arcsDeg: [78, 90, 102, -78, -90, -102],
        aimed: false,
        autoAim: false,
        damage: 6,
        reloadMs: 950,
        bulletSpeed: 330,
        bulletRadius: 3.5,
        range: 190,
        spreadDeg: 6,
      }),
      nextIds: ['grape_cannon'],
    },
    {
      id: 'grape_cannon',
      name: 'Cañón de Uva',
      tier: 2,
      blurb: 'Abanico más denso y un proyectil pesado central por costado.',
      effect: cannon({
        count: 8,
        arcsDeg: [72, 84, 96, 108, -72, -84, -96, -108],
        aimed: false,
        autoAim: false,
        damage: 8,
        reloadMs: 900,
        bulletSpeed: 350,
        bulletRadius: 3.8,
        range: 210,
        spreadDeg: 5,
      }),
      nextIds: ['canister_shot'],
    },
    {
      id: 'canister_shot',
      name: 'Metralla Pesada',
      tier: 3,
      blurb: 'Cinco perdigones gruesos por costado. Devastador de cerca.',
      effect: cannon({
        count: 10,
        arcsDeg: [70, 80, 90, 100, 110, -70, -80, -90, -100, -110],
        aimed: false,
        autoAim: false,
        damage: 8.5,
        reloadMs: 880,
        bulletSpeed: 360,
        bulletRadius: 4,
        range: 225,
        spreadDeg: 5,
      }),
      turnRateMult: 0.95,
    },
  ],
}

const SIDE_CANNONS: WeaponBranch = {
  id: 'side_cannons',
  slot: 'side',
  name: 'Cañones Laterales',
  description: 'Andanadas a ambos costados. El mayor daño bruto, a costa de giro y tamaño.',
  tiers: [
    {
      id: 'side_cannons_1',
      name: 'Cañones Laterales',
      tier: 1,
      blurb: 'Un cañón por costado. Coloca al enemigo de lado.',
      effect: cannon({
        count: 2,
        arcsDeg: [90, -90],
        aimed: false,
        autoAim: false,
        damage: 14,
        reloadMs: 1100,
        bulletSpeed: 400,
        bulletRadius: 5,
        range: 260,
        spreadDeg: 1,
      }),
      turnRateMult: 0.96,
      nextIds: ['side_shots'],
    },
    {
      id: 'side_shots',
      name: 'Andanada',
      tier: 2,
      blurb: 'Dos cañones por costado. Algo menos de giro.',
      effect: cannon({
        count: 4,
        arcsDeg: [84, 96, -84, -96],
        aimed: false,
        autoAim: false,
        damage: 14,
        reloadMs: 1050,
        bulletSpeed: 400,
        bulletRadius: 5,
        range: 260,
        spreadDeg: 1,
      }),
      turnRateMult: 0.9,
      hitboxScale: 1.05,
      nextIds: ['side_shots_x'],
    },
    {
      id: 'side_shots_x',
      name: 'Andanada X',
      tier: 3,
      blurb: 'Tres cañones por costado.',
      effect: cannon({
        count: 6,
        arcsDeg: [80, 90, 100, -80, -90, -100],
        aimed: false,
        autoAim: false,
        damage: 14.5,
        reloadMs: 1000,
        bulletSpeed: 405,
        bulletRadius: 5,
        range: 270,
        spreadDeg: 1,
      }),
      turnRateMult: 0.84,
      hitboxScale: 1.1,
      nextIds: ['side_shots_ultra'],
    },
    {
      id: 'side_shots_ultra',
      name: 'Andanada Ultra',
      tier: 4,
      blurb: 'Cuatro cañones por costado. Un muro de hierro.',
      effect: cannon({
        count: 8,
        arcsDeg: [76, 86, 94, 104, -76, -86, -94, -104],
        aimed: false,
        autoAim: false,
        damage: 15,
        reloadMs: 950,
        bulletSpeed: 410,
        bulletRadius: 5,
        range: 275,
        spreadDeg: 1,
      }),
      turnRateMult: 0.78,
      hitboxScale: 1.15,
    },
  ],
}

const SIDE_ROWS: WeaponBranch = {
  id: 'rows',
  slot: 'side',
  name: 'Remos',
  description:
    'Velocidad a cambio de los cañones laterales. Cada par de remos acelera la recarga un 2% y refuerza la embestida un 10%.',
  tiers: [
    {
      id: 'side_rows_1',
      name: 'Remos',
      tier: 1,
      blurb: '+10% de velocidad y recarga un 2% más rápida.',
      effect: { kind: 'oars', pairs: 1 },
      moveSpeedMult: 1.1,
      turnRateMult: 0.98,
      hitboxScale: 1.02,
      nextIds: ['side_rows_2'],
    },
    {
      id: 'side_rows_2',
      name: 'Remos Reforzados',
      tier: 2,
      blurb: '+17% de velocidad y recarga un 4% más rápida.',
      effect: { kind: 'oars', pairs: 2 },
      moveSpeedMult: 1.17,
      turnRateMult: 0.96,
      hitboxScale: 1.04,
      nextIds: ['rowers_x'],
    },
    {
      id: 'rowers_x',
      name: 'Remos X',
      tier: 3,
      blurb: '+27% de velocidad y recarga un 6% más rápida.',
      effect: { kind: 'oars', pairs: 3 },
      moveSpeedMult: 1.27,
      turnRateMult: 0.94,
      hitboxScale: 1.06,
      nextIds: ['ultra_rowers'],
    },
    {
      id: 'ultra_rowers',
      name: 'Ultra Remos',
      tier: 4,
      blurb: '+34% de velocidad y recarga un 8% más rápida.',
      effect: { kind: 'oars', pairs: 4 },
      moveSpeedMult: 1.34,
      turnRateMult: 0.92,
      hitboxScale: 1.08,
    },
  ],
}

const SIDE_CHAIN: WeaponBranch = {
  id: 'chain_shot',
  slot: 'side',
  name: 'Palanqueta',
  description: 'Balas unidas por cadena que destrozan el aparejo: poco daño, pero ralentizan al enemigo.',
  tiers: [
    {
      id: 'chain_shot_1',
      name: 'Palanqueta',
      tier: 1,
      blurb: 'Ralentiza un 40% durante 1,8 s.',
      effect: cannon({
        count: 2,
        arcsDeg: [90, -90],
        aimed: false,
        autoAim: false,
        damage: 8,
        reloadMs: 1250,
        bulletSpeed: 380,
        bulletRadius: 6,
        range: 250,
        spreadDeg: 2,
        projectile: 'chain',
        slow: { mult: 0.6, ms: 1800 },
      }),
      turnRateMult: 0.97,
      nextIds: ['chain_shot_x'],
    },
    {
      id: 'chain_shot_x',
      name: 'Palanqueta X',
      tier: 2,
      blurb: 'Dos por costado; ralentiza un 50% durante 2,2 s.',
      effect: cannon({
        count: 4,
        arcsDeg: [84, 96, -84, -96],
        aimed: false,
        autoAim: false,
        damage: 9,
        reloadMs: 1200,
        bulletSpeed: 390,
        bulletRadius: 6.5,
        range: 265,
        spreadDeg: 2,
        projectile: 'chain',
        slow: { mult: 0.5, ms: 2200 },
      }),
      turnRateMult: 0.92,
      hitboxScale: 1.04,
      nextIds: ['chain_shot_heavy'],
    },
    {
      id: 'chain_shot_heavy',
      name: 'Palanqueta Pesada',
      tier: 3,
      blurb: 'Tres por costado; ralentiza un 48% durante 2,2 s.',
      effect: cannon({
        count: 6,
        arcsDeg: [80, 90, 100, -80, -90, -100],
        aimed: false,
        autoAim: false,
        damage: 10,
        reloadMs: 1150,
        bulletSpeed: 400,
        bulletRadius: 7,
        range: 280,
        spreadDeg: 2,
        projectile: 'chain',
        slow: { mult: 0.52, ms: 2200 },
      }),
      turnRateMult: 0.88,
      hitboxScale: 1.07,
    },
  ],
}

export const SIDE_BRANCHES: WeaponBranch[] = [SIDE_SCATTER, SIDE_CANNONS, SIDE_ROWS, SIDE_CHAIN]

// ---------------------------------------------------------------------------
// CUBIERTA (elección única inicial entre 4 ramas)
// ---------------------------------------------------------------------------

const DECK_BIG: WeaponBranch = {
  id: 'big_cannon',
  slot: 'deck',
  name: 'Cañón Pesado',
  description: 'Gran calibre en torreta. Lento pero devastador.',
  tiers: [
    {
      id: 'big_cannon_1',
      name: 'Cañón Pesado',
      tier: 1,
      blurb: 'Un disparo lento y muy dañino.',
      effect: cannon({
        count: 1,
        arcsDeg: [0],
        aimed: true,
        autoAim: false,
        damage: 36,
        reloadMs: 1500,
        bulletSpeed: 430,
        bulletRadius: 7,
        range: 360,
        spreadDeg: 0.5,
      }),
      nextIds: ['sniper_cannon', 'big_cannon_x'],
    },
    {
      id: 'big_cannon_x',
      name: 'Cañón Pesado X',
      tier: 2,
      blurb: 'Dos cañones pesados en paralelo.',
      effect: cannon({
        count: 2,
        arcsDeg: [-3, 3],
        aimed: true,
        autoAim: false,
        damage: 32,
        reloadMs: 1650,
        bulletSpeed: 430,
        bulletRadius: 7,
        range: 360,
        spreadDeg: 0.5,
      }),
      moveSpeedMult: 0.95,
      nextIds: ['big_cannon_3'],
    },
    {
      id: 'big_cannon_3',
      name: 'Cañón Pesado Triple',
      tier: 3,
      blurb: 'Tres cañones pesados: una salva que hunde barcos.',
      effect: cannon({
        count: 3,
        arcsDeg: [-4, 0, 4],
        aimed: true,
        autoAim: false,
        damage: 29,
        reloadMs: 1950,
        bulletSpeed: 440,
        bulletRadius: 7,
        range: 360,
        spreadDeg: 0.5,
      }),
      moveSpeedMult: 0.91,
    },
    {
      id: 'sniper_cannon',
      name: 'Cañón de Precisión',
      tier: 2,
      blurb: 'Menos daño, mucho más alcance y velocidad.',
      effect: cannon({
        count: 1,
        arcsDeg: [0],
        aimed: true,
        autoAim: false,
        damage: 26,
        reloadMs: 1150,
        bulletSpeed: 660,
        bulletRadius: 5.5,
        range: 480,
        spreadDeg: 0.2,
      }),
      nextIds: ['buster_cannon'],
    },
    {
      id: 'buster_cannon',
      name: 'Cañón Demoledor',
      tier: 3,
      blurb: 'Los proyectiles más grandes del juego.',
      effect: cannon({
        count: 1,
        arcsDeg: [0],
        aimed: true,
        autoAim: false,
        damage: 48,
        reloadMs: 1750,
        bulletSpeed: 580,
        bulletRadius: 10,
        range: 460,
        spreadDeg: 0.2,
      }),
      moveSpeedMult: 0.94,
      nextIds: ['royal_cannon'],
    },
    {
      id: 'royal_cannon',
      name: 'Cañón Real',
      tier: 4,
      blurb: 'La pieza más temida del mar: alcance y daño extremos.',
      effect: cannon({
        count: 1,
        arcsDeg: [0],
        aimed: true,
        autoAim: false,
        damage: 58,
        reloadMs: 2000,
        bulletSpeed: 620,
        bulletRadius: 12,
        range: 500,
        spreadDeg: 0.2,
      }),
      moveSpeedMult: 0.9,
    },
  ],
}

const DECK_DUAL: WeaponBranch = {
  id: 'dual_cannon',
  slot: 'deck',
  name: 'Cañón Doble',
  description: 'Dispara hacia la mira y hacia atrás a la vez. Se ramifica en Gemelo o Cuádruple.',
  tiers: [
    {
      id: 'dual_cannon_1',
      name: 'Cañón Doble',
      tier: 1,
      blurb: 'Un disparo hacia la mira y otro opuesto.',
      effect: cannon({
        count: 2,
        arcsDeg: [0, 180],
        aimed: true,
        autoAim: false,
        damage: 20,
        reloadMs: 860,
        bulletSpeed: 460,
        bulletRadius: 5,
        range: 320,
        spreadDeg: 1,
      }),
      nextIds: ['twin_cannon', 'quad_cannon'],
    },
    {
      id: 'twin_cannon',
      name: 'Cañón Gemelo',
      tier: 2,
      blurb: 'Dos disparos juntos hacia la mira.',
      effect: cannon({
        count: 2,
        arcsDeg: [-3, 3],
        aimed: true,
        autoAim: false,
        damage: 18,
        reloadMs: 780,
        bulletSpeed: 470,
        bulletRadius: 5,
        range: 330,
        spreadDeg: 1,
      }),
      nextIds: ['twin_cannon_x'],
    },
    {
      id: 'twin_cannon_x',
      name: 'Cañón Gemelo X',
      tier: 3,
      blurb: 'Dos torretas gemelas: cuatro disparos por salva.',
      effect: cannon({
        count: 4,
        arcsDeg: [-7, -2.5, 2.5, 7],
        aimed: true,
        autoAim: false,
        damage: 13,
        reloadMs: 900,
        bulletSpeed: 470,
        bulletRadius: 5,
        range: 330,
        spreadDeg: 1,
      }),
    },
    {
      id: 'quad_cannon',
      name: 'Cañón Cuádruple',
      tier: 2,
      blurb: 'Cuatro direcciones a la vez.',
      effect: cannon({
        count: 4,
        arcsDeg: [0, 90, 180, 270],
        aimed: true,
        autoAim: false,
        damage: 33,
        reloadMs: 900,
        bulletSpeed: 440,
        bulletRadius: 5,
        range: 310,
        spreadDeg: 1,
      }),
      nextIds: ['quad_cannon_x'],
    },
    {
      id: 'quad_cannon_x',
      name: 'Cañón Cuádruple X',
      tier: 3,
      blurb: 'Ocho cañones: tres hacia la mira y el resto cubriendo todo el barco.',
      effect: cannon({
        count: 8,
        arcsDeg: [0, -5, 5, 90, -90, 180, 145, 215],
        aimed: true,
        autoAim: false,
        damage: 27,
        reloadMs: 900,
        bulletSpeed: 440,
        bulletRadius: 4.8,
        range: 300,
        spreadDeg: 1,
      }),
    },
  ],
}

const DECK_AUTO: WeaponBranch = {
  id: 'auto_cannon',
  slot: 'deck',
  name: 'Cañón Automático',
  description:
    'Apunta y dispara solo a enemigos cercanos. Menos daño a cambio de comodidad. Hasta 4 unidades.',
  tiers: [
    {
      id: 'auto_cannon_1',
      name: 'Cañón Automático',
      tier: 1,
      blurb: 'Dispara solo al enemigo más cercano.',
      effect: cannon({
        count: 1,
        arcsDeg: [0],
        aimed: false,
        autoAim: true,
        damage: 15,
        reloadMs: 700,
        bulletSpeed: 460,
        bulletRadius: 4,
        range: 290,
        spreadDeg: 4,
      }),
      nextIds: ['auto_cannon_2'],
    },
    {
      id: 'auto_cannon_2',
      name: 'Cañón Automático x2',
      tier: 2,
      blurb: 'Dos torretas automáticas.',
      effect: cannon({
        count: 2,
        arcsDeg: [-3, 3],
        aimed: false,
        autoAim: true,
        damage: 15,
        reloadMs: 700,
        bulletSpeed: 460,
        bulletRadius: 4,
        range: 290,
        spreadDeg: 4,
      }),
      nextIds: ['auto_cannon_3'],
    },
    {
      id: 'auto_cannon_3',
      name: 'Cañón Automático x3',
      tier: 3,
      blurb: 'Tres torretas automáticas.',
      effect: cannon({
        count: 3,
        arcsDeg: [-5, 0, 5],
        aimed: false,
        autoAim: true,
        damage: 15,
        reloadMs: 700,
        bulletSpeed: 460,
        bulletRadius: 4,
        range: 290,
        spreadDeg: 4,
      }),
      nextIds: ['auto_cannon_4'],
    },
    {
      id: 'auto_cannon_4',
      name: 'Cañón Automático x4',
      tier: 4,
      blurb: 'Cuatro torretas automáticas.',
      effect: cannon({
        count: 4,
        arcsDeg: [-7, -2.5, 2.5, 7],
        aimed: false,
        autoAim: true,
        damage: 15,
        reloadMs: 700,
        bulletSpeed: 460,
        bulletRadius: 4,
        range: 290,
        spreadDeg: 4,
      }),
    },
  ],
}

const DECK_SWIVEL: WeaponBranch = {
  id: 'swivel_cannon',
  slot: 'deck',
  name: 'Cañón Giratorio',
  description: 'Apuntado manual con más daño que el automático. Se ramifica en Gatling.',
  tiers: [
    {
      id: 'swivel_cannon_1',
      name: 'Cañón Giratorio',
      tier: 1,
      blurb: 'Torreta manual rápida.',
      effect: cannon({
        count: 1,
        arcsDeg: [0],
        aimed: true,
        autoAim: false,
        damage: 15,
        reloadMs: 620,
        bulletSpeed: 470,
        bulletRadius: 4.5,
        range: 310,
        spreadDeg: 1,
      }),
      nextIds: ['swivel_cannon_2', 'gatling_cannon'],
    },
    {
      id: 'swivel_cannon_2',
      name: 'Cañón Giratorio x2',
      tier: 2,
      blurb: 'Dos torretas manuales.',
      effect: cannon({
        count: 2,
        arcsDeg: [-3, 3],
        aimed: true,
        autoAim: false,
        damage: 15,
        reloadMs: 620,
        bulletSpeed: 470,
        bulletRadius: 4.5,
        range: 310,
        spreadDeg: 1,
      }),
      nextIds: ['swivel_cannon_3'],
    },
    {
      id: 'swivel_cannon_3',
      name: 'Cañón Giratorio x3',
      tier: 3,
      blurb: 'Tres torretas manuales.',
      effect: cannon({
        count: 3,
        arcsDeg: [-5, 0, 5],
        aimed: true,
        autoAim: false,
        damage: 15,
        reloadMs: 620,
        bulletSpeed: 470,
        bulletRadius: 4.5,
        range: 310,
        spreadDeg: 1,
      }),
      nextIds: ['swivel_cannon_4'],
    },
    {
      id: 'swivel_cannon_4',
      name: 'Cañón Giratorio x4',
      tier: 4,
      blurb: 'Cuatro torretas manuales sincronizadas.',
      effect: cannon({
        count: 4,
        arcsDeg: [-7, -2.5, 2.5, 7],
        aimed: true,
        autoAim: false,
        damage: 15,
        reloadMs: 640,
        bulletSpeed: 470,
        bulletRadius: 4.5,
        range: 310,
        spreadDeg: 1,
      }),
      moveSpeedMult: 0.97,
    },
    {
      id: 'gatling_cannon',
      name: 'Cañón Gatling',
      tier: 2,
      blurb: 'Cadencia altísima, poco daño por bala.',
      effect: cannon({
        count: 1,
        arcsDeg: [0],
        aimed: true,
        autoAim: false,
        damage: 9.5,
        reloadMs: 180,
        bulletSpeed: 560,
        bulletRadius: 3.4,
        range: 300,
        spreadDeg: 2.5,
      }),
      nextIds: ['gatling_cannon_2'],
    },
    {
      id: 'gatling_cannon_2',
      name: 'Cañón Gatling x2',
      tier: 3,
      blurb: 'Dos gatlings.',
      effect: cannon({
        count: 2,
        arcsDeg: [-3, 3],
        aimed: true,
        autoAim: false,
        damage: 9.5,
        reloadMs: 180,
        bulletSpeed: 560,
        bulletRadius: 3.4,
        range: 300,
        spreadDeg: 2.5,
      }),
      nextIds: ['gatling_cannon_3'],
    },
    {
      id: 'gatling_cannon_3',
      name: 'Cañón Gatling x3',
      tier: 4,
      blurb: 'Tres gatlings. Lluvia de plomo.',
      effect: cannon({
        count: 3,
        arcsDeg: [-5, 0, 5],
        aimed: true,
        autoAim: false,
        damage: 9.5,
        reloadMs: 180,
        bulletSpeed: 560,
        bulletRadius: 3.4,
        range: 300,
        spreadDeg: 2.5,
      }),
    },
  ],
}

const DECK_MORTAR: WeaponBranch = {
  id: 'mortar',
  slot: 'deck',
  name: 'Mortero',
  description: 'Tiro parabólico: cae donde apuntas, pasa por encima de islas y barcos y explota en área.',
  tiers: [
    {
      id: 'mortar_1',
      name: 'Mortero',
      tier: 1,
      blurb: 'Explosión de 60 de radio donde apuntas.',
      effect: cannon({
        count: 1,
        arcsDeg: [0],
        aimed: true,
        autoAim: false,
        damage: 32,
        reloadMs: 1900,
        bulletSpeed: 300,
        bulletRadius: 7,
        range: 520,
        spreadDeg: 1.5,
        projectile: 'mortar',
        aoe: 60,
      }),
      nextIds: ['heavy_mortar', 'mortar_battery'],
    },
    {
      id: 'heavy_mortar',
      name: 'Mortero Pesado',
      tier: 2,
      blurb: 'Explosión enorme y devastadora, más lenta.',
      effect: cannon({
        count: 1,
        arcsDeg: [0],
        aimed: true,
        autoAim: false,
        damage: 50,
        reloadMs: 2400,
        bulletSpeed: 290,
        bulletRadius: 9,
        range: 560,
        spreadDeg: 1.5,
        projectile: 'mortar',
        aoe: 88,
      }),
      moveSpeedMult: 0.95,
      nextIds: ['siege_mortar'],
    },
    {
      id: 'siege_mortar',
      name: 'Mortero de Asedio',
      tier: 3,
      blurb: 'Alcance enorme y una explosión que arrasa una zona entera.',
      effect: cannon({
        count: 1,
        arcsDeg: [0],
        aimed: true,
        autoAim: false,
        damage: 64,
        reloadMs: 2700,
        bulletSpeed: 285,
        bulletRadius: 11,
        range: 620,
        spreadDeg: 1.5,
        projectile: 'mortar',
        aoe: 110,
      }),
      moveSpeedMult: 0.9,
    },
    {
      id: 'mortar_battery',
      name: 'Batería de Morteros',
      tier: 2,
      blurb: 'Tres morteros en abanico: cubren una zona amplia.',
      effect: cannon({
        count: 3,
        arcsDeg: [-7, 0, 7],
        aimed: true,
        autoAim: false,
        damage: 24,
        reloadMs: 2300,
        bulletSpeed: 300,
        bulletRadius: 6.5,
        range: 520,
        spreadDeg: 2,
        projectile: 'mortar',
        aoe: 52,
      }),
      nextIds: ['grand_battery'],
    },
    {
      id: 'grand_battery',
      name: 'Gran Batería',
      tier: 3,
      blurb: 'Cinco morteros: bombardea toda una franja de mar.',
      effect: cannon({
        count: 5,
        arcsDeg: [-12, -6, 0, 6, 12],
        aimed: true,
        autoAim: false,
        damage: 22,
        reloadMs: 2350,
        bulletSpeed: 300,
        bulletRadius: 6.5,
        range: 540,
        spreadDeg: 2,
        projectile: 'mortar',
        aoe: 50,
      }),
      moveSpeedMult: 0.96,
    },
  ],
}

export const DECK_BRANCHES: WeaponBranch[] = [DECK_BIG, DECK_DUAL, DECK_AUTO, DECK_SWIVEL, DECK_MORTAR]

// ---------------------------------------------------------------------------
// POPA
// ---------------------------------------------------------------------------

const REAR_MINE: WeaponBranch = {
  id: 'mine_dropper',
  slot: 'rear',
  name: 'Minero',
  description: 'Suelta minas que detonan al contacto. Disuade a quien te persigue.',
  tiers: [
    {
      id: 'mine_dropper_1',
      name: 'Minero',
      tier: 1,
      blurb: 'Minas de 5 segundos al disparar.',
      effect: { kind: 'mine', damage: 42, radius: 26, reloadMs: 2200, lifetimeMs: 5000 },
      nextIds: ['bigger_mines'],
    },
    {
      id: 'bigger_mines',
      name: 'Minas Grandes',
      tier: 2,
      blurb: 'Minas más grandes y dañinas.',
      effect: { kind: 'mine', damage: 58, radius: 36, reloadMs: 2100, lifetimeMs: 5000 },
      nextIds: ['sea_mines'],
    },
    {
      id: 'sea_mines',
      name: 'Minas Marinas',
      tier: 3,
      blurb: 'Minas enormes que duran 7 segundos.',
      effect: { kind: 'mine', damage: 74, radius: 44, reloadMs: 2000, lifetimeMs: 7000 },
    },
  ],
}

const REAR_CANNON: WeaponBranch = {
  id: 'rear_cannon',
  slot: 'rear',
  name: 'Cañón de Popa',
  description: 'Cañones fijos hacia atrás. Castigan a quien te persigue.',
  tiers: [
    {
      id: 'rear_cannon_1',
      name: 'Cañón de Popa',
      tier: 1,
      blurb: 'Castiga a quien te persiga.',
      effect: cannon({
        count: 1,
        arcsDeg: [180],
        aimed: false,
        autoAim: false,
        damage: 12,
        reloadMs: 850,
        bulletSpeed: 420,
        bulletRadius: 4.5,
        range: 270,
        spreadDeg: 2,
      }),
      nextIds: ['rear_cannon_2'],
    },
    {
      id: 'rear_cannon_2',
      name: 'Cañones de Popa',
      tier: 2,
      blurb: 'Dos cañones hacia atrás.',
      effect: cannon({
        count: 2,
        arcsDeg: [174, 186],
        aimed: false,
        autoAim: false,
        damage: 12.5,
        reloadMs: 800,
        bulletSpeed: 430,
        bulletRadius: 4.6,
        range: 290,
        spreadDeg: 2,
      }),
      nextIds: ['rear_battery'],
    },
    {
      id: 'rear_battery',
      name: 'Andanada de Popa',
      tier: 3,
      blurb: 'Tres cañones de popa: nadie te persigue gratis.',
      effect: cannon({
        count: 3,
        arcsDeg: [168, 180, 192],
        aimed: false,
        autoAim: false,
        damage: 13,
        reloadMs: 760,
        bulletSpeed: 440,
        bulletRadius: 4.8,
        range: 300,
        spreadDeg: 2,
      }),
    },
  ],
}

const REAR_RUDDER: WeaponBranch = {
  id: 'rudder',
  slot: 'rear',
  name: 'Timón Reforzado',
  description: 'Gran aumento de la velocidad de giro (y algo de velocidad en niveles altos). Sin arma.',
  tiers: [
    {
      id: 'rudder_1',
      name: 'Timón Reforzado',
      tier: 1,
      blurb: '+55°/s de giro.',
      effect: { kind: 'rudder', turnRateBonusDeg: 55 },
      nextIds: ['racing_rudder'],
    },
    {
      id: 'racing_rudder',
      name: 'Timón de Regata',
      tier: 2,
      blurb: '+80°/s de giro y un 5% más de velocidad.',
      effect: { kind: 'rudder', turnRateBonusDeg: 80 },
      moveSpeedMult: 1.05,
      nextIds: ['master_rudder'],
    },
    {
      id: 'master_rudder',
      name: 'Timón Maestro',
      tier: 3,
      blurb: '+105°/s de giro y un 9% más de velocidad.',
      effect: { kind: 'rudder', turnRateBonusDeg: 105 },
      moveSpeedMult: 1.09,
    },
  ],
}

const REAR_OIL: WeaponBranch = {
  id: 'oil_slick',
  slot: 'rear',
  name: 'Aceite Ardiente',
  description: 'Derrama aceite en llamas por la popa: quema a quien te persiga.',
  tiers: [
    {
      id: 'oil_slick_1',
      name: 'Aceite Ardiente',
      tier: 1,
      blurb: 'Manchas de fuego de 4 s que queman 9/s.',
      effect: {
        kind: 'mine',
        damage: 0,
        radius: 34,
        reloadMs: 900,
        lifetimeMs: 4000,
        oil: { dps: 9, ms: 1500 },
      },
      nextIds: ['oil_slick_x'],
    },
    {
      id: 'oil_slick_x',
      name: 'Aceite Ardiente X',
      tier: 2,
      blurb: 'Manchas más grandes y duraderas; queman 14/s.',
      effect: {
        kind: 'mine',
        damage: 0,
        radius: 46,
        reloadMs: 800,
        lifetimeMs: 5500,
        oil: { dps: 14, ms: 1800 },
      },
      nextIds: ['sea_of_fire'],
    },
    {
      id: 'sea_of_fire',
      name: 'Mar en Llamas',
      tier: 3,
      blurb: 'Grandes charcos de fuego que queman 18/s.',
      effect: {
        kind: 'mine',
        damage: 0,
        radius: 58,
        reloadMs: 760,
        lifetimeMs: 6500,
        oil: { dps: 18, ms: 2000 },
      },
    },
  ],
}

export const REAR_BRANCHES: WeaponBranch[] = [REAR_MINE, REAR_CANNON, REAR_RUDDER, REAR_OIL]

export const BRANCHES_BY_SLOT: Record<SlotId, WeaponBranch[]> = {
  front: FRONT_BRANCHES,
  side: SIDE_BRANCHES,
  deck: DECK_BRANCHES,
  rear: REAR_BRANCHES,
}

export const SLOT_UNLOCK_LEVEL: Record<SlotId, number> = {
  front: 2,
  side: 3,
  deck: 4,
  rear: 5,
}

export const SLOT_ORDER: SlotId[] = ['front', 'side', 'deck', 'rear']

export const SLOT_NAMES: Record<SlotId, string> = {
  front: 'Proa',
  side: 'Costados',
  deck: 'Cubierta',
  rear: 'Popa',
}

export function findBranch(slot: SlotId, branchId: string): WeaponBranch | undefined {
  return BRANCHES_BY_SLOT[slot].find((b) => b.id === branchId)
}

export function findTier(slot: SlotId, branchId: string, tierId: string): WeaponTier | undefined {
  return findBranch(slot, branchId)?.tiers.find((t) => t.id === tierId)
}

/** Opciones legales de equipamiento para un slot dado su estado actual. */
export function equipOptionsForSlot(
  slot: SlotId,
  current: { branchId: string; tierId: string } | undefined,
): { branch: WeaponBranch; tier: WeaponTier }[] {
  if (!current) return BRANCHES_BY_SLOT[slot].map((branch) => ({ branch, tier: branch.tiers[0] }))
  const branch = findBranch(slot, current.branchId)
  const tier = branch?.tiers.find((t) => t.id === current.tierId)
  if (!branch || !tier?.nextIds) return []
  return tier.nextIds
    .map((id) => ({ branch, tier: branch.tiers.find((t) => t.id === id)! }))
    .filter((o) => !!o.tier)
}
