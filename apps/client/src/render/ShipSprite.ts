import { Container, Graphics, Sprite } from 'pixi.js'
import { findTier, deckLayout, deckTurretAlong, hullMountOffset, type SlotId } from '@doblonia/content'
import {
  HULL_BEAM,
  HULL_LENGTH,
  flagTex,
  hullShadowTex,
  hullTex,
  mineRackTex,
  oarTex,
  ramTex,
  rudderTex,
  sailTex,
  sideCannonTex,
  turretTex,
  type HullPalette,
  type Tex,
} from './textures.js'

export type HullVariant = 'ship' | 'ironclad' | 'sleek' | 'boat'

export interface ShipLook {
  key: string
  radius: number
  palette: HullPalette
  sail: number
  emblem: number | null
  flag: number
  variant: HullVariant
  masts: number
}

export type EquipMap = Partial<Record<SlotId, { branchId: string; tierId: string }>>

export function makeSprite(t: Tex): Sprite {
  const s = new Sprite(t.texture)
  s.anchor.set(t.ax, t.ay)
  s.scale.set(t.scale)
  return s
}

interface Mount {
  sprite: Sprite
  baseX: number
  baseY: number
  dirX: number
  dirY: number
}

interface Oar {
  sprite: Sprite
  side: number
  phase: number
}

/**
 * Barco compuesto: todo lo que se ve del barco rota con el casco salvo las
 * torretas (siguen la mira) y la sombra (en su propia capa).
 */
export class ShipSprite {
  readonly root = new Container()
  readonly shadow: Sprite
  private body = new Container()
  private equipLayer = new Container()
  private deckEquipment = new Container()
  private sailLayer = new Container()
  private turretLayer = new Container()
  private hull: Sprite
  private flash: Sprite
  private shield = new Graphics()
  private shieldRim = new Graphics()
  private chains = new Graphics()
  private slowed = false
  private sails: Sprite[] = []
  private sailBase: number[] = []
  private flag: Sprite
  private turrets: Sprite[] = []
  private mounts: Mount[] = []
  private oars: Oar[] = []
  private rudder: Sprite | null = null
  private equipKey = ''
  private recoilT = 0
  private recoilDirty = false
  private flashT = 0
  private time = Math.random() * 10
  private hullScale = 1
  private sinkT = -1
  lastAngle = 0

  constructor(private look: ShipLook) {
    const r = look.radius
    this.shadow = makeSprite(hullShadowTex(r, look.variant))
    this.shadow.alpha = 0.32

    this.hull = makeSprite(hullTex(look.key, r, look.palette, look.variant))
    this.flash = makeSprite(hullTex(look.key, r, look.palette, look.variant))
    this.flash.tint = 0xffffff
    this.flash.blendMode = 'add'
    this.flash.alpha = 0

    this.body.addChild(this.equipLayer)
    this.body.addChild(this.hull)
    this.body.addChild(this.deckEquipment)
    this.body.addChild(this.flash)
    this.root.addChild(this.body)
    this.root.addChild(this.sailLayer)
    this.root.addChild(this.turretLayer)
    this.root.addChild(this.shield)
    this.root.addChild(this.shieldRim)
    this.root.addChild(this.chains)
    this.shield.circle(0, 0, r * 1.75).fill(0x6cf0ff)
    this.shieldRim.circle(0, 0, r * 1.75).stroke({ width: 2, color: 0x9ff6ff })
    this.shield.visible = this.shieldRim.visible = false

    const L = r * HULL_LENGTH
    const W = r * HULL_BEAM
    const positions = look.masts === 1 ? [0.06] : look.masts === 2 ? [0.2, -0.1] : [0.3, 0.06, -0.2]

    // Jarcia: obenques de cada mástil a las bordas y estays entre mástiles y bauprés
    const rig = new Graphics()
    for (const p of positions) {
      const mx = L * p
      for (const sgn of [-1, 1]) {
        for (const off of [-0.07, 0.05]) {
          rig.moveTo(mx, 0).lineTo(mx + L * off, sgn * W * 0.4)
        }
      }
    }
    for (let i = 0; i < positions.length; i++) {
      const from = L * positions[i]
      const to = i === 0 ? L * 0.58 : L * positions[i - 1]
      rig.moveTo(from, 0).lineTo(to, 0)
    }
    rig.stroke({ width: Math.max(0.5, r * 0.028), color: 0x2a1a0c, alpha: 0.55 })
    this.body.addChild(rig)

    positions.forEach((p, i) => {
      const span = W * (i === 0 && look.masts > 1 ? 1.05 : 1.3)
      const sail = makeSprite(
        sailTex(
          `${look.key}:${look.sail}:${i}`,
          span,
          look.sail,
          i === (look.masts > 1 ? 1 : 0) ? look.emblem : null,
        ),
      )
      sail.position.set(L * p, 0)
      sail.alpha = 0.96
      this.sails.push(sail)
      this.sailBase.push(sail.scale.x)
      this.sailLayer.addChild(sail)
    })
    this.flag = makeSprite(flagTex(look.flag))
    const mainMast = this.sails[look.masts > 1 ? 1 : 0]
    this.flag.position.set(mainMast.x, 0)
    this.flag.rotation = Math.PI
    this.sailLayer.addChild(this.flag)
  }

