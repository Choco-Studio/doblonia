import { Container, Sprite } from 'pixi.js'
import { makeSprite } from './ShipSprite.js'
import { flagPoleTex, fortTex, turretTex } from './textures.js'

/**
 * Fuerte de isla: fortaleza en estrella con una torreta doble en la torre central
 * que sigue a su objetivo. Al caer queda en ruinas (textura propia) hasta reconstruirse.
 */
export class FortSprite {
  readonly root = new Container()
  readonly shadow: Sprite
  private base: Sprite
  private ruins: Sprite
  private flash: Sprite
  private turret: Sprite
  private flag: Sprite
  private flashT = 0
  private recoilT = 0
  private sinkT = -1
  private time = Math.random() * 10
  lastAngle = 0

  constructor(private r: number) {
    this.shadow = new Sprite()
    this.base = makeSprite(fortTex(false))
    this.ruins = makeSprite(fortTex(true))
    this.ruins.alpha = 0
    this.flash = makeSprite(fortTex(false))
    this.flash.blendMode = 'add'
    this.flash.alpha = 0
    this.turret = makeSprite(turretTex('big_cannon_x', 30))
    this.flag = makeSprite(flagPoleTex(0x1c1c22))
    this.flag.position.set(-4, -38)
    this.root.addChild(this.base, this.ruins, this.flash, this.turret, this.flag)
  }

  get radius(): number {
    return this.r
  }

  recoil(): void {
    this.recoilT = 1
  }

  hitFlash(): void {
    this.flashT = 1
  }

  startSinking(): void {
    if (this.sinkT < 0) this.sinkT = 0
  }

  get sinkDone(): boolean {
    return this.sinkT >= 1
  }

  resetSink(): void {
    this.sinkT = -1
    this.base.alpha = 1
    this.ruins.alpha = 0
  }

  setSlowed(): void {}

  update(dt: number, s: { x: number; y: number; aim: number }): void {
    this.time += dt
    this.root.position.set(s.x, s.y)
    const back = this.recoilT * 4
    this.turret.rotation = s.aim
    this.turret.position.set(-Math.cos(s.aim) * back, -Math.sin(s.aim) * back)
    this.recoilT = Math.max(0, this.recoilT - dt * 5)
    this.flag.scale.y = this.flag.scale.x * (0.85 + Math.sin(this.time * 7) * 0.15)
    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt * 7)
      this.flash.alpha = this.flashT * 0.35
    }
    if (this.sinkT >= 0) {
      // Derrumbe: la muralla intacta se funde con las ruinas y la torreta desaparece
      this.sinkT = Math.min(1, this.sinkT + dt / 1.2)
      this.ruins.alpha = this.sinkT
      this.base.alpha = 1 - this.sinkT
      this.turret.alpha = 1 - this.sinkT
      this.flag.alpha = 1 - this.sinkT
    } else {
      this.turret.alpha = 1
      this.flag.alpha = 1
    }
  }

  destroy(): void {
    this.shadow.destroy()
    this.root.destroy({ children: true })
  }
}
