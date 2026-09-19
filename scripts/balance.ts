// Banco de equilibrado: `npx tsx scripts/balance.ts [mejoras] [duelos_por_pareja]`
// Duelos 1 contra 1 entre bots con estilos completos de barco, misma inversión de
// mejoras y puntos de estadística, en mar abierto. Da el % de victorias de cada estilo.
import {
  computeDerivedStats,
  createWorld,
  createShip,
  simulateTick,
  derived,
  ensureBotMemory,
  type Ship,
  type World,
} from '../packages/sim/src/index.js'
import { loadoutMetrics } from '../apps/client/src/ui/loadoutMetrics.js'
import { SLOT_ORDER, findTier, type SlotId, type StatId } from '../packages/content/src/index.js'
import type { BotProfile } from '../packages/sim/src/types.js'

const PICKS = Number(process.argv[2] ?? 10)
const DUELS = Number(process.argv[3] ?? 24)
const MAX_SECONDS = 75
const DT = 0.05

interface Build {
  name: string
  profile: BotProfile
  stats: StatId[]
  paths: Record<SlotId, string[]>
}

// Rutas de mejora por puesto (branchId:tierId en orden)
const BUILDS: Build[] = [
  {
    name: 'Artillero',
    profile: 'gunner',
    stats: ['damage', 'reload', 'range', 'hull', 'speed'],
    paths: {
      front: ['chase_cannon:chase_cannon_1', 'chase_cannon:long_chase', 'chase_cannon:bow_bombard'],
      side: [
        'side_cannons:side_cannons_1',
        'side_cannons:side_shots',
        'side_cannons:side_shots_x',
        'side_cannons:side_shots_ultra',
      ],
      deck: [
        'big_cannon:big_cannon_1',
        'big_cannon:sniper_cannon',
        'big_cannon:buster_cannon',
        'big_cannon:royal_cannon',
      ],
      rear: ['rear_cannon:rear_cannon_1', 'rear_cannon:rear_cannon_2', 'rear_cannon:rear_battery'],
    },
  },
  {
    name: 'Andanada',
    profile: 'gunner',
    stats: ['damage', 'reload', 'hull', 'range', 'repair'],
    paths: {
      front: ['chase_cannon:chase_cannon_1', 'chase_cannon:chase_cannon_x', 'chase_cannon:bow_battery'],
      side: [
        'side_cannons:side_cannons_1',
        'side_cannons:side_shots',
        'side_cannons:side_shots_x',
        'side_cannons:side_shots_ultra',
      ],
      deck: ['big_cannon:big_cannon_1', 'big_cannon:big_cannon_x', 'big_cannon:big_cannon_3'],
      rear: ['mine_dropper:mine_dropper_1', 'mine_dropper:bigger_mines', 'mine_dropper:sea_mines'],
    },
  },
  {
    name: 'Embestidor',
    profile: 'rammer',
    stats: ['ram', 'hull', 'speed', 'turn', 'repair'],
    paths: {
      front: ['ram:battering_ram', 'ram:greater_ram', 'ram:ultra_ram', 'ram:steel_ram'],
      side: ['rows:side_rows_1', 'rows:side_rows_2', 'rows:rowers_x', 'rows:ultra_rowers'],
      deck: [
        'swivel_cannon:swivel_cannon_1',
        'swivel_cannon:swivel_cannon_2',
        'swivel_cannon:swivel_cannon_3',
        'swivel_cannon:swivel_cannon_4',
      ],
      rear: ['rudder:rudder_1', 'rudder:racing_rudder', 'rudder:master_rudder'],
    },
  },
  {
    name: 'Torreta',
    profile: 'turret',
    stats: ['reload', 'damage', 'hull', 'repair', 'range'],
    paths: {
      front: ['chase_cannon:chase_cannon_1', 'chase_cannon:chase_cannon_x', 'chase_cannon:bow_battery'],
      side: ['scatter:scatter_cannon', 'scatter:grape_cannon', 'scatter:canister_shot'],
      deck: [
        'auto_cannon:auto_cannon_1',
        'auto_cannon:auto_cannon_2',
        'auto_cannon:auto_cannon_3',
        'auto_cannon:auto_cannon_4',
      ],
      rear: ['mine_dropper:mine_dropper_1', 'mine_dropper:bigger_mines', 'mine_dropper:sea_mines'],
    },
  },
  {
    name: 'Hostigador',
    profile: 'skirmisher',
    stats: ['speed', 'reload', 'damage', 'range', 'turn'],
    paths: {
      front: ['chase_cannon:chase_cannon_1', 'chase_cannon:long_chase', 'chase_cannon:bow_bombard'],
      side: ['rows:side_rows_1', 'rows:side_rows_2', 'rows:rowers_x', 'rows:ultra_rowers'],
      deck: ['dual_cannon:dual_cannon_1', 'dual_cannon:twin_cannon', 'dual_cannon:twin_cannon_x'],
      rear: ['mine_dropper:mine_dropper_1', 'mine_dropper:bigger_mines', 'mine_dropper:sea_mines'],
    },
  },
  {
    name: 'Pirómano',
    profile: 'burner',
    stats: ['hull', 'reload', 'speed', 'repair', 'damage'],
    paths: {
      front: ['greek_fire:greek_fire_1', 'greek_fire:greek_fire_x', 'greek_fire:dragon_fire'],
      side: ['chain_shot:chain_shot_1', 'chain_shot:chain_shot_x', 'chain_shot:chain_shot_heavy'],
      deck: [
        'swivel_cannon:swivel_cannon_1',
        'swivel_cannon:gatling_cannon',
        'swivel_cannon:gatling_cannon_2',
        'swivel_cannon:gatling_cannon_3',
      ],
      rear: ['oil_slick:oil_slick_1', 'oil_slick:oil_slick_x', 'oil_slick:sea_of_fire'],
    },
  },
  {
    name: 'Mortero',
    profile: 'mortarist',
    stats: ['damage', 'range', 'reload', 'hull', 'speed'],
    paths: {
      front: ['chase_cannon:chase_cannon_1', 'chase_cannon:long_chase', 'chase_cannon:bow_bombard'],
      side: ['rows:side_rows_1', 'rows:side_rows_2', 'rows:rowers_x', 'rows:ultra_rowers'],
      deck: ['mortar:mortar_1', 'mortar:heavy_mortar', 'mortar:siege_mortar'],
      rear: ['mine_dropper:mine_dropper_1', 'mine_dropper:bigger_mines', 'mine_dropper:sea_mines'],
    },
  },
  {
    name: 'Cuádruple',
    profile: 'turret',
    stats: ['reload', 'damage', 'hull', 'turn', 'repair'],
    paths: {
      front: ['ram:battering_ram', 'ram:greater_ram', 'ram:ultra_ram'],
      side: ['chain_shot:chain_shot_1', 'chain_shot:chain_shot_x', 'chain_shot:chain_shot_heavy'],
      deck: ['dual_cannon:dual_cannon_1', 'dual_cannon:quad_cannon', 'dual_cannon:quad_cannon_x'],
      rear: ['rear_cannon:rear_cannon_1', 'rear_cannon:rear_cannon_2', 'rear_cannon:rear_battery'],
    },
  },
  {
    name: 'Batería',
    profile: 'mortarist',
    stats: ['damage', 'reload', 'range', 'hull', 'repair'],
    paths: {
      front: ['greek_fire:greek_fire_1', 'greek_fire:greek_fire_x', 'greek_fire:dragon_fire'],
      side: ['side_cannons:side_cannons_1', 'side_cannons:side_shots', 'side_cannons:side_shots_x'],
      deck: ['mortar:mortar_1', 'mortar:mortar_battery', 'mortar:grand_battery'],
      rear: ['oil_slick:oil_slick_1', 'oil_slick:oil_slick_x', 'oil_slick:sea_of_fire'],
    },
  },
]

