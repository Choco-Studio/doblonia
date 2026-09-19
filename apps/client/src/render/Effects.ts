import { Container, Sprite, Text, TextStyle, type Texture } from 'pixi.js'
import { foamTex, glowTex, plankTex, ringTex, smokeTex, sparkTex, type Tex } from './textures.js'
import { settings } from '../settings.js'

interface Particle {
  s: Sprite
  vx: number
  vy: number
  life: number
  max: number
  s0: number
  s1: number
  a0: number
  a1: number
  spin: number
  drag: number
  active: boolean
}

class Pool {
  private items: Particle[] = []
  private free: Particle[] = []
  constructor(
    private layer: Container,
    private tex: Tex,
    private blend: 'normal' | 'add',
    private cap: number,
  ) {}

  spawn(
    x: number,
    y: number,
    o: {
      vx?: number
      vy?: number
      life: number
      s0: number
      s1: number
      a0?: number
      a1?: number
      tint?: number
      rot?: number
      spin?: number
      drag?: number
    },
  ): void {
    let p = this.free.pop()
    if (!p) {
      if (this.items.length >= this.cap) return
      const s = new Sprite(this.tex.texture as Texture)
      s.anchor.set(this.tex.ax, this.tex.ay)
      s.blendMode = this.blend
      this.layer.addChild(s)
      p = { s, vx: 0, vy: 0, life: 0, max: 1, s0: 1, s1: 1, a0: 1, a1: 0, spin: 0, drag: 0.9, active: true }
      this.items.push(p)
    }
    p.active = true
    p.s.visible = true
    p.s.position.set(x, y)
    p.s.tint = o.tint ?? 0xffffff
    p.s.rotation = o.rot ?? Math.random() * Math.PI * 2
    p.vx = o.vx ?? 0
    p.vy = o.vy ?? 0
    p.life = o.life
    p.max = o.life
    p.s0 = o.s0 * this.tex.scale
    p.s1 = o.s1 * this.tex.scale
    p.a0 = o.a0 ?? 1
    p.a1 = o.a1 ?? 0
    p.spin = o.spin ?? 0
    p.drag = o.drag ?? 0.9
    p.s.scale.set(p.s0)
    p.s.alpha = p.a0
  }

  update(dt: number): void {
    const dragPow = (d: number) => Math.pow(d, dt * 60)
    for (const p of this.items) {
      if (!p.active) continue
      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        p.s.visible = false
        this.free.push(p)
        continue
      }
      const t = 1 - p.life / p.max
      const e = 1 - (1 - t) * (1 - t)
      p.s.x += p.vx * dt
      p.s.y += p.vy * dt
      const k = dragPow(p.drag)
      p.vx *= k
      p.vy *= k
      p.s.rotation += p.spin * dt
      p.s.scale.set(p.s0 + (p.s1 - p.s0) * e)
      p.s.alpha = p.a0 + (p.a1 - p.a0) * t
    }
  }
}

const dmgStyle = new TextStyle({
  fontFamily: 'Inter',
  fontWeight: '800',
  fontSize: 20,
  fill: 0xffffff,
  stroke: { color: 0x1a0d02, width: 4 },
})

interface FloatText {
  t: Text
  vy: number
  life: number
  max: number
  active: boolean
}

export class Effects {
  readonly under = new Container()
  readonly over = new Container()
  readonly textLayer = new Container()
  private foam: Pool
  private ripples: Pool
  private smoke: Pool
  private glow: Pool
  private sparks: Pool
  private debris: Pool
  private texts: FloatText[] = []

  constructor() {
    this.foam = new Pool(this.under, foamTex(), 'normal', 1400)
    this.ripples = new Pool(this.under, ringTex(), 'normal', 120)
    this.debris = new Pool(this.over, plankTex(), 'normal', 220)
    this.smoke = new Pool(this.over, smokeTex(), 'normal', 500)
    this.glow = new Pool(this.over, glowTex(), 'add', 400)
    this.sparks = new Pool(this.over, sparkTex(), 'add', 400)
  }

