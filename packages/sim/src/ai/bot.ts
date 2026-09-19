import {
  findBossDef,
  findBranch,
  findTier,
  SLOT_ORDER,
  SLOT_UNLOCK_LEVEL,
  type SlotId,
  type StatId,
} from '@doblonia/content'
import type { Boss, BotProfile, Ship, World } from '../types.js'
import { areAllies } from '../types.js'
import { buyFleet, equipPick, purchaseStat } from '../economy.js'
import { isProtectedNewbie } from '../firing.js'
import { derived } from '../loadout.js'
import { isInsideAnyIsland, CENTER_RADIUS } from '../world.js'

const PERCEPTION = 900

interface ProfileSpec {
  stats: StatId[]
  branches: Record<SlotId, string>
  /** Distancia a la que le gusta combatir (0 = cuerpo a cuerpo). */
  preferRange: number
  fleet: string[]
}

const PROFILES: Record<BotProfile, ProfileSpec> = {
  gunner: {
    stats: ['damage', 'reload', 'range', 'hull', 'speed', 'repair', 'turn', 'ram'],
    branches: { front: 'chase_cannon', side: 'side_cannons', deck: 'big_cannon', rear: 'rear_cannon' },
    preferRange: 230,
    fleet: ['battleship', 'fishing_boat'],
  },
  rammer: {
    stats: ['ram', 'hull', 'speed', 'turn', 'repair', 'reload', 'damage', 'range'],
    branches: { front: 'ram', side: 'rows', deck: 'swivel_cannon', rear: 'rudder' },
    preferRange: 0,
    fleet: ['mine_dropper_fleet', 'fishing_boat'],
  },
  turret: {
    stats: ['reload', 'damage', 'hull', 'repair', 'range', 'speed', 'turn', 'ram'],
    branches: { front: 'chase_cannon', side: 'scatter', deck: 'auto_cannon', rear: 'mine_dropper' },
    preferRange: 190,
    fleet: ['fishing_boat', 'battleship'],
  },
  skirmisher: {
    stats: ['speed', 'reload', 'damage', 'range', 'turn', 'hull', 'repair', 'ram'],
    branches: { front: 'chase_cannon', side: 'rows', deck: 'dual_cannon', rear: 'mine_dropper' },
    preferRange: 250,
    fleet: ['fishing_boat', 'mine_dropper_fleet'],
  },
  burner: {
    stats: ['hull', 'reload', 'speed', 'repair', 'damage', 'turn', 'range', 'ram'],
    branches: { front: 'greek_fire', side: 'chain_shot', deck: 'swivel_cannon', rear: 'oil_slick' },
    preferRange: 110,
    fleet: ['battleship', 'fishing_boat'],
  },
  mortarist: {
    stats: ['damage', 'range', 'reload', 'hull', 'speed', 'repair', 'turn', 'ram'],
    branches: { front: 'chase_cannon', side: 'rows', deck: 'mortar', rear: 'mine_dropper' },
    preferRange: 360,
    fleet: ['fishing_boat', 'mine_dropper_fleet'],
  },
}

const PROFILE_LIST = Object.keys(PROFILES) as BotProfile[]

export function ensureBotMemory(world: World, ship: Ship): NonNullable<Ship['botState']> {
  if (!ship.botState) {
    ship.botState = {
      profile: PROFILE_LIST[Math.floor(world.random() * PROFILE_LIST.length)],
      wanderAngle: world.random() * Math.PI * 2,
      wanderUntil: 0,
      aimError: 0.04 + world.random() * 0.1,
      reactionAt: 0,
      targetId: null,
      stuckTimer: 0,
      unstickUntil: 0,
      unstickTurn: 1,
    }
  }
  return ship.botState
}

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

function power(s: Ship): number {
  return Object.values(s.statLevels).reduce((a, b) => a + b, 0)
}