function equipFor(b: Build, picks: number): Ship['equip'] {
  const depth: Record<SlotId, number> = { front: 0, side: 0, deck: 0, rear: 0 }
  let left = picks
  for (const s of SLOT_ORDER)
    if (left > 0) {
      depth[s] = 1
      left--
    }
  const order: SlotId[] = ['deck', 'side', 'front', 'rear']
  let progress = true
  while (left > 0 && progress) {
    progress = false
    for (const s of order) {
      if (left > 0 && depth[s] < b.paths[s].length) {
        depth[s]++
        left--
        progress = true
      }
    }
  }
  const equip: Ship['equip'] = {}
  for (const s of SLOT_ORDER) {
    if (!depth[s]) continue
    const [branchId, tierId] = b.paths[s][depth[s] - 1].split(':')
    if (!findTier(s, branchId, tierId)) throw new Error(`nivel inexistente ${s} ${branchId}:${tierId}`)
    equip[s] = { branchId, tierId }
  }
  return equip
}

function setup(world: World, id: string, b: Build, x: number, angle: number): Ship {
  const s = createShip(world, id, b.name, null, true)
  s.x = x
  s.y = (world.random() - 0.5) * 200
  s.angle = angle
  s.spawnProtectedUntil = 0
  s.equip = equipFor(b, PICKS)
  Object.assign(s.statLevels, statsFor(b))
  s.equipPicks = 0
  s.equipLevel = 16
  s.coins = 0
  s.loadoutVersion++
  const d = derived(s)
  s.maxHp = d.maxHp
  s.hp = d.maxHp
  const mem = ensureBotMemory(world, s)
  mem.profile = b.profile
  return s
}

