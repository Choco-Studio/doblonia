import { Graphics } from 'pixi.js'

/** Conserva la geometría mientras la vida no cambia; posición y escala son independientes. */
export class HealthBar extends Graphics {
  private fraction = -1

  constructor(private kind: 'ship' | 'fleet' | 'fort' | 'boss') {
    super()
  }

  update(health: number): void {
    const fraction = Math.max(0, Math.min(1, health))
    if (fraction === this.fraction) return
    this.fraction = fraction
    this.clear()
    if (this.kind === 'fleet') {
      this.roundRect(-16, 0, 32, 4, 2).fill({ color: 0x04121a, alpha: 0.7 })
      if (fraction > 0) this.roundRect(-16, 0, 32 * fraction, 4, 2).fill({ color: 0x6cc7f0 })
      return
    }
    const ship = this.kind === 'ship'
    const w = ship ? 56 : this.kind === 'fort' ? 80 : 110
    const h = ship ? 6 : 7
    const pad = ship ? 1.5 : 2
    const color = ship
      ? fraction > 0.5
        ? 0x5fd98a
        : fraction > 0.25
          ? 0xf0c14b
          : 0xff5a4d
      : this.kind === 'fort'
        ? 0xd08a3a
        : 0xe0413a
    this.roundRect(-w / 2 - pad, -pad, w + pad * 2, h + pad * 2, ship ? 4 : 5).fill({
      color: ship ? 0x04121a : 0x1a0505,
      alpha: ship ? 0.75 : 0.85,
    })
    if (fraction > 0) {
      this.roundRect(-w / 2, 0, w * fraction, h, 3).fill({ color })
      this.roundRect(-w / 2, 0, w * fraction, 3, 2).fill({ color: 0xffffff, alpha: ship ? 0.18 : 0.2 })
    }
  }
}