/** Fuerza estimada con información visible: poder, vida y flota. */
function strength(world: World, s: Ship): number {
  const hp = Math.max(0.05, s.hp / Math.max(1, s.maxHp))
  const fleet = s.fleetIds.filter((id) => world.fleet.has(id)).length
  const gear = Object.keys(s.equip).length
  return (power(s) + 8 + gear * 4) * Math.pow(hp, 0.7) * (1 + fleet * 0.15)
}

interface WeaponInfo {
  deckRange: number
  deckSpeed: number
  sideRange: number
  frontRange: number
  rearRange: number
  mines: boolean
  auto: boolean
}

function weaponInfo(ship: Ship): WeaponInfo {
  const d = derived(ship)
  const info: WeaponInfo = {
    deckRange: 260 + d.rangeBonus,
    deckSpeed: 420 + d.bulletSpeedBonus,
    sideRange: 0,
    frontRange: 0,
    rearRange: 0,
    mines: false,
    auto: false,
  }
  for (const slot of SLOT_ORDER) {
    const eq = ship.equip[slot]
    if (!eq) continue
    const e = findTier(slot, eq.branchId, eq.tierId)?.effect
    if (!e) continue
    if (e.kind === 'mine') info.mines = true
    if (e.kind !== 'cannon') continue
    const range = e.range + d.rangeBonus
    if (e.autoAim) info.auto = true
    if (slot === 'deck') {
      info.deckRange = range
      info.deckSpeed = e.bulletSpeed + d.bulletSpeedBonus
    } else if (slot === 'side') info.sideRange = range
    else if (slot === 'front') info.frontRange = range
    else info.rearRange = range
  }
  return info
}

/** Solo dispara si alguna arma puede acertar desde la posición actual. */
function shouldFire(ship: Ship, w: WeaponInfo, tx: number, ty: number): boolean {
  const dist = Math.hypot(tx - ship.x, ty - ship.y)
  const rel = wrap(Math.atan2(ty - ship.y, tx - ship.x) - ship.angle)
  if (dist <= w.deckRange * 0.95) return true
  if (w.sideRange && dist <= w.sideRange && Math.abs(Math.abs(rel) - Math.PI / 2) < 0.45) return true
  if (w.frontRange && dist <= w.frontRange && Math.abs(rel) < 0.4) return true
  if (w.rearRange && dist <= w.rearRange && Math.abs(wrap(rel - Math.PI)) < 0.4) return true
  if (w.mines && dist < 320 && Math.abs(wrap(rel - Math.PI)) < 0.9) return true
  return false
}

function steer(ship: Ship, heading: number, throttle: number): void {
  const diff = wrap(heading - ship.angle)
  ship.input.turn = Math.max(-1, Math.min(1, diff / 0.45))
  ship.input.throttle = Math.abs(diff) < 1.2 ? throttle : throttle * 0.35
}

function blockedAt(world: World, x: number, y: number, ship?: Ship): boolean {
  const half = world.mapSize / 2 - 120
  if (Math.abs(x) > half || Math.abs(y) > half) return true
  if (isInsideAnyIsland(world, x, y, 24)) return true
  if (world.whirlpools.some((wp) => Math.hypot(wp.x - x, wp.y - y) < wp.radius * 0.75)) return true
  // Minas y aceite enemigos a la vista: se rodean en vez de atravesarlos
  if (ship) {
    for (const m of world.mines.values()) {
      if (areAllies(world, m.team, m.ownerShipId, ship.team, ship.id)) continue
      if (Math.hypot(m.x - x, m.y - y) < m.radius + 30) return true
    }
  }
  return false
}

/** Desvía el rumbo si hay isla, remolino o borde justo delante (dos sondas: cerca y lejos). */
function avoidObstacles(world: World, ship: Ship, heading: number): number {
  const r = derived(ship).radius
  const blocked = (a: number) => {
    for (const probe of [r + 60, r + 140]) {
      if (blockedAt(world, ship.x + Math.cos(a) * probe, ship.y + Math.sin(a) * probe, ship)) return true
    }
    return false
  }
  if (!blocked(heading)) return heading
  for (let k = 1; k <= 8; k++) {
    const off = k * 0.3
    if (!blocked(heading + off)) return heading + off
    if (!blocked(heading - off)) return heading - off
  }
  return heading + Math.PI
}

