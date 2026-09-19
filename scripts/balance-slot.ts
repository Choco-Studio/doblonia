// Equilibrado por puesto: `npx tsx scripts/balance-slot.ts <front|side|deck|rear> <nivel> [duelos]`
// Todas las ramas del puesto, al mismo nivel (o su máximo si la rama es más corta), con el resto
// del barco idéntico. Duelos todos contra todos entre bots; da % de victorias y daño real por segundo.
import {
  createWorld,
  createShip,
  simulateTick,
  derived,
  ensureBotMemory,
  type Ship,
} from '../packages/sim/src/index.js'
import { BRANCHES_BY_SLOT, SLOT_ORDER, type SlotId, type StatId } from '../packages/content/src/index.js'

const SLOT = (process.argv[2] ?? 'deck') as SlotId
const LEVEL = Number(process.argv[3] ?? 3)
const DUELS = Number(process.argv[4] ?? 30)
const DT = 0.05
const MAX_SECONDS = 75

const BASE: Record<SlotId, { branchId: string; tierId: string }> = {
  front: { branchId: 'chase_cannon', tierId: 'chase_cannon_1' },
  side: { branchId: 'side_cannons', tierId: 'side_cannons_1' },
  deck: { branchId: 'swivel_cannon', tierId: 'swivel_cannon_1' },
  rear: { branchId: 'rear_cannon', tierId: 'rear_cannon_1' },
}

interface Entry {
  name: string
  branchId: string
  tierId: string
}
const entries: Entry[] = []
for (const br of BRANCHES_BY_SLOT[SLOT]) {
  const maxTier = Math.max(...br.tiers.map((t) => t.tier))
  const want = Math.min(LEVEL, maxTier)
  for (const t of br.tiers.filter((x) => x.tier === want))
    entries.push({ name: t.name, branchId: br.id, tierId: t.id })
}

const stats: Record<StatId, number> = {
  hull: 8,
  repair: 5,
  range: 5,
  damage: 8,
  reload: 7,
  speed: 5,
  turn: 2,
  ram: 0,
}

function setup(world: ReturnType<typeof createWorld>, id: string, e: Entry, x: number, angle: number): Ship {
  const s = createShip(world, id, e.name, null, true)
  s.x = x
  s.y = (world.random() - 0.5) * 200
  s.angle = angle
  s.spawnProtectedUntil = 0
  s.equip = {}
  for (const sl of SLOT_ORDER)
    s.equip[sl] = sl === SLOT ? { branchId: e.branchId, tierId: e.tierId } : BASE[sl]
  const ram = e.branchId === 'ram'
  Object.assign(s.statLevels, stats, ram ? { damage: 0, ram: 8 } : {})
  s.equipPicks = 0
  s.equipLevel = 16
  s.loadoutVersion++
  s.maxHp = s.hp = derived(s).maxHp
  ensureBotMemory(world, s).profile = ram
    ? 'rammer'
    : e.branchId === 'mortar'
      ? 'mortarist'
      : e.branchId === 'rows'
        ? 'skirmisher'
        : 'gunner'
  return s
}

const n = entries.length
const score = new Array(n).fill(0)
const games = new Array(n).fill(0)
const dmg = new Array(n).fill(0)
const secs = new Array(n).fill(0)
const vs = Array.from({ length: n }, () => new Array(n).fill(0))
for (let i = 0; i < n; i++)
  for (let j = i + 1; j < n; j++)
    for (let k = 0; k < DUELS; k++) {
      const flip = k % 2 === 1
      const [ia, ib] = flip ? [j, i] : [i, j]
      const world = createWorld('ffa')
      world.bosses.clear()
      world.islands = []
      world.whirlpools = []
      const A = setup(world, 'a', entries[ia], -380, 0)
      const B = setup(world, 'b', entries[ib], 380, Math.PI)
      let t = 0
      for (; t < MAX_SECONDS / DT; t++) {
        for (const e of simulateTick(world, DT))
          if (e.type === 'hit' && e.sourceId) dmg[e.sourceId === 'a' ? ia : ib] += e.damage
        A.coins = B.coins = 0
        if (!A.alive || !B.alive) break
      }
      secs[ia] += t * DT
      secs[ib] += t * DT
      games[ia]++
      games[ib]++
      let w = -1
      if (!A.alive && B.alive) w = ib
      else if (A.alive && !B.alive) w = ia
      else if (A.alive && B.alive) {
        const fa = A.hp / A.maxHp
        const fb = B.hp / B.maxHp
        if (Math.abs(fa - fb) > 0.05) w = fa > fb ? ia : ib
      }
      if (w < 0) {
        score[ia] += 0.5
        score[ib] += 0.5
      } else {
        score[w]++
        vs[w][w === ia ? ib : ia]++
      }
    }

console.log(`Puesto ${SLOT} · nivel ${LEVEL} · ${DUELS} duelos por pareja`)
console.table(
  entries
    .map((e, i) => ({
      i,
      arma: e.tierId,
      victorias: `${Math.round((score[i] / games[i]) * 100)}%`,
      dps_real: (dmg[i] / secs[i]).toFixed(1),
      ...Object.fromEntries(
        entries.map((_, j) => [String(j), j === i ? '-' : Math.round((vs[i][j] / DUELS) * 100)]),
      ),
    }))
    .sort((a, b) => parseInt(b.victorias) - parseInt(a.victorias)),
)
