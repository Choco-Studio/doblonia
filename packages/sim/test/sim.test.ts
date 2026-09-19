import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statUpgradeCost, TOTAL_STAT_POINTS_CAP, findBossDef } from '@doblonia/content'
import {
  createWorld,
  createShip,
  simulateTick,
  purchaseStat,
  equipPick,
  buyFleet,
  grantReward,
  damageBoss,
  killShip,
  derived,
  applySlow,
  slowFactor,
  type WorldEvent,
} from '../src/index.js'

const DT = 0.05

test('coste de estadística por nivel: 10, 20 … 150', () => {
  assert.equal(statUpgradeCost(0), 10)
  assert.equal(statUpgradeCost(14), 150)
})

test('una estadística no pasa de 15 y el total no pasa de 75', () => {
  const world = createWorld('ffa', 20260919)
  const ship = createShip(world, 'p1', 'Test', 'p1', false)
  ship.coins = 1_000_000
  for (let i = 0; i < 20; i++) purchaseStat(ship, 'damage')
  assert.equal(ship.statLevels.damage, 15)
  for (const s of ['hull', 'repair', 'range', 'reload', 'speed', 'turn', 'ram'] as const) {
    for (let i = 0; i < 20; i++) purchaseStat(ship, s)
  }
  const total = Object.values(ship.statLevels).reduce((a, b) => a + b, 0)
  assert.equal(total, TOTAL_STAT_POINTS_CAP)
})

test('comprar Casco sube la vida máxima en 65 y cura 65', () => {
  const world = createWorld('ffa', 20260919)
  world.coins.clear()
  const ship = createShip(world, 'p1', 'Test', 'p1', false)
  ship.coins = 100
  ship.hp = 50
  purchaseStat(ship, 'hull')
  assert.equal(ship.maxHp, 165)
  assert.equal(ship.hp, 115)
  assert.equal(derived(ship).maxHp, 165)
})

test('sin saldo no se compra nada ni se descuenta', () => {
  const world = createWorld('ffa', 20260919)
  const ship = createShip(world, 'p1', 'Test', 'p1', false)
  ship.coins = 5
  const r = purchaseStat(ship, 'speed')
  assert.equal(r.ok, false)
  assert.equal(ship.coins, 5)
  assert.equal(ship.statLevels.speed, 0)
})

test('la elección de rama es permanente durante la vida', () => {
  const world = createWorld('ffa', 20260919)
  const ship = createShip(world, 'p1', 'Test', 'p1', false)
  const events: WorldEvent[] = []
  grantReward(world, ship, 2000, events)
  assert.ok(ship.equipPicks >= 3)
  assert.equal(equipPick(ship, 'front', 'ram', 'battering_ram').ok, true)
  assert.equal(equipPick(ship, 'front', 'chase_cannon', 'chase_cannon_1').ok, false)
  assert.equal(equipPick(ship, 'front', 'ram', 'ultra_ram').ok, false, 'no se puede saltar un nivel')
  assert.equal(equipPick(ship, 'front', 'ram', 'greater_ram').ok, true)
})

test('los slots se desbloquean por nivel', () => {
  const world = createWorld('ffa', 20260919)
  const ship = createShip(world, 'p1', 'Test', 'p1', false)
  const events: WorldEvent[] = []
  grantReward(world, ship, 45, events) // nivel 2
  assert.equal(ship.equipLevel, 2)
  assert.equal(equipPick(ship, 'deck', 'big_cannon', 'big_cannon_1').ok, false)
  assert.ok(events.some((e) => e.type === 'levelUp'))
})

test('límites de flota: 3 ligeros y 1 pesado', () => {
  const world = createWorld('ffa', 20260919)
  const ship = createShip(world, 'p1', 'Test', 'p1', false)
  ship.coins = 100000
  assert.equal(buyFleet(world, ship, 'fishing_boat').ok, true)
  assert.equal(buyFleet(world, ship, 'battleship').ok, true)
  assert.equal(buyFleet(world, ship, 'battleship').ok, true)
  assert.equal(buyFleet(world, ship, 'fishing_boat').ok, false, 'cuarto ligero rechazado')
  assert.equal(buyFleet(world, ship, 'man_of_war').ok, true)
  assert.equal(buyFleet(world, ship, 'man_of_war').ok, false)
})

