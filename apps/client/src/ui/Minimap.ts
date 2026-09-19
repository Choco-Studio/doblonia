import type { Room } from '@colyseus/sdk'
import type { RoomStateSchema } from '@doblonia/protocol'
import { CENTER_RADIUS } from '@doblonia/sim'
import type { GameView } from '../render/GameView.js'

function power(statsJson: string): number {
  try {
    return Object.values(JSON.parse(statsJson) as Record<string, number>).reduce((a, b) => a + b, 0)
  } catch {
    return 0
  }
}

export class Minimap {
  private ctx: CanvasRenderingContext2D
  private size = 360
  private islandCache: HTMLCanvasElement | null = null
  private time = 0

  constructor(
    private canvas: HTMLCanvasElement,
    private room: Room<RoomStateSchema>,
    private myId: string,
    private view: GameView,
  ) {
    canvas.width = this.size
    canvas.height = this.size
    this.ctx = canvas.getContext('2d')!
  }

  private buildIslands(state: RoomStateSchema): void {
    if (this.islandCache || state.islands.length === 0) return
    const c = document.createElement('canvas')
    c.width = this.size
    c.height = this.size
    const ctx = c.getContext('2d')!
    const scale = this.size / state.mapSize
    ctx.fillStyle = 'rgba(233, 208, 150, 0.9)'
    for (const isl of state.islands) {
      let circles: { dx: number; dy: number; r: number }[]
      try {
        circles = JSON.parse(isl.circlesJson)
      } catch {
        circles = []
      }
      ctx.beginPath()
      for (const ci of circles) {
        const x = this.size / 2 + (isl.x + ci.dx) * scale
        const y = this.size / 2 + (isl.y + ci.dy) * scale
        ctx.moveTo(x + ci.r * scale, y)
        ctx.arc(x, y, Math.max(1.5, ci.r * scale), 0, Math.PI * 2)
      }
      ctx.fill()
    }
    this.islandCache = c
  }

  render(dt: number): void {
    this.time += dt
    const state = this.room.state
    const ctx = this.ctx
    const S = this.size
    ctx.clearRect(0, 0, S, S)
    if (!state) return
    this.buildIslands(state)

    const scale = S / state.mapSize
    const map = (x: number, y: number): [number, number] => [S / 2 + x * scale, S / 2 + y * scale]

    ctx.save()
    ctx.beginPath()
    ctx.roundRect(0, 0, S, S, 30)
    ctx.clip()

    const sea = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    sea.addColorStop(0, '#0d4a66')
    sea.addColorStop(1, '#052536')
    ctx.fillStyle = sea
    ctx.fillRect(0, 0, S, S)

    // retícula
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    for (let i = 1; i < 6; i++) {
      const p = (S / 6) * i
      ctx.beginPath()
      ctx.moveTo(p, 0)
      ctx.lineTo(p, S)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, p)
      ctx.lineTo(S, p)
      ctx.stroke()
    }