  get radius(): number {
    return this.look.radius * this.hullScale
  }

  setLoadout(equip: EquipMap, hitboxScale: number): void {
    const key = JSON.stringify(equip) + '|' + hitboxScale.toFixed(3)
    if (key === this.equipKey) return
    this.equipKey = key
    this.hullScale = hitboxScale
    this.root.scale.set(hitboxScale)
    this.shadow.scale.set(hullShadowTex(this.look.radius, this.look.variant).scale * hitboxScale)
    this.rebuildEquipment(equip)
  }

  private rebuildEquipment(equip: EquipMap): void {
    this.equipLayer.removeChildren().forEach((c) => c.destroy())
    this.deckEquipment.removeChildren().forEach((c) => c.destroy())
    this.turretLayer.removeChildren().forEach((c) => c.destroy())
    this.mounts = []
    this.oars = []
    this.turrets = []
    this.rudder = null
    const r = this.look.radius
    const L = r * HULL_LENGTH
    const W = r * HULL_BEAM

    const addMount = (
      tex: Tex,
      along: number,
      across: number,
      angle: number,
      layer: Container = this.equipLayer,
    ) => {
      const s = makeSprite(tex)
      s.position.set(along, across)
      s.rotation = angle
      layer.addChild(s)
      this.mounts.push({
        sprite: s,
        baseX: along,
        baseY: across,
        dirX: Math.cos(angle),
        dirY: Math.sin(angle),
      })
    }

    // Proa
    const front = equip.front && findTier('front', equip.front.branchId, equip.front.tierId)
    if (front?.effect.kind === 'cannon') {
      for (const arc of front.effect.arcsDeg) {
        const off = hullMountOffset('front', arc, r)
        addMount(
          sideCannonTex(r * 0.8, false),
          off.along - r * 0.35,
          off.across,
          (arc * Math.PI) / 180,
          this.deckEquipment,
        )
      }
    } else if (front?.effect.kind === 'ram') {
      const s = makeSprite(ramTex(r, front.tier))
      s.position.set(L * 0.44, 0)
      this.deckEquipment.addChild(s)
    }

    // Costados
    const side = equip.side && findTier('side', equip.side.branchId, equip.side.tierId)
    if (side?.effect.kind === 'cannon') {
      const flared = equip.side!.branchId === 'scatter'
      const seen = new Set<string>()
      for (const arc of side.effect.arcsDeg) {
        const off = hullMountOffset('side', arc, r)
        const k = `${Math.round(off.along)}:${Math.sign(off.across)}`
        if (seen.has(k)) continue
        seen.add(k)
        const sideSign = Math.sign(off.across)
        addMount(sideCannonTex(r, flared), off.along, sideSign * W * 0.36, (sideSign * Math.PI) / 2)
      }
    } else if (side?.effect.kind === 'oars') {
      const pairs = side.effect.pairs
      for (let i = 0; i < pairs; i++) {
        const along = pairs === 1 ? 0 : -L * 0.22 + (L * 0.4 * i) / (pairs - 1)
        for (const sgn of [-1, 1]) {
          const s = makeSprite(oarTex(r))
          s.position.set(along, sgn * W * 0.4)
          this.equipLayer.addChildAt(s, 0)
          this.oars.push({ sprite: s, side: sgn, phase: i * 0.6 })
        }
      }
    }

    // Popa
    const rear = equip.rear && findTier('rear', equip.rear.branchId, equip.rear.tierId)
    if (rear?.effect.kind === 'mine') {
      const s = makeSprite(mineRackTex(r, rear.tier >= 2))
      s.position.set(-L * 0.36, 0)
      this.deckEquipment.addChild(s)
    } else if (rear?.effect.kind === 'cannon') {
      for (const arc of rear.effect.arcsDeg) {
        const off = hullMountOffset('rear', arc, r)
        addMount(
          sideCannonTex(r * 0.9, false),
          -L * 0.42,
          off.across,
          (arc * Math.PI) / 180,
          this.deckEquipment,
        )
      }
    } else if (rear?.effect.kind === 'rudder') {
      const s = makeSprite(rudderTex(r))
      s.position.set(-L * 0.49, 0)
      s.rotation = Math.PI
      this.equipLayer.addChildAt(s, 0)
      this.rudder = s
    }

    // Cubierta: torretas por encima de las velas para que siempre se lean
    const deckTier = equip.deck?.tierId ?? 'starter'
    const layout = equip.deck ? deckLayout(deckTier) : { turrets: 1 }
    for (let i = 0; i < layout.turrets; i++) {
      const s = makeSprite(turretTex(deckTier, r))
      s.position.set(deckTurretAlong(i, layout.turrets, r), 0)
      this.turretLayer.addChild(s)
      this.turrets.push(s)
    }
  }

