// Informe de comportamiento de la IA: `npx tsx scripts/ai-report.ts [segundos]`
// Simula una partida sin interfaz y mide atascos, choques, causas de muerte, puntería y progresión.
import {
  createWorld,
  createShip,
  simulateTick,
  isInsideAnyIsland,
  type WorldEvent,
} from '../packages/sim/src/index.js'

const SECONDS = Number(process.argv[2] ?? 300)
const DT = 0.05
const SEED = Number(process.argv[3] ?? 20260919)
const world = createWorld('ffa', SEED)
console.log(`Simulación de ${SECONDS} segundos · semilla ${world.seed}`)
for (let i = 0; i < 16; i++) createShip(world, `bot${i}`, `Bot ${i}`, null, true)

interface Stat {
  stuckSeconds: number
  islandHits: number
  deaths: Record<string, number>
  shots: number
  hits: number
  maxLevel: number
  maxPower: number
  kills: number
  centerSeconds: number
  profile: string
  lowSpeedTimer: number
}
const stats = new Map<string, Stat>()
for (const s of world.ships.values()) {
  stats.set(s.id, {
    stuckSeconds: 0,
    islandHits: 0,
    deaths: {},
    shots: 0,
    hits: 0,
    maxLevel: 1,
    maxPower: 0,
    kills: 0,
    centerSeconds: 0,
    profile: '',
    lowSpeedTimer: 0,
  })
}

let bossKills = 0
let totalDeaths = 0
// Última posición conocida de cada bala: al desaparecer se mira si hubo un impacto de su dueño allí mismo
const bulletLast = new Map<string, { owner: string; x: number; y: number; vx: number; vy: number }>()
const causes: Record<string, number> = {}

for (let t = 0; t < SECONDS / DT; t++) {
  const events: WorldEvent[] = simulateTick(world, DT)
  for (const [id, b] of world.bullets) {
    if (!bulletLast.has(id)) {
      const st = stats.get(b.ownerShipId)
      if (st) st.shots++
    }
    bulletLast.set(id, { owner: b.ownerShipId, x: b.x, y: b.y, vx: b.vx, vy: b.vy })
  }
  for (const [id, b] of bulletLast) {
    if (world.bullets.has(id)) continue
    bulletLast.delete(id)
    const st = stats.get(b.owner)
    if (!st) continue
    const px = b.x + b.vx * DT
    const py = b.y + b.vy * DT
    const hit = events.some(
      (e) =>
        e.type === 'hit' &&
        e.sourceId === b.owner &&
        e.targetKind !== 'fleet' &&
        Math.hypot(e.x - px, e.y - py) < 90,
    )
    if (hit) st.hits++
  }
  for (const e of events) {
    if (e.type === 'ramHit' && isInsideAnyIsland(world, e.x, e.y, 12)) {
      let nearest = ''
      let nd = Infinity
      for (const s of world.ships.values()) {
        const d = Math.hypot(s.x - e.x, s.y - e.y)
        if (d < nd) {
          nd = d
          nearest = s.id
        }
      }
      const st = stats.get(nearest)
      if (st) st.islandHits++
    }
    if (e.type === 'death') {
      totalDeaths++
      const st = stats.get(e.shipId)
      const k = e.killedByShipId
      const cause = !k ? 'entorno' : k.startsWith('boss') ? 'jefe' : k.startsWith('fort') ? 'fuerte' : 'barco'
      causes[cause] = (causes[cause] ?? 0) + 1
      if (st) st.deaths[cause] = (st.deaths[cause] ?? 0) + 1
    }
    if (e.type === 'bossDeath') bossKills++
  }
  for (const s of world.ships.values()) {
    const st = stats.get(s.id)!
    st.profile = s.botState?.profile ?? ''
    if (!s.alive) continue
    st.maxLevel = Math.max(st.maxLevel, s.equipLevel)
    st.maxPower = Math.max(
      st.maxPower,
      Object.values(s.statLevels).reduce((a, b) => a + b, 0),
    )
    st.kills = s.kills
    if (Math.hypot(s.x, s.y) < 900) st.centerSeconds += DT
    const speed = Math.hypot(s.vx, s.vy)
    if (speed < 12 && Math.abs(s.input.throttle) > 0.3) {
      st.lowSpeedTimer += DT
      if (st.lowSpeedTimer > 1.5) st.stuckSeconds += DT
    } else {
      st.lowSpeedTimer = 0
    }
  }
}

const rows = [...stats.entries()].map(([id, s]) => ({
  id,
  perfil: s.profile,
  atascado_s: s.stuckSeconds.toFixed(1),
  choques_isla: s.islandHits,
  muertes:
    Object.entries(s.deaths)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ') || '-',
  bajas: s.kills,
  punteria: s.shots ? `${((s.hits / s.shots) * 100).toFixed(0)}% (${s.shots})` : '-',
  nivel_max: s.maxLevel,
  poder_max: s.maxPower,
  centro_s: s.centerSeconds.toFixed(0),
}))
console.table(rows)
console.log(
  `Muertes totales: ${totalDeaths} (${Object.entries(causes)
    .map(([k, v]) => `${k} ${v}`)
    .join(
      ', ',
    )}) · Jefes hundidos: ${bossKills} · Balas vivas al final: ${world.bullets.size} · Monedas: ${world.coins.size}`,
)
const stuckTotal = [...stats.values()].reduce((a, s) => a + s.stuckSeconds, 0)
console.log(`Tiempo total atascado (todos los bots): ${stuckTotal.toFixed(0)} s de ${16 * SECONDS} s`)