    if (state.mode === 'ffa') {
      ctx.fillStyle = 'rgba(255, 70, 60, 0.12)'
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, CENTER_RADIUS * scale, 0, Math.PI * 2)
      ctx.fill()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = 'rgba(255, 110, 90, 0.5)'
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, CENTER_RADIUS * scale, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      ctx.fillStyle = 'rgba(217, 67, 58, 0.12)'
      ctx.fillRect(0, 0, S * 0.15, S)
      ctx.fillStyle = 'rgba(47, 127, 217, 0.12)'
      ctx.fillRect(S * 0.85, 0, S * 0.15, S)
    }

    // Remolinos: espiral oscura
    state.whirlpools.forEach((w) => {
      const [x, y] = map(w.x, w.y)
      const r = Math.max(5, w.radius * scale)
      ctx.fillStyle = 'rgba(2, 14, 24, 0.55)'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(160, 225, 255, 0.55)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      for (let t = 0; t <= 1; t += 0.05) {
        const a = -this.time * 1.5 + t * 9
        const rr = r * (0.15 + t * 0.85)
        if (t === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
        else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      }
      ctx.stroke()
    })

    if (this.islandCache) ctx.drawImage(this.islandCache, 0, 0)

    // Cofres a la deriva: pequeño destello dorado
    state.coins.forEach((c) => {
      if (c.kind !== 'chest') return
      const [x, y] = map(c.x, c.y)
      const pulse = 0.5 + Math.sin(this.time * 5) * 0.5
      ctx.fillStyle = `rgba(255, 210, 74, ${0.25 + pulse * 0.25})`
      ctx.beginPath()
      ctx.arc(x, y, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#8a5a24'
      ctx.strokeStyle = '#ffd24a'
      ctx.lineWidth = 1.2
      ctx.fillRect(x - 3.5, y - 2.5, 7, 5)
      ctx.strokeRect(x - 3.5, y - 2.5, 7, 5)
    })

    // Esmeralda: zona aproximada, no posición exacta
    state.coins.forEach((c, id) => {
      if (c.kind !== 'emerald') return
      const hash = [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0)
      const ox = ((hash * 37) % 200) - 100
      const oy = ((hash * 91) % 200) - 100
      const [x, y] = map(c.x + ox, c.y + oy)
      const pulse = 0.5 + Math.sin(this.time * 3) * 0.5
      ctx.fillStyle = `rgba(46, 204, 113, ${0.18 + pulse * 0.12})`
      ctx.beginPath()
      ctx.arc(x, y, 24, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(120, 255, 170, 0.7)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })

    const me = state.ships.get(this.myId)
    const myPower = me ? power(me.statsJson) : 0

    // Flota propia
    state.fleet.forEach((f) => {
      if (f.ownerShipId !== this.myId) return
      const [x, y] = map(f.x, f.y)
      ctx.fillStyle = '#9fe0ff'
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    })

    // Barcos: aliados en TDM, y enemigos muy superiores (aviso de amenaza, como el original)
    state.ships.forEach((s, id) => {
      if (!s.alive || id === this.myId) return
      const [x, y] = map(s.x, s.y)
      if (state.mode === 'tdm' && me && s.team === me.team) {
        ctx.fillStyle = '#7ac8ff'
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fill()
      } else if (power(s.statsJson) - myPower >= 20) {
        ctx.fillStyle = '#ff5a4d'
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    // Fuertes: torre cuadrada (gris si está en ruinas)
    state.bosses.forEach((b) => {
      if (b.kind !== 'fort') return
      const [x, y] = map(b.homeX, b.homeY)
      ctx.fillStyle = b.alive ? (b.state === 'chase' ? '#ff7a4a' : '#d8cfb8') : 'rgba(160,160,160,0.35)'
      ctx.strokeStyle = '#1a120a'
      ctx.lineWidth = 1.5
      ctx.fillRect(x - 4.5, y - 4.5, 9, 9)
      ctx.strokeRect(x - 4.5, y - 4.5, 9, 9)
      if (b.alive) {
        ctx.fillStyle = '#1a120a'
        ctx.fillRect(x - 4.5, y - 6.5, 2.5, 2.5)
        ctx.fillRect(x + 2, y - 6.5, 2.5, 2.5)
      }
    })

    // Jefes
    state.bosses.forEach((b) => {
      if (b.kind === 'fort') return
      const [x, y] = b.alive ? map(b.x, b.y) : map(b.homeX, b.homeY)
      ctx.save()
      ctx.translate(x, y)
      ctx.fillStyle = b.alive ? (b.state === 'chase' ? '#ff4a3a' : '#e0c070') : 'rgba(200,200,200,0.35)'
      ctx.strokeStyle = '#1a0605'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, -1, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#1a0605'
      ctx.beginPath()
      ctx.arc(-2.5, -1.5, 1.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(2.5, -1.5, 1.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })

    // Área visible
    const cam = this.view.cameraInfo
    const vw = (innerWidth / cam.zoom) * scale
    const vh = (innerHeight / cam.zoom) * scale
    const [cx, cy] = map(cam.x, cam.y)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(cx - vw / 2, cy - vh / 2, vw, vh)

    // Yo
    if (me) {
      const pos = this.view.myPosition()
      const [x, y] = map(pos.x, pos.y)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(me.angle)
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#0a1a22'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(9, 0)
      ctx.lineTo(-6, -6)
      ctx.lineTo(-3, 0)
      ctx.lineTo(-6, 6)
      ctx.closePath()
      ctx.stroke()
      ctx.fill()
      ctx.restore()
    }

    ctx.restore()

    ctx.strokeStyle = 'rgba(242, 194, 78, 0.45)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(1.5, 1.5, S - 3, S - 3, 29)
    ctx.stroke()
  }
}
