import { statusBits, slowFactor, type World } from '@doblonia/sim'
import { findBossDef } from '@doblonia/content'
import {
  BossStateSchema,
  BulletStateSchema,
  CoinStateSchema,
  FleetStateSchema,
  IslandStateSchema,
  WhirlpoolStateSchema,
  MineStateSchema,
  RoomStateSchema,
  ShipStateSchema,
} from '@doblonia/protocol'

export function syncIslandsOnce(world: World, state: RoomStateSchema): void {
  for (const island of world.islands) {
    const s = new IslandStateSchema()
    s.id = island.id
    s.x = island.x
    s.y = island.y
    s.seed = island.seed
    s.circlesJson = JSON.stringify(
      island.circles.map((c) => ({ dx: Math.round(c.dx), dy: Math.round(c.dy), r: Math.round(c.r) })),
    )
    state.islands.push(s)
  }
  for (const w of world.whirlpools) {
    const s = new WhirlpoolStateSchema()
    s.x = w.x
    s.y = w.y
    s.radius = w.radius
    s.strength = w.strength
    state.whirlpools.push(s)
  }
}

/** Asigna solo si cambia: evita marcar campos como sucios sin motivo. */
function set<T extends object, K extends keyof T>(obj: T, key: K, value: T[K]): void {
  if (obj[key] !== value) obj[key] = value
}

function removeMissing(
  map: { keys(): IterableIterator<string>; delete(k: string): unknown },
  alive: Map<string, unknown>,
): void {
  const stale: string[] = []
  for (const id of map.keys()) if (!alive.has(id)) stale.push(id)
  for (const id of stale) map.delete(id)
}

export function syncWorldToState(world: World, state: RoomStateSchema): void {
  state.timeMs = world.timeMs
  set(state, 'mapSize', world.mapSize)
  set(state, 'mode', world.mode)
  set(state, 'scoreRed', world.teamScores.red)
  set(state, 'scoreBlue', world.teamScores.blue)

  for (const [id, ship] of world.ships) {
    let s = state.ships.get(id)
    if (!s) {
      s = new ShipStateSchema()
      s.id = id
      state.ships.set(id, s)
    }
    set(s, 'name', ship.name)
    set(s, 'team', ship.team)
    set(s, 'skin', ship.skin)
    set(s, 'alive', ship.alive)
    if (ship.alive) {
      s.x = ship.x
      s.y = ship.y
      s.vx = ship.vx
      s.vy = ship.vy
      s.angle = ship.angle
      set(s, 'aimAngle', ship.input.aimAngle)
    }
    set(s, 'hp', Math.max(0, Math.ceil(ship.hp)))
    set(s, 'maxHp', ship.maxHp)
    set(s, 'coins', Math.floor(ship.coins))
    set(s, 'score', Math.floor(ship.score))
    set(s, 'equipXp', Math.floor(ship.equipXp))
    set(s, 'equipLevel', ship.equipLevel)
    set(s, 'equipPicks', ship.equipPicks)
    set(s, 'spawnProtectedUntil', ship.spawnProtectedUntil)
    set(s, 'respawnAt', ship.respawnAt)
    set(s, 'lifeStartedAt', ship.lifeStartedAt)
    set(s, 'kills', ship.kills)
    set(s, 'deaths', ship.deaths)
    set(s, 'killedByName', ship.killedByName)
    set(s, 'statsJson', JSON.stringify(ship.statLevels))
    set(s, 'equipJson', JSON.stringify(ship.equip))
    set(s, 'status', ship.alive ? statusBits(ship.fx, world.timeMs) : 0)
    set(s, 'slowMultiplier', ship.alive ? slowFactor(ship.fx, world.timeMs) : 1)
  }
  removeMissing(state.ships, world.ships)
  set(state, 'playerCount', world.ships.size)

  for (const [id, b] of world.bullets) {
    if (state.bullets.has(id)) continue
    const s = new BulletStateSchema()
    s.x = b.x
    s.y = b.y
    s.vx = b.vx
    s.vy = b.vy
    s.t0 = world.timeMs
    s.radius = b.radius
    s.kind = b.kind
    s.owner = b.ownerShipId
    if (b.kind === 'mortar' && b.landAt !== undefined) {
      s.fuse = Math.max(0, b.landAt - world.timeMs)
      s.aoe = b.aoe ?? 50
    }
    state.bullets.set(id, s)
  }
  removeMissing(state.bullets, world.bullets)

  for (const [id, m] of world.mines) {
    let s = state.mines.get(id)
    if (!s) {
      s = new MineStateSchema()
      s.x = m.x
      s.y = m.y
      s.radius = m.radius
      s.owner = m.ownerShipId
      s.team = m.team
      s.expiresAt = m.expiresAt
      s.oil = !!m.oil
      state.mines.set(id, s)
    }
    set(s, 'armed', m.armed)
  }
  removeMissing(state.mines, world.mines)

  for (const [id, c] of world.coins) {
    if (state.coins.has(id)) continue
    const s = new CoinStateSchema()
    s.kind = c.kind
    s.x = c.x
    s.y = c.y
    s.loot = c.lootExpiresAt !== undefined
    state.coins.set(id, s)
  }
  removeMissing(state.coins, world.coins)

  for (const [id, f] of world.fleet) {
    let s = state.fleet.get(id)
    if (!s) {
      s = new FleetStateSchema()
      s.ownerShipId = f.ownerShipId
      s.team = f.team
      s.defId = f.defId
      state.fleet.set(id, s)
    }
    s.x = f.x
    s.y = f.y
    s.vx = f.vx
    s.vy = f.vy
    s.angle = f.angle
    set(s, 'hp', Math.round(f.hp))
    set(s, 'maxHp', f.maxHp)
  }
  removeMissing(state.fleet, world.fleet)

  for (const [id, b] of world.bosses) {
    let s = state.bosses.get(id)
    if (!s) {
      s = new BossStateSchema()
      s.archetype = b.archetype
      s.maxHp = b.maxHp
      s.homeX = b.homeX
      s.homeY = b.homeY
      s.kind = findBossDef(b.archetype).kind
      state.bosses.set(id, s)
    }
    if (b.alive) {
      s.x = b.x
      s.y = b.y
      s.vx = b.vx
      s.vy = b.vy
      s.angle = b.angle
    }
    set(s, 'hp', Math.round(b.hp))
    set(s, 'state', b.state)
    set(s, 'alive', b.alive)
    set(s, 'respawnAt', b.respawnAt)
    set(s, 'status', b.alive ? statusBits(b.fx, world.timeMs) : 0)
  }
  removeMissing(state.bosses, world.bosses)
}