function dangerZone(world: World, x: number, y: number, strongVs: (b: Boss) => boolean): Boss | undefined {
  for (const b of world.bosses.values()) {
    if (!b.alive || strongVs(b)) continue
    const def = findBossDef(b.archetype)
    if (Math.hypot(b.x - x, b.y - y) < def.guardRadius * 0.85) return b
  }
  return undefined
}

export function updateBotBrain(world: World, ship: Ship): void {
  if (!ship.isBot || !ship.alive) return
  const mem = ensureBotMemory(world, ship)
  const profile = PROFILES[mem.profile]
  const now = world.timeMs
  const myPower = power(ship)
  const hpFrac = ship.hp / Math.max(1, ship.maxHp)
  const myStrength = strength(world, ship)
  const w = weaponInfo(ship)
  // Con arma de cubierta de largo alcance, pelea a su distancia (y no se deja cerrar)
  const longRange = w.deckRange >= 420
  const engageRange =
    profile.preferRange > 0
      ? Math.max(profile.preferRange, w.sideRange * 0.8, longRange ? w.deckRange * 0.72 : 0)
      : 0

  // Contra jefes: fuertes a partir de poder 35, jefes grandes a partir de 60 y con vida alta.
  const canTakeBoss = (b: Boss) => {
    const def = findBossDef(b.archetype)
    if (def.kind === 'fort') return myPower >= 35 && hpFrac > 0.6
    return myPower >= 60 && hpFrac > 0.75
  }

  ship.input.firing = false
  ship.input.fireCoin = false

  // --- Atasco: marcha atrás y giro breve ---
  const speed = Math.hypot(ship.vx, ship.vy)
  if (now < mem.unstickUntil) {
    ship.input.throttle = -1
    ship.input.turn = mem.unstickTurn
    return
  }
  if (speed < 12 && Math.abs(ship.input.throttle) > 0.3) mem.stuckTimer += 0.05
  else mem.stuckTimer = 0
  if (mem.stuckTimer > 1.2) {
    mem.stuckTimer = 0
    mem.unstickUntil = now + 900
    mem.unstickTurn = world.random() < 0.5 ? -1 : 1
    return
  }

  // --- Elegir objetivo: prioriza a quien le atacó, a los débiles y a los cercanos ---
  let target: Ship | undefined
  let bestScore = 0
  let threat: Ship | undefined
  let threatRatio = Infinity
  for (const other of world.ships.values()) {
    if (other.id === ship.id || !other.alive || now < other.spawnProtectedUntil) continue
    if (areAllies(world, ship.team, ship.id, other.team, other.id)) continue
    if (isProtectedNewbie(other, ship)) continue
    const d = Math.hypot(other.x - ship.x, other.y - ship.y)
    if (d > PERCEPTION) continue
    const ratio = myStrength / strength(world, other)
    if (ratio < threatRatio && d < 520) {
      threatRatio = ratio
      threat = other
    }
    const weak = 1.6 - other.hp / Math.max(1, other.maxHp)
    const revenge = ship.lastDamagedBy === other.id && now - ship.lastDamageAt < 6000 ? 2.5 : 1
    const score = (weak * revenge * Math.min(2, ratio)) / (d + 120)
    if (score > bestScore) {
      bestScore = score
      target = other
    }
  }

  let heading: number
  let throttle: number
  let aimAt: { x: number; y: number; vx: number; vy: number } | undefined

  const bossDanger = dangerZone(world, ship.x, ship.y, canTakeBoss)

  if (bossDanger) {
    // Salir de la zona de un jefe o fuerte que no puede vencer, disparando si puede.
    heading = Math.atan2(ship.y - bossDanger.y, ship.x - bossDanger.x)
    throttle = 1
    aimAt = bossDanger
  } else if (threat && threatRatio < 0.6 && Math.hypot(threat.x - ship.x, threat.y - ship.y) < 480) {
    // Huir de un enemigo claramente superior; la popa y las minas cubren la retirada.
    heading = Math.atan2(ship.y - threat.y, ship.x - threat.x)
    throttle = 1
    aimAt = threat
  } else if (target && (hpFrac > 0.4 || target.hp / Math.max(1, target.maxHp) < 0.3)) {
    aimAt = target
    const d = Math.hypot(target.x - ship.x, target.y - ship.y)
    const toT = Math.atan2(target.y - ship.y, target.x - ship.x)
    if (engageRange === 0) {
      // Embestida: cargar hacia donde estará; tras el choque, abrirse en arco y volver a cargar
      const contact = derived(ship).radius + derived(target).radius + 3
      if (d < contact && (mem.ramBackoffUntil ?? 0) < now) mem.ramBackoffUntil = now + 480
      if ((mem.ramBackoffUntil ?? 0) > now) {
        heading = toT + Math.PI * 0.6 * (mem.unstickTurn || 1)
      } else {
        heading = Math.atan2(target.y + target.vy * 0.45 - ship.y, target.x + target.vx * 0.45 - ship.x)
      }
      throttle = 1
    } else if (longRange && engageRange > 0 && d < engageRange * 0.62) {
      // Demasiado cerca para un barco de largo alcance: abrir distancia sin dar la popa del todo
      const side = wrap(toT - ship.angle) > 0 ? 1 : -1
      heading = toT - side * Math.PI * 0.8
      throttle = 1
    } else if (w.sideRange > 0 && d < w.sideRange + 80 && !(longRange && d > w.sideRange * 0.9)) {
      // Ponerse de costado y orbitar a la distancia de la andanada
      const side = wrap(toT - ship.angle) > 0 ? 1 : -1
      // Demasiado cerca: abrirse (más de 90°); demasiado lejos: cerrar hacia el objetivo
      const correction = d < engageRange * 0.7 ? 0.35 : d > engageRange * 1.1 ? -0.45 : 0
      heading = toT - side * (Math.PI / 2 + correction)
      throttle = 0.75
    } else if (d > engageRange) {
      heading = toT
      throttle = 1
    } else {
      // Mantener distancia orbitando
      heading = toT + (Math.PI / 2) * (mem.unstickTurn || 1) + (d < engageRange * 0.6 ? 0.6 : 0)
      throttle = 0.6
    }
  } else if (hpFrac < 0.4) {
    // Retirada para reparar: alejarse de todo y esperar a regenerar.
    const away = threat ?? target
    heading = away ? Math.atan2(ship.y - away.y, ship.x - away.x) : ship.angle
    throttle = away ? 1 : 0.3
    if (away) aimAt = away
  } else {
    // Jefe o fuerte al alcance si es lo bastante fuerte
    let prey: Boss | undefined
    let preyD = PERCEPTION
    for (const b of world.bosses.values()) {
      if (!b.alive || !canTakeBoss(b)) continue
      const d = Math.hypot(b.x - ship.x, b.y - ship.y)
      if (d < preyD) {
        preyD = d
        prey = b
      }
    }
    if (prey && preyD < 800) {
      aimAt = prey
      const toP = Math.atan2(prey.y - ship.y, prey.x - ship.x)
      const standoff = Math.max(engageRange, 200)
      heading = preyD > standoff ? toP : toP + Math.PI / 2
      throttle = preyD > standoff ? 1 : 0.6
    } else {
      // Recolectar la mejor moneda por valor/distancia, fuera de zonas de peligro
      let best: { x: number; y: number; score: number } | undefined
      for (const coin of world.coins.values()) {
        const d = Math.hypot(coin.x - ship.x, coin.y - ship.y)
        if (d > PERCEPTION) continue
        if (dangerZone(world, coin.x, coin.y, canTakeBoss)) continue
        if (myPower < 45 && Math.hypot(coin.x, coin.y) < CENTER_RADIUS * 0.9) continue
        if (world.whirlpools.some((wp) => Math.hypot(wp.x - coin.x, wp.y - coin.y) < wp.radius * 0.8))
          continue
        const score = coin.value / (d + 80)
        if (!best || score > best.score) best = { x: coin.x, y: coin.y, score }
      }
      if (best) {
        heading = Math.atan2(best.y - ship.y, best.x - ship.x)
        throttle = 1
      } else {
        if (now > mem.wanderUntil) {
          mem.wanderAngle = Math.atan2(-ship.y, -ship.x) + (world.random() - 0.5) * 2.6
          mem.wanderUntil = now + 3000 + world.random() * 3000
        }
        heading = mem.wanderAngle
        throttle = 0.7
      }
    }
  }

  // --- Apuntado con anticipación e imprecisión; tiempo de reacción al cambiar de objetivo ---
  if (aimAt) {
    const id = (aimAt as { id?: string }).id ?? null
    if (id !== mem.targetId) {
      mem.targetId = id
      mem.reactionAt = now + 250 + world.random() * 300
    }
    const d = Math.hypot(aimAt.x - ship.x, aimAt.y - ship.y)
    const t = d / Math.max(200, w.deckSpeed)
    const px = aimAt.x + aimAt.vx * t
    const py = aimAt.y + aimAt.vy * t
    ship.input.aimAngle = Math.atan2(py - ship.y, px - ship.x) + (world.random() - 0.5) * mem.aimError * 2
    ship.input.aimDist = Math.hypot(px - ship.x, py - ship.y)
    ship.input.firing = now >= mem.reactionAt && shouldFire(ship, w, px, py)
  } else {
    mem.targetId = null
    ship.input.aimAngle = heading
  }

  heading = avoidObstacles(world, ship, heading)
  steer(ship, heading, throttle)
}