test('hundir un jefe da la recompensa a quien le dio el último golpe y reaparece', () => {
  const world = createWorld('ffa', 20260919)
  const ship = createShip(world, 'p1', 'Test', 'p1', false)
  const boss = [...world.bosses.values()][0]
  const def = findBossDef(boss.archetype)
  const events: WorldEvent[] = []
  damageBoss(world, boss, def.hp + 10, ship.id, events)
  assert.equal(boss.alive, false)
  assert.equal(ship.coins, def.rewardCoins)
  assert.ok(events.some((e) => e.type === 'bossDeath'))
  world.timeMs += def.respawnMs + 10
  simulateTick(world, DT)
  assert.equal(boss.alive, true)
  assert.equal(boss.hp, def.hp)
})

test('morir reinicia todo; el humano espera a pedir reaparición', () => {
  const world = createWorld('ffa', 20260919)
  const victim = createShip(world, 'v', 'Víctima', 'v', false)
  const killer = createShip(world, 'k', 'Asesino', 'k', false)
  victim.coins = 500
  victim.score = 500
  victim.statLevels.hull = 3
  const events: WorldEvent[] = []
  killShip(world, victim, killer.id, events)
  assert.equal(victim.alive, false)
  assert.ok(killer.coins > 0)
  assert.equal(killer.kills, 1)
  world.timeMs += 5000
  simulateTick(world, DT)
  assert.equal(victim.alive, false, 'no reaparece sin pedirlo')
  victim.respawnRequested = true
  simulateTick(world, DT)
  assert.equal(victim.alive, true)
  assert.equal(victim.coins, 0)
  assert.equal(victim.statLevels.hull, 0)
})

test('TDM: sin fuego amigo entre compañeros', () => {
  const world = createWorld('tdm', 20260919)
  const a = createShip(world, 'a', 'A', 'a', false, 'red')
  const b = createShip(world, 'b', 'B', 'b', false, 'red')
  a.spawnProtectedUntil = 0
  b.spawnProtectedUntil = 0
  b.x = a.x + 60
  b.y = a.y
  a.angle = 0
  a.input.aimAngle = 0
  a.input.firing = true
  const hpBefore = b.hp
  for (let i = 0; i < 40; i++) simulateTick(world, DT)
  assert.equal(b.hp, hpBefore)
  assert.ok(
    [...world.bosses.values()].every((b) => b.archetype === 'fort'),
    'en TDM solo hay fuertes, no jefes del centro',
  )
})

test('disparar una moneda cuesta 10 y respeta el enfriamiento', () => {
  const world = createWorld('ffa', 20260919)
  const ship = createShip(world, 'p1', 'Test', 'p1', false)
  ship.coins = 100
  ship.input.fireCoin = true
  simulateTick(world, DT)
  simulateTick(world, DT)
  assert.equal(ship.coins, 90)
})

test('simulación larga con bots: sin NaN, sin entidades descontroladas', () => {
  const world = createWorld('ffa', 20260919)
  for (let i = 0; i < 16; i++) createShip(world, `bot${i}`, `Bot ${i}`, null, true)
  let deaths = 0
  for (let t = 0; t < 20 * 180; t++) {
    const events = simulateTick(world, DT)
    deaths += events.filter((e) => e.type === 'death').length
  }
  for (const s of world.ships.values()) {
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y), `posición finita ${s.name}`)
    assert.ok(Number.isFinite(s.hp), 'vida finita')
    assert.ok(Math.abs(s.x) <= world.mapSize / 2 && Math.abs(s.y) <= world.mapSize / 2, 'dentro del mapa')
  }
  assert.ok(world.bullets.size < 2000, `balas: ${world.bullets.size}`)
  assert.ok(world.coins.size > 100 && world.coins.size < 400, `monedas: ${world.coins.size}`)
  assert.ok(deaths > 0, 'los bots combaten entre sí')
  const leveled = [...world.ships.values()].filter((s) => Object.values(s.equip).length > 0).length
  assert.ok(leveled > 0, 'los bots eligen equipamiento')
})

