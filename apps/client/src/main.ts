import { Application } from 'pixi.js'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'
import '@fontsource/pirata-one/latin-400.css'
import './style.css'
import type { Room } from '@colyseus/sdk'
import type { RoomStateSchema } from '@doblonia/protocol'
import type { WorldEvent } from '@doblonia/sim'
import { Connection, type Mode } from './net/Connection.js'
import { InputManager } from './input/InputManager.js'
import { GameView } from './render/GameView.js'
import { MenuScene } from './render/MenuScene.js'
import { Showroom } from './render/Showroom.js'
import { IslandShowroom } from './render/IslandShowroom.js'
import { Hud } from './ui/Hud.js'
import { Menu } from './ui/Menu.js'
import { sound } from './audio/Sound.js'
import { closeModal, isModalOpen } from './ui/Modals.js'

interface Session {
  view: GameView
  hud: Hud
  input: InputManager
  conn: Connection
  room: Room<RoomStateSchema>
}

declare global {
  interface Window {
    __doblonia?: Session
  }
}

async function main(): Promise<void> {
  const appRoot = document.getElementById('app')!
  const app = new Application()
  await app.init({
    resizeTo: window,
    backgroundColor: 0x05202e,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    powerPreference: 'high-performance',
  })
  appRoot.appendChild(app.canvas)
  // Solo desarrollo: en navegadores sin requestAnimationFrame (paneles ocultos, pruebas automáticas) el bucle va por temporizador.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('forcetick')) {
    app.ticker.stop()
    setInterval(() => app.ticker.update(performance.now()), 16)
  }
  // Cargar las fuentes antes de crear textos de Pixi evita que salgan con la fuente de sistema.
  await Promise.race([
    Promise.allSettled([
      ...[400, 500, 600, 700, 800].map((weight) => document.fonts.load(`${weight} 14px Inter`)),
      document.fonts.load('48px "Pirata One"'),
    ]),
    new Promise((r) => setTimeout(r, 1500)),
  ])

  let menuScene: MenuScene | null = null
  let menu: Menu | null = null
  let session: Session | null = null
  let joining = false

  const size = () => ({ w: app.screen.width, h: app.screen.height })

  const showMenu = (error?: string) => {
    menuScene = new MenuScene()
    const { w, h } = size()
    menuScene.resize(w, h)
    app.stage.addChild(menuScene.stage)
    menu = new Menu(startGame)
    document.body.appendChild(menu.root)
    if (error) menu.setError(error)
  }

  const releaseSession = () => {
    if (!session) return
    const current = session
    session = null
    closeModal()
    if (import.meta.env.DEV) window.__doblonia = undefined
    current.hud.destroy()
    current.input.destroy()
    current.view.destroy()
    return current.conn
  }

  const endSession = () => releaseSession()?.leave()

  async function startGame(mode: Mode, name: string, skin: string): Promise<void> {
    if (joining || session) return
    joining = true
    const conn = new Connection()
    let room: Room<RoomStateSchema>
    try {
      room = await conn.join(mode, name, skin)
    } catch (err) {
      console.error(err)
      conn.leave()
      menu?.setError('No hemos podido conectar. Comprueba tu conexión y vuelve a intentarlo.')
      return
    } finally {
      joining = false
    }
    menu?.destroy()
    menu = null
    if (menuScene) {
      app.stage.removeChild(menuScene.stage)
      menuScene.destroy()
      menuScene = null
    }
    attach(conn, room)
  }

  const attach = (conn: Connection, room: Room<RoomStateSchema>) => {
    const myId = room.sessionId
    const view = new GameView(app, room, myId)
    app.stage.addChild(view.stage)
    const input = new InputManager(app.canvas)
    const hud = new Hud(appRoot, room, myId, conn, view, input, () => {
      endSession()
      showMenu()
    })
    session = { view, hud, input, conn, room }
    if (import.meta.env.DEV) window.__doblonia = session

    room.onMessage('events', (events: WorldEvent[]) => {
      view.handleEvents(events)
      hud.handleEvents(events)
    })
    room.onLeave(async (code) => {
      if (session?.room !== room || conn.state === 'closed') return
      if (code === 4000) {
        endSession()
        showMenu('La partida ha terminado. Puedes volver a zarpar.')
        return
      }
      input.reset()
      input.enabled = false
      hud.toast('Conexión perdida. Recuperando tu partida…', 'bad', 18000)
      const again = await conn.reconnect()
      if (again && session?.room === room) {
        releaseSession()
        attach(conn, again)
        session?.hud.toast('Reconectado', '', 2000)
      } else if (session?.room === room) {
        endSession()
        showMenu('Se perdió la conexión con el servidor.')
      }
    })
  }

  window.addEventListener('resize', () => {
    const { w, h } = size()
    menuScene?.resize(w, h)
    session?.view.resize(w, h)
  })
  window.addEventListener('pointerdown', () => sound.unlock(), { once: false })
  // Al cerrar o recargar, salida limpia: si no, el barco quedaría 20 s en la partida esperando reconexión
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) session?.conn.leave()
  })

  let sendAcc = 0
  let lastErrorAt = 0
  app.ticker.add((ticker) => {
    try {
      frame(Math.min(0.05, ticker.deltaMS / 1000))
    } catch (err) {
      // Un fallo en un fotograma no debe congelar el juego; se registra (con límite) y se sigue.
      const now = performance.now()
      if (now - lastErrorAt > 2000) {
        lastErrorAt = now
        console.error('[doblonia] error en el fotograma', err)
      }
    }
  })

  function frame(dt: number): void {
    if (menuScene) {
      const sz = size()
      menuScene.update(dt, sz.w, sz.h)
    }
    if (!session) return
    const { view, hud, input, conn, room } = session
    view.mouseScreenX = input.mouseX
    view.mouseScreenY = input.mouseY
    const me = room.state?.ships.get(room.sessionId)
    const canControl = conn.state === 'connected' && !isModalOpen() && !document.hidden && !!me?.alive
    if (input.enabled && !canControl) input.reset()
    input.enabled = canControl
    const pos = view.myPosition()
    const mouse = view.mouseWorld()
    const aim = input.touchAim() ?? Math.atan2(mouse.y - pos.y, mouse.x - pos.x)
    const aimDist = input.touchAimDist() ?? Math.hypot(mouse.x - pos.x, mouse.y - pos.y)
    const inputFrame = input.sample(aim, me?.angle ?? 0, aimDist)
    view.setInput(inputFrame)
    // La entrada se envía antes de renderizar: si algo del render fallara, el barco sigue respondiendo.
    sendAcc += dt
    if (sendAcc >= 1 / 30 || inputFrame.fireCoin) {
      sendAcc = 0
      conn.sendInput(inputFrame, inputFrame.fireCoin)
    }
    view.update(dt)
    hud.update(dt)
  }

  if (import.meta.env.DEV && new URLSearchParams(location.search).has('showroom')) {
    const { w, h } = size()
    const room =
      new URLSearchParams(location.search).get('showroom') === 'islands'
        ? new IslandShowroom(w, h)
        : new Showroom(w, h)
    app.stage.addChild(room.stage)
    app.ticker.add((t) => {
      const sz = size()
      room.update(t.deltaMS / 1000, sz.w, sz.h)
    })
    return
  }
  showMenu()
}

main().catch((err) => {
  console.error('Fallo al iniciar Doblonia.io', err)
  const fallback = document.createElement('main')
  fallback.className = 'startup-error panel'
  fallback.innerHTML =
    '<h1>No hemos podido abrir el mar</h1><p>Prueba a recargar la página. Si continúa, comprueba que tu navegador está actualizado y tiene aceleración gráfica.</p><button class="btn-primary">Volver a intentarlo</button>'
  fallback.querySelector('button')!.addEventListener('click', () => location.reload())
  document.body.appendChild(fallback)
})