  /** Velas semitransparentes (miniaturas centradas en un arma). */
  ghostSails(alpha: number): void {
    this.sailLayer.alpha = alpha
  }

  recoil(): void {
    this.recoilT = 1
    this.recoilDirty = true
  }

  /** Aparejo roto por palanqueta: anillo de cadena alrededor del casco. */
  setSlowed(slowed: boolean): void {
    if (slowed === this.slowed) return
    this.slowed = slowed
    this.chains.clear()
    if (!slowed) return
    const R = this.look.radius * 1.55
    const links = 18
    for (let i = 0; i < links; i++) {
      const a = (i / links) * Math.PI * 2
      this.chains
        .ellipse(Math.cos(a) * R, Math.sin(a) * R, 3.2, 2)
        .stroke({ width: 1.4, color: 0x9fb3c2, alpha: 0.85 })
    }
  }

  hitFlash(): void {
    this.flashT = 1
  }

  startSinking(): void {
    if (this.sinkT < 0) this.sinkT = 0
  }

  get sinking(): boolean {
    return this.sinkT >= 0
  }

  get sinkDone(): boolean {
    return this.sinkT >= 1
  }

  resetSink(): void {
    this.sinkT = -1
    this.root.alpha = 1
    this.body.scale.set(1)
    this.shadow.alpha = 0.32
  }

  update(
    dt: number,
    s: {
      x: number
      y: number
      angle: number
      aim: number
      speed: number
      maxSpeed: number
      turnRate: number
      protectedFor: number
    },
    visible = true,
  ): void {
    this.time += dt
    this.recoilT = Math.max(0, this.recoilT - dt * 6)
    this.flashT = Math.max(0, this.flashT - dt * 7)
    if (this.sinkT >= 0) this.sinkT = Math.min(1, this.sinkT + dt / 1.6)
    // Los temporizadores avanzan fuera de cámara; las piezas se colocan al volver a entrar.
    if (!visible) return
    const shadowOff = 7 * this.hullScale
    this.root.position.set(s.x, s.y)
    this.shadow.position.set(s.x + shadowOff, s.y + shadowOff * 1.3)
    this.shadow.rotation = s.angle
    this.body.rotation = s.angle
    this.sailLayer.rotation = s.angle
    this.turretLayer.rotation = s.angle

    // Balanceo suave del casco (cabeceo)
    const bob = 1 + Math.sin(this.time * 1.7) * 0.012
    this.body.scale.set(bob, 1)

    const speedFrac = Math.max(0, Math.min(1, s.speed / Math.max(1, s.maxSpeed)))
    for (let i = 0; i < this.sails.length; i++) {
      const billow = 0.45 + 0.55 * speedFrac + Math.sin(this.time * 2.3 + i) * 0.04
      this.sails[i].scale.x = this.sailBase[i] * billow
    }
    this.flag.scale.y = this.flag.scale.x * (0.8 + Math.sin(this.time * 9) * 0.25)

    const localAim = s.aim - s.angle
    for (const t of this.turrets) t.rotation = localAim

    for (const o of this.oars) {
      const swing = Math.sin(this.time * (4 + speedFrac * 5) + o.phase) * (0.25 + speedFrac * 0.35)
      o.sprite.rotation = o.side * (Math.PI / 2 + swing * 0.9) + (o.side > 0 ? 0 : 0)
    }

    if (this.rudder) this.rudder.rotation = Math.PI - Math.max(-0.6, Math.min(0.6, s.turnRate * 0.35))

    if (this.recoilDirty) {
      const k = this.recoilT * 3
      for (const m of this.mounts) m.sprite.position.set(m.baseX - m.dirX * k, m.baseY - m.dirY * k)
      this.recoilDirty = this.recoilT > 0
    }

    this.flash.alpha = this.flashT * 0.55

    if (this.slowed) this.chains.rotation = this.time * 0.8
    this.shield.visible = this.shieldRim.visible = s.protectedFor > 0
    if (s.protectedFor > 0) {
      const pulse = 0.5 + Math.sin(this.time * 6) * 0.15
      const fade = Math.min(1, s.protectedFor / 800)
      this.shield.alpha = 0.07 * fade
      this.shieldRim.alpha = pulse * fade
    }

    if (this.sinkT >= 0) {
      const t = this.sinkT
      this.root.alpha = 1 - t
      this.shadow.alpha = 0.32 * (1 - t)
      this.body.scale.set(1 - t * 0.35)
      this.body.rotation = s.angle + t * 0.5
      this.sailLayer.rotation = s.angle + t * 0.7
    }
  }

  destroy(): void {
    this.shadow.destroy()
    this.root.destroy({ children: true })
  }
}
