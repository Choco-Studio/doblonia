/**
 * Nombres para los barcos de relleno: variados y con el aspecto de los nicks que
 * escribe la gente (alias sueltos, nombres de pila, números, minúsculas, compuestos…),
 * en vez de un único patrón reconocible.
 */

const NICKS = [
  'Barbanegra',
  'Kraken',
  'Tiburón',
  'Salitre',
  'Nautilus',
  'Corsario',
  'Trueno',
  'Galeón',
  'Bergantín',
  'Ballena',
  'Mako',
  'Sirena',
  'Tritón',
  'Neptuno',
  'Calavera',
  'Pólvora',
  'Bucanero',
  'Filibustero',
  'Ancla',
  'Bruma',
  'Marejada',
  'Tormenta',
  'Coral',
  'Perla',
  'Doblón',
  'Garfio',
  'Loro',
  'Timón',
  'Vendaval',
  'Levante',
  'Poniente',
  'Arrecife',
  'Faro',
  'Brújula',
  'Carabela',
  'Fragata',
  'Orca',
  'Pulpo',
  'Medusa',
  'Morsa',
  'Albatros',
  'Cormorán',
  'Resaca',
  'Mistral',
  'Galerna',
  'Sargazo',
]
/** Sustantivos femeninos, para el artículo correcto ("La Sirena", "El Kraken"). */
const FEMININE = new Set([
  'Ballena',
  'Sirena',
  'Calavera',
  'Pólvora',
  'Ancla',
  'Bruma',
  'Marejada',
  'Tormenta',
  'Perla',
  'Brújula',
  'Carabela',
  'Fragata',
  'Orca',
  'Medusa',
  'Morsa',
  'Resaca',
  'Galerna',
])

const FIRST_NAMES = [
  'Lucía',
  'Marcos',
  'Álex',
  'Dani',
  'Sofía',
  'Leo',
  'Mateo',
  'Iker',
  'Paula',
  'Nico',
  'Hugo',
  'Valen',
  'Martina',
  'Diego',
  'Carla',
  'Sergio',
  'Irene',
  'Pablo',
  'Noa',
  'Adri',
  'Javi',
  'Sara',
  'Rubén',
  'Laura',
  'Mario',
  'Andrea',
  'Tomás',
  'Emma',
  'Joan',
  'Aitor',
  'Nerea',
  'Bruno',
  'Gael',
  'Luna',
  'Iván',
  'Marta',
  'Óscar',
  'Elena',
  'Gonzalo',
  'Vera',
  'Santi',
  'Clara',
  'Rafa',
  'Julia',
  'Kike',
]
const FEMALE_NAMES = new Set([
  'Lucía',
  'Sofía',
  'Paula',
  'Martina',
  'Carla',
  'Irene',
  'Noa',
  'Sara',
  'Laura',
  'Andrea',
  'Emma',
  'Nerea',
  'Luna',
  'Marta',
  'Elena',
  'Vera',
  'Clara',
  'Julia',
])
/** Títulos según concuerden con un nombre masculino, femenino o con un alias (neutro). */
const TITLES_M = ['Capi', 'Lord', 'Sir', 'Don', 'Almirante', 'Capitán']
const TITLES_F = ['Capi', 'Lady', 'Doña', 'Almirante', 'Capitana']
const TITLES_NICK = ['Capi', 'Lord', 'Sir', 'Almirante', 'Pirata']
const NOUNS = [
  'Pulpo',
  'Mar',
  'Ola',
  'Ron',
  'Lobo',
  'Cangrejo',
  'Loro',
  'Barco',
  'Pez',
  'Remo',
  'Cañón',
  'Vela',
]
const ADJECTIVES = [
  'Loco',
  'Bravo',
  'Salado',
  'Negro',
  'Rojo',
  'Feroz',
  'Veloz',
  'Salvaje',
  'Oxidado',
  'Mojado',
  'Pirata',
  'Fantasma',
]

type Rng = () => number

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]

/** Minúsculas sin tildes, como se suele teclear un alias. */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function digits(rng: Rng): string {
  const r = rng()
  if (r < 0.35) return String(Math.floor(rng() * 90) + 10)
  if (r < 0.55) return String(Math.floor(rng() * 9) + 1)
  if (r < 0.8) return String(Math.floor(rng() * 25) + 1990 + (rng() < 0.5 ? 0 : 10)).slice(2)
  return String(Math.floor(rng() * 900) + 100)
}

const PATTERNS: [number, (rng: Rng) => string][] = [
  [14, (r) => pick(r, NICKS)],
  [12, (r) => pick(r, NICKS) + (r() < 0.3 ? '_' : '') + digits(r)],
  [12, (r) => pick(r, FIRST_NAMES)],
  [10, (r) => plain(pick(r, FIRST_NAMES)) + (r() < 0.4 ? '_' : '') + digits(r)],
  [
    9,
    (r) => {
      if (r() < 0.4) return `${pick(r, TITLES_NICK)} ${pick(r, NICKS)}`
      const name = pick(r, FIRST_NAMES)
      return `${pick(r, FEMALE_NAMES.has(name) ? TITLES_F : TITLES_M)} ${name}`
    },
  ],
  [10, (r) => pick(r, NOUNS) + pick(r, ADJECTIVES)],
  [
    8,
    (r) => {
      const n = pick(r, NICKS)
      return `${FEMININE.has(n) ? 'La' : 'El'} ${n}`
    },
  ],
  [7, (r) => plain(pick(r, NICKS))],
  [7, (r) => `${pick(r, FIRST_NAMES)} ${pick(r, NICKS)}`],
  [4, (r) => plain(pick(r, NOUNS)) + plain(pick(r, ADJECTIVES))],
  [3, (r) => pick(r, FIRST_NAMES).toUpperCase()],
  [2, (r) => `xX${plain(pick(r, NICKS))}Xx`],
]
const TOTAL_WEIGHT = PATTERNS.reduce((a, [w]) => a + w, 0)

export function randomPlayerName(rng: Rng, taken: Set<string>): string {
  const lowerTaken = new Set([...taken].map((t) => t.toLowerCase()))
  for (let attempt = 0; attempt < 40; attempt++) {
    let roll = rng() * TOTAL_WEIGHT
    let gen = PATTERNS[0][1]
    for (const [w, g] of PATTERNS) {
      if (roll < w) {
        gen = g
        break
      }
      roll -= w
    }
    const name = gen(rng)
    if (name.length <= 16 && !lowerTaken.has(name.toLowerCase())) return name
  }
  return `${pick(rng, NICKS)}${Math.floor(rng() * 900) + 100}`.slice(0, 16)
}