  private get amount(): number {
    return settings.reduceEffects ? 0.4 : 1
  }

  wake(x: number, y: number, angle: number, speed: number, width: number): void {
    const side = Math.random() < 0.5 ? -1 : 1
    const px = -Math.sin(angle) * side
    const py = Math.cos(angle) * side
    const spread = speed * 0.35
    this.foam.spawn(x + px * width * 0.5, y + py * width * 0.5, {
      vx: px * spread - Math.cos(angle) * speed * 0.1,
      vy: py * spread - Math.sin(angle) * speed * 0.1,
      life: 1.4 + Math.random() * 0.6,
      s0: 0.35 + Math.random() * 0.2,
      s1: 1.2 + Math.random() * 0.5,
      a0: 0.45,
      a1: 0,
      drag: 0.96,
    })
  }

  bowWave(x: number, y: number, angle: number, speed: number): void {
    this.foam.spawn(x, y, {
      vx: Math.cos(angle) * speed * 0.2,
      vy: Math.sin(angle) * speed * 0.2,
      life: 0.5,
      s0: 0.5,
      s1: 1.1,
      a0: 0.55,
      a1: 0,
    })
  }

  muzzle(x: number, y: number, angle: number, size: number): void {
    const n = Math.max(1, Math.round(3 * this.amount))
    this.glow.spawn(x, y, { life: 0.12, s0: size * 0.5, s1: size * 0.9, a0: 0.95, a1: 0, tint: 0xffc56b })
    this.sparks.spawn(x + Math.cos(angle) * 4, y + Math.sin(angle) * 4, {
      life: 0.09,
      s0: size * 0.9,
      s1: size * 1.3,
      a0: 1,
      a1: 0,
      rot: angle,
      tint: 0xfff0b0,
    })
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * 0.6
      const v = 40 + Math.random() * 60
      this.smoke.spawn(x, y, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.9 + Math.random() * 0.6,
        s0: 0.25 * size,
        s1: 0.9 * size,
        a0: 0.55,
        a1: 0,
        tint: 0xd8d8d8,
        spin: (Math.random() - 0.5) * 2,
        drag: 0.93,
      })
    }
  }

  splash(x: number, y: number, big = false): void {
    this.ripples.spawn(x, y, { life: big ? 0.9 : 0.6, s0: 0.05, s1: big ? 0.55 : 0.28, a0: 0.7, a1: 0 })
    const n = Math.round((big ? 10 : 5) * this.amount)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = (big ? 80 : 45) * (0.5 + Math.random())
      this.foam.spawn(x, y, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.6,
        s0: 0.3,
        s1: big ? 0.9 : 0.6,
        a0: 0.8,
        a1: 0,
        drag: 0.9,
      })
    }
  }

  hit(x: number, y: number, strong: boolean): void {
    const n = Math.round((strong ? 10 : 6) * this.amount)
    this.glow.spawn(x, y, { life: 0.15, s0: 0.6, s1: 1.1, a0: 0.8, a1: 0, tint: 0xffb05a })
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 120 + Math.random() * 180
      this.sparks.spawn(x, y, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.25 + Math.random() * 0.2,
        s0: 0.5,
        s1: 0.2,
        a0: 1,
        a1: 0,
        rot: a,
        tint: 0xffd27a,
        drag: 0.88,
      })
    }
    for (let i = 0; i < Math.round((strong ? 4 : 2) * this.amount); i++) {
      const a = Math.random() * Math.PI * 2
      const v = 60 + Math.random() * 90
      this.debris.spawn(x, y, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.9,
        s0: 0.8 + Math.random() * 0.6,
        s1: 0.4,
        a0: 1,
        a1: 0,
        spin: (Math.random() - 0.5) * 12,
        drag: 0.92,
      })
    }
  }

  explosion(x: number, y: number, size: number): void {
    const k = this.amount
    this.glow.spawn(x, y, { life: 0.35, s0: size * 1.2, s1: size * 3, a0: 1, a1: 0, tint: 0xffa040 })
    this.glow.spawn(x, y, { life: 0.2, s0: size, s1: size * 1.8, a0: 1, a1: 0, tint: 0xffffff })
    this.ripples.spawn(x, y, { life: 1.1, s0: 0.1, s1: size * 0.9, a0: 0.8, a1: 0 })
    for (let i = 0; i < Math.round(18 * k); i++) {
      const a = Math.random() * Math.PI * 2
      const v = (90 + Math.random() * 220) * size * 0.6
      this.sparks.spawn(x, y, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.4 + Math.random() * 0.4,
        s0: 0.9,
        s1: 0.2,
        a0: 1,
        a1: 0,
        rot: a,
        tint: i % 2 ? 0xffc04d : 0xff7a2e,
        drag: 0.9,
      })
    }
    for (let i = 0; i < Math.round(14 * k); i++) {
      const a = Math.random() * Math.PI * 2
      const v = (30 + Math.random() * 80) * size * 0.5
      this.smoke.spawn(x, y, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1.6 + Math.random(),
        s0: 0.5 * size,
        s1: 1.8 * size,
        a0: 0.7,
        a1: 0,
        tint: i % 3 ? 0x3a3a3f : 0x6a6a6f,
        spin: (Math.random() - 0.5) * 1.5,
        drag: 0.95,
      })
    }
    for (let i = 0; i < Math.round(12 * k); i++) {
      const a = Math.random() * Math.PI * 2
      const v = (60 + Math.random() * 160) * size * 0.5
      this.debris.spawn(x, y, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1.6 + Math.random() * 0.8,
        s0: 1 + Math.random(),
        s1: 0.6,
        a0: 1,
        a1: 0,
        spin: (Math.random() - 0.5) * 10,
        drag: 0.94,
      })
    }
    this.splash(x, y, true)
  }

  mineBlast(x: number, y: number, radius: number): void {
    this.explosion(x, y, 1.1)
    this.ripples.spawn(x, y, { life: 0.7, s0: 0.1, s1: radius / 55, a0: 0.9, a1: 0, tint: 0xffe0b0 })
    for (let i = 0; i < Math.round(22 * this.amount); i++) {
      const a = Math.random() * Math.PI * 2
      const v = 60 + Math.random() * 140
      this.foam.spawn(x, y, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1,
        s0: 0.6,
        s1: 1.8,
        a0: 0.9,
        a1: 0,
        drag: 0.92,
      })
    }
  }

  /** Lengua de fuego con humo negro (fuego griego, aceite ardiendo, barcos en llamas). */
  flame(x: number, y: number, size = 1): void {
    // Base roja amplia + lengua amarilla que sube y se estrecha
    this.glow.spawn(x, y, {
      vx: (Math.random() - 0.5) * 10,
      vy: -8,
      life: 0.4,
      s0: 0.6 * size,
      s1: 0.3 * size,
      a0: 0.55,
      a1: 0,
      tint: 0xff4a14,
      drag: 0.95,
    })
    this.glow.spawn(x, y, {
      vx: (Math.random() - 0.5) * 24,
      vy: -24 - Math.random() * 30,
      life: 0.35 + Math.random() * 0.25,
      s0: 0.5 * size,
      s1: 0.1 * size,
      a0: 1,
      a1: 0,
      tint: Math.random() < 0.5 ? 0xff8a2a : 0xffd060,
      drag: 0.95,
    })
    if (Math.random() < 0.35) {
      this.sparks.spawn(x, y, {
        vx: (Math.random() - 0.5) * 40,
        vy: -40 - Math.random() * 40,
        life: 0.35,
        s0: 0.3,
        s1: 0.1,
        a0: 1,
        a1: 0,
        rot: -Math.PI / 2,
        tint: 0xffd27a,
        drag: 0.94,
      })
    }
    if (Math.random() < 0.45 * this.amount) {
      this.smoke.spawn(x, y, {
        vx: (Math.random() - 0.5) * 16,
        vy: -22 - Math.random() * 20,
        life: 1.1 + Math.random() * 0.6,
        s0: 0.18 * size,
        s1: 0.75 * size,
        a0: 0.5,
        a1: 0,
        tint: 0x26262a,
        spin: (Math.random() - 0.5) * 2,
        drag: 0.97,
      })
    }
  }

  /** Impacto de mortero: onda de choque amplia, columna de agua y metralla. */
  mortarBlast(x: number, y: number, radius: number): void {
    this.explosion(x, y, 1.3)
    this.ripples.spawn(x, y, { life: 0.55, s0: 0.1, s1: radius / 55, a0: 1, a1: 0, tint: 0xffc890 })
    this.ripples.spawn(x, y, { life: 1.2, s0: 0.2, s1: (radius / 55) * 1.5, a0: 0.5, a1: 0 })
    for (let i = 0; i < Math.round(26 * this.amount); i++) {
      const a = Math.random() * Math.PI * 2
      const v = 40 + Math.random() * radius * 2
      this.foam.spawn(x, y, {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1.1,
        s0: 0.7,
        s1: 2,
        a0: 0.9,
        a1: 0,
        drag: 0.9,
      })
    }
  }

  sparkle(x: number, y: number, color: number): void {
    this.glow.spawn(x, y, { life: 0.35, s0: 0.4, s1: 1, a0: 0.9, a1: 0, tint: color })
    for (let i = 0; i < Math.round(6 * this.amount); i++) {
      const a = Math.random() * Math.PI * 2
      this.sparks.spawn(x, y, {
        vx: Math.cos(a) * 90,
        vy: Math.sin(a) * 90,
        life: 0.35,
        s0: 0.4,
        s1: 0.1,
        a0: 1,
        a1: 0,
        rot: a,
        tint: color,
        drag: 0.86,
      })
    }
  }

  levelUp(x: number, y: number): void {
    this.ripples.spawn(x, y, { life: 0.9, s0: 0.2, s1: 1.4, a0: 1, a1: 0, tint: 0xf0c14b })
    this.ripples.spawn(x, y, { life: 1.2, s0: 0.1, s1: 1.9, a0: 0.6, a1: 0, tint: 0xfff0b0 })
    this.glow.spawn(x, y, { life: 0.6, s0: 1, s1: 3, a0: 0.6, a1: 0, tint: 0xf0c14b })
  }

  ringAt(x: number, y: number, color: number, size: number): void {
    this.ripples.spawn(x, y, { life: 0.8, s0: 0.1, s1: size, a0: 0.8, a1: 0, tint: color })
  }

  damageNumber(x: number, y: number, amount: number, color: number, big = false): void {
    if (!settings.damageNumbers) return
    let ft = this.texts.find((t) => !t.active)
    if (!ft) {
      if (this.texts.length > 60) return
      const t = new Text({ text: '', style: dmgStyle.clone() })
      t.anchor.set(0.5)
      this.textLayer.addChild(t)
      ft = { t, vy: 0, life: 0, max: 1, active: false }
      this.texts.push(ft)
    }
    ft.active = true
    ft.t.visible = true
    ft.t.text = String(Math.max(1, Math.round(amount)))
    ft.t.style.fill = color
    ft.t.style.fontSize = big ? 26 : 18
    ft.t.position.set(x + (Math.random() - 0.5) * 20, y - 10)
    ft.vy = -55
    ft.life = 0.9
    ft.max = 0.9
    ft.t.scale.set(1.4)
    ft.t.alpha = 1
  }

  update(dt: number, inverseZoom: number): void {
    this.foam.update(dt)
    this.ripples.update(dt)
    this.smoke.update(dt)
    this.glow.update(dt)
    this.sparks.update(dt)
    this.debris.update(dt)
    for (const ft of this.texts) {
      if (!ft.active) continue
      ft.life -= dt
      if (ft.life <= 0) {
        ft.active = false
        ft.t.visible = false
        continue
      }
      ft.t.y += ft.vy * dt
      ft.vy *= Math.pow(0.9, dt * 60)
      const t = 1 - ft.life / ft.max
      const pop = t < 0.15 ? 1.4 - (t / 0.15) * 0.4 : 1
      ft.t.scale.set(pop * inverseZoom)
      ft.t.alpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1
    }
  }
}