/** Compras de los bots según su perfil. Mismas reglas y precios que un humano. */
export function updateBotEconomy(world: World, ship: Ship): void {
  if (!ship.isBot || !ship.alive) return
  const mem = ensureBotMemory(world, ship)
  const profile = PROFILES[mem.profile]

  for (let guard = 0; guard < 4 && ship.equipPicks > 0; guard++) {
    let picked = false
    for (const slot of SLOT_ORDER) {
      if (ship.equipLevel < SLOT_UNLOCK_LEVEL[slot]) continue
      const current = ship.equip[slot]
      if (!current) {
        const branch = findBranch(slot, profile.branches[slot])
        if (branch && equipPick(ship, slot, branch.id, branch.tiers[0].id).ok) {
          picked = true
          break
        }
      } else {
        const branch = findBranch(slot, current.branchId)
        const tier = branch?.tiers.find((t) => t.id === current.tierId)
        const options = tier?.nextIds ?? []
        if (options.length > 0) {
          const choice = options[Math.floor(world.random() * options.length)]
          if (equipPick(ship, slot, current.branchId, choice).ok) {
            picked = true
            break
          }
        }
      }
    }
    if (!picked) break
  }

  // Curarse comprando Casco cuando va mal de vida (la compra cura 65)
  if (ship.hp / ship.maxHp < 0.45) purchaseStat(ship, 'hull')

  if (ship.coins > 700 && world.random() < 0.3) {
    for (const defId of profile.fleet) {
      if (buyFleet(world, ship, defId).ok) break
    }
  }

  let bought = true
  for (let guard = 0; guard < 6 && bought; guard++) {
    bought = false
    for (let i = 0; i < profile.stats.length; i++) {
      const stat = profile.stats[i]
      const cap = i < 3 ? 15 : i < 5 ? 10 : 6
      if ((ship.statLevels[stat] ?? 0) >= cap) continue
      if (purchaseStat(ship, stat).ok) {
        bought = true
        break
      }
    }
  }
}
