import { Container, Graphics } from 'pixi.js'

/** Anillos persistentes: el pulso usa alfa y tinte, y el giro usa la transformación. */
export class BossAura extends Container {
  private ring = new Graphics()
  private disc = new Graphics()

  constructor(
    private fort: boolean,
    radius: number,
  ) {
    super()
    if (fort) {
      for (let i = 0; i < 48; i += 2) {
        const angle = (i / 48) * Math.PI * 2
        this.ring.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
        this.ring.arc(0, 0, radius, angle, angle + Math.PI / 48)
      }
      this.ring.stroke({ width: 3, color: 0xffffff })
    } else {
      this.disc.circle(0, 0, radius).fill(0xffffff)
      this.ring.circle(0, 0, radius).stroke({ width: 2, color: 0xffffff })
    }
    this.addChild(this.disc, this.ring)
  }

  update(x: number, y: number, time: number, alive: boolean, chasing: boolean): void {
    this.visible = alive
    if (!alive) return
    this.position.set(x, y)
    const pulse = 0.5 + Math.sin(time * 4) * 0.5
    this.ring.tint = chasing ? 0xff5a4d : 0xf0c14b
    if (this.fort) {
      this.rotation = time * 0.05
      this.ring.alpha = chasing ? 0.22 + pulse * 0.18 : 0.12
    } else {
      this.disc.tint = chasing ? 0xff3b30 : 0xf0c14b
      this.disc.alpha = chasing ? 0.08 + pulse * 0.06 : 0.04
      this.ring.alpha = chasing ? 0.35 + pulse * 0.3 : 0.2
    }
  }
}