test('palanqueta: el impacto ralentiza al objetivo', () => {
  const world = createWorld('ffa', 20260919)
  const a = createShip(world, 'a', 'A', 'a', false)
  const b = createShip(world, 'b', 'B', 'b', false)
  a.spawnProtectedUntil = 0
  b.spawnProtectedUntil = 0
  world.bosses.clear()
  world.whirlpools = []
  world.islands = []
  a.x = 0
  a.y = 1800
  a.angle = 0
  b.x = 0
  b.y = 1800 + 120
  a.equip.side = { branchId: 'chain_shot', tierId: 'chain_shot_1' }
  a.loadoutVersion++
  a.input.firing = true
  for (let i = 0; i < 20; i++) simulateTick(world, DT)
  assert.ok(slowFactor(b.fx, world.timeMs) < 1, 'b debería estar ralentizado')
})

test('fuego griego: el objetivo arde y recibe daño continuo', () => {
  const world = createWorld('ffa', 20260919)
  const a = createShip(world, 'a', 'A', 'a', false)
  const b = createShip(world, 'b', 'B', 'b', false)
  a.spawnProtectedUntil = 0
  b.spawnProtectedUntil = 0
  world.bosses.clear()
  world.whirlpools = []
  world.islands = []
  a.x = 0
  a.y = 1800
  a.angle = 0
  b.x = 90
  b.y = 1800
  a.equip.front = { branchId: 'greek_fire', tierId: 'greek_fire_1' }
  a.loadoutVersion++
  a.input.firing = true
  for (let i = 0; i < 6; i++) simulateTick(world, DT)
  a.input.firing = false
  const hpAfterHits = b.hp
  assert.ok(b.fx.burnUntil > world.timeMs, 'b debería estar ardiendo')
  b.x = 900 // se aleja del chorro: solo le afecta la quemadura
  for (let i = 0; i < 20; i++) simulateTick(world, DT)
  assert.ok(b.hp < hpAfterHits, 'la quemadura sigue dañando')
})

test('mortero: cae en la distancia apuntada y daña en área', () => {
  const world = createWorld('ffa', 20260919)
  const a = createShip(world, 'a', 'A', 'a', false)
  const b = createShip(world, 'b', 'B', 'b', false)
  a.spawnProtectedUntil = 0
  b.spawnProtectedUntil = 0
  world.bosses.clear()
  world.whirlpools = []
  world.islands = []
  world.islands.length = 0
  a.x = 0
  a.y = 1800
  a.angle = 0
  b.x = 300
  b.y = 1830
  a.equip.deck = { branchId: 'mortar', tierId: 'mortar_1' }
  a.loadoutVersion++
  a.input.aimAngle = 0
  a.input.aimDist = 300
  a.input.firing = true
  simulateTick(world, DT)
  a.input.firing = false
  const hp0 = b.hp
  let blast = false
  for (let i = 0; i < 40; i++) {
    const ev = simulateTick(world, DT)
    if (ev.some((e) => e.type === 'mortarBlast')) blast = true
  }
  assert.ok(blast, 'el mortero explota')
  assert.ok(b.hp < hp0, 'daño en área a 30 del impacto')
})

test('ralentización: se queda el efecto más fuerte', () => {
  const world = createWorld('ffa', 20260919)
  const s = createShip(world, 's', 'S', 's', false)
  applySlow(s.fx, 0, 0.6, 1000)
  applySlow(s.fx, 0, 0.8, 2000)
  assert.equal(slowFactor(s.fx, 500), 0.6)
})

test('remolino: arrastra hacia su centro', () => {
  const world = createWorld('ffa', 20260919)
  const w = world.whirlpools[0]
  assert.ok(w, 'hay remolinos')
  const s = createShip(world, 's', 'S', 's', false)
  s.x = w.x + w.radius * 0.6
  s.y = w.y
  const d0 = Math.hypot(s.x - w.x, s.y - w.y)
  for (let i = 0; i < 20; i++) simulateTick(world, DT)
  assert.ok(Math.hypot(s.x - w.x, s.y - w.y) < d0, 'se acerca al centro')
})

test('fuertes: aparecen en islas y dan recompensa al caer', () => {
  const world = createWorld('ffa', 20260919)
  const forts = [...world.bosses.values()].filter((b) => b.archetype === 'fort')
  assert.equal(forts.length, 5)
  const ship = createShip(world, 'p', 'P', 'p', false)
  const events: WorldEvent[] = []
  damageBoss(world, forts[0], 5000, ship.id, events)
  assert.equal(forts[0].alive, false)
  assert.equal(ship.coins, 450)
})
