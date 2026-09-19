import { Application, Graphics } from 'pixi.js'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'
import '@fontsource/pirata-one/latin-400.css'
import { RoomStateSchema } from '@doblonia/protocol'
import { createWorld, createShip, buyFleet, derived } from '@doblonia/sim'
import { BRANCHES_BY_SLOT, SLOT_ORDER, FLEET_SHIPS } from '@doblonia/content'
import { syncIslandsOnce, syncWorldToState } from '../../server/src/sync.js'
import { GameView } from '../src/render/GameView.js'

// Escena repetible, sin red ni simulación: 30 capitanes y sus 120 escoltas.
// Vite sirve esta página en desarrollo; no es una entrada del build público.
const app = new Application()
await app.init({
  resizeTo: window,
  backgroundColor: 0x05202e,
  antialias: true,
  resolution: Math.min(devicePixelRatio || 1, 2),
  autoDensity: true,
  autoStart: false,
  powerPreference: 'high-performance',
})
document.body.append(app.canvas)
await document.fonts.ready
const world = createWorld('ffa', 20260919)
for (let i = 0; i < 30; i++) {
  const ship = createShip(world, `bench-${i}`, `Capitán ${i + 1}`, `bench-${i}`, false)
  ship.coins = 100000
  ship.statLevels.hull = 15
  ship.equipLevel = 20
  for (const slot of SLOT_ORDER) {
    const branches = BRANCHES_BY_SLOT[slot]
    const branch = branches[i % branches.length]
    ship.equip[slot] = { branchId: branch.id, tierId: branch.tiers.at(-1)!.id }
  }
  ship.loadoutVersion++
  ship.hp = ship.maxHp = derived(ship).maxHp
  ship.spawnProtectedUntil = i % 3 === 0 ? 1e9 : 0
  ship.x = i === 0 ? 0 : Math.cos(i * 2.4) * (300 + i * 50)
  ship.y = i === 0 ? 0 : Math.sin(i * 2.4) * (300 + i * 50)
  for (const fleet of FLEET_SHIPS) buyFleet(world, ship, fleet.id)
}
const state = new RoomStateSchema()
syncIslandsOnce(world, state)
syncWorldToState(world, state)
const view = new GameView(app, { state }, 'bench-0')
app.stage.addChild(view.stage)
view.zoomOverride = 0.85
const positions = [...state.fleet.values()].map((f, i) => ({
  fleet: f,
  x: state.ships.get(f.ownerShipId)!.x + Math.cos(i * 1.3) * 120,
  y: state.ships.get(f.ownerShipId)!.y + Math.sin(i * 1.3) * 120,
}))
let clears = 0
const clear = Graphics.prototype.clear
Graphics.prototype.clear = function () {
  clears++
  return clear.call(this)
}
const frameTimes: number[] = []
const updateTimes: number[] = []
const submitTimes: number[] = []
let frame = 0
let last = 0
let measuredClears = 0
const warmup = 180
const samples = 1200
const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    mean: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(3)),
    p95: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(3)),
  }
}
declare global {
  interface Window {
    __graphicsResult?: ReturnType<typeof result>
  }
}
function result() {
  return {
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    captains: state.ships.size,
    escorts: state.fleet.size,
    frames: frameTimes.length,
    frameMs: stats(frameTimes),
    updateMs: stats(updateTimes),
    submitMs: stats(submitTimes),
    geometryClearsPerFrame: measuredClears / frameTimes.length,
    scope: 'Fixed scene, 180 warmup frames, 1200 measured frames; no HUD, network or simulation.',
  }
}
function animate(now: number) {
  const t = frame / 60
  state.timeMs = t * 1000
  for (const [i, { fleet, x, y }] of positions.entries()) {
    fleet.x = x + Math.cos(t + i) * 30
    fleet.y = y + Math.sin(t + i) * 30
    fleet.angle = t * 0.1 + i
  }
  const before = performance.now()
  clears = 0
  view.update(1 / 60)
  const updated = performance.now()
  app.renderer.render(app.stage)
  const submitted = performance.now()
  if (frame >= warmup) {
    frameTimes.push(now - last)
    updateTimes.push(updated - before)
    submitTimes.push(submitted - updated)
    measuredClears += clears
  }
  last = now
  frame++
  if (frame % 60 === 0)
    document.querySelector('output')!.textContent =
      `30 capitanes · 120 escoltas\n${Math.min(samples, Math.max(0, frame - warmup))}/${samples} fotogramas`
  if (frame < warmup + samples) requestAnimationFrame(animate)
  else {
    window.__graphicsResult = result()
    Graphics.prototype.clear = clear
    document.querySelector('output')!.textContent = JSON.stringify(window.__graphicsResult, null, 2)
  }
}
requestAnimationFrame(animate)