// Mismo reparto de 40 puntos para todos: así se mide el arma, no la estadística
function statsFor(b: Build): Record<StatId, number> {
  const ram = b.profile === 'rammer'
  return { hull: 8, repair: 5, range: 5, damage: ram ? 0 : 8, reload: 7, speed: 5, turn: 2, ram: ram ? 8 : 0 }
}

const dealt = new Map<string, { dmg: number; secs: number }>()

function duel(a: Build, b: Build): { winner: 0 | 1 | -1; seconds: number } {
  const world = createWorld('ffa')
  world.bosses.clear()
  world.islands = []
  world.whirlpools = []
  const A = setup(world, 'a', a, -380, 0)
  const B = setup(world, 'b', b, 380, Math.PI)
  for (let t = 0; t < MAX_SECONDS / DT; t++) {
    const ev = simulateTick(world, DT)
    for (const e of ev)
      if (e.type === 'hit' && e.sourceId) {
        const who = e.sourceId === 'a' ? a.name : e.sourceId === 'b' ? b.name : ''
        if (who) {
          const r = dealt.get(who) ?? { dmg: 0, secs: 0 }
          r.dmg += e.damage
          dealt.set(who, r)
        }
      }
    for (const nm of [a.name, b.name]) {
      const r = dealt.get(nm) ?? { dmg: 0, secs: 0 }
      r.secs += DT
      dealt.set(nm, r)
    }
    // Sin reaparición ni monedas de recompensa: el duelo termina con la primera baja
    if (!A.alive || !B.alive) return { winner: !A.alive && !B.alive ? -1 : A.alive ? 0 : 1, seconds: t * DT }
    A.coins = 0
    B.coins = 0
  }
  const fa = A.hp / A.maxHp
  const fb = B.hp / B.maxHp
  return { winner: Math.abs(fa - fb) < 0.05 ? -1 : fa > fb ? 0 : 1, seconds: MAX_SECONDS }
}

const n = BUILDS.length
const wins = Array.from({ length: n }, () => new Array(n).fill(0))
const total = new Array(n).fill(0)
const score = new Array(n).fill(0)
let seconds = 0
let duels = 0
const t0 = Date.now()
for (let i = 0; i < n; i++) {
  for (let j = i + 1; j < n; j++) {
    for (let k = 0; k < DUELS; k++) {
      // Alterna el lado de salida para no favorecer a nadie
      const flip = k % 2 === 1
      const r = flip ? duel(BUILDS[j], BUILDS[i]) : duel(BUILDS[i], BUILDS[j])
      const w = r.winner === -1 ? -1 : flip ? (r.winner === 0 ? j : i) : r.winner === 0 ? i : j
      seconds += r.seconds
      duels++
      total[i]++
      total[j]++
      if (w === -1) {
        score[i] += 0.5
        score[j] += 0.5
      } else {
        score[w]++
        wins[w][w === i ? j : i]++
      }
    }
  }
}

console.log(
  `Mejoras por barco: ${PICKS} · duelos por pareja: ${DUELS} · duración media: ${(seconds / duels).toFixed(1)} s · ${(Date.now() - t0) / 1000}s de cálculo`,
)
const order = BUILDS.map((b, i) => ({ b, i })).sort(
  (x, y) => score[y.i] / total[y.i] - score[x.i] / total[x.i],
)
console.table(
  order.map(({ b, i }) => {
    const row: Record<string, string> = {
      estilo: b.name,
      victorias: `${Math.round((score[i] / total[i]) * 100)}%`,
    }
    for (let j = 0; j < n; j++)
      if (j !== i) row[BUILDS[j].name.slice(0, 6)] = `${Math.round((wins[i][j] / DUELS) * 100)}`
    return row
  }),
)

console.table(
  BUILDS.map((b) => {
    const eq = equipFor(b, PICKS)
    const stats: Record<string, number> = statsFor(b)
    const m = loadoutMetrics(stats, eq)
    const d = computeDerivedStats({ statLevels: stats, equip: eq })
    const r = dealt.get(b.name)!
    return {
      estilo: b.name,
      dps_teorico: Math.round(m.firepower),
      dps_real: (r.dmg / r.secs).toFixed(1),
      alcance: Math.round(m.range),
      vida: d.maxHp,
      velocidad: Math.round(d.moveSpeed),
      embestida: Math.round(d.ramDamage),
      equipo: Object.values(eq)
        .map((x) => x!.tierId)
        .join(' '),
    }
  }),
)
