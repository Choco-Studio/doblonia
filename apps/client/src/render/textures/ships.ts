import { SkinDef, DeckLayout, deckLayout, deckBarrelLength } from '@doblonia/content'
import { shade, Tex, cached, worldTex, hex, mulberry32, softShadow } from './shared.js'

// ---------------------------------------------------------------------------
// Barcos
// ---------------------------------------------------------------------------

export const HULL_LENGTH = 2.9

// × radio
export const HULL_BEAM = 1.5

// × radio

function hullPath(ctx: CanvasRenderingContext2D, L: number, W: number, sx = 1, sy = 1): void {
  const bow = (L / 2) * sx
  const stern = (-L / 2) * sx
  const hw = (W / 2) * sy
  ctx.beginPath()
  ctx.moveTo(bow, 0)
  ctx.bezierCurveTo(L * 0.28 * sx, -hw * 1.02, -L * 0.12 * sx, -hw * 1.06, stern + L * 0.07 * sx, -hw * 0.86)
  ctx.quadraticCurveTo(stern, -hw * 0.78, stern, -hw * 0.42)
  ctx.lineTo(stern, hw * 0.42)
  ctx.quadraticCurveTo(stern, hw * 0.78, stern + L * 0.07 * sx, hw * 0.86)
  ctx.bezierCurveTo(-L * 0.12 * sx, hw * 1.06, L * 0.28 * sx, hw * 1.02, bow, 0)
  ctx.closePath()
}

export interface HullPalette {
  hull: number
  hullDark: number
  deck: number
  trim: number
}

export function paletteFromSkin(skin: SkinDef, teamColor?: number): HullPalette {
  if (teamColor !== undefined) {
    return {
      hull: shade(teamColor, -0.25),
      hullDark: shade(teamColor, -0.6),
      deck: skin.deck,
      trim: shade(teamColor, 0.35),
    }
  }
  return { hull: skin.hull, hullDark: skin.hullDark, deck: skin.deck, trim: skin.trim }
}

/** Casco visto desde arriba, apuntando a +x. Tamaño en unidades de mundo para radio `r`. */
export function hullTex(
  key: string,
  r: number,
  p: HullPalette,
  variant: 'ship' | 'ironclad' | 'sleek' | 'boat' = 'ship',
): Tex {
  return cached(`hull:${key}:${r}:${variant}`, () => {
    const L = r * HULL_LENGTH * (variant === 'sleek' ? 1.08 : 1)
    const W = r * HULL_BEAM * (variant === 'sleek' ? 0.82 : variant === 'ironclad' ? 1.12 : 1)
    const w = L * 1.25
    const h = W * 1.3
    return worldTex(w, h, w * 0.5, h / 2, (ctx) => {
      // Bauprés
      ctx.strokeStyle = hex(shade(p.hullDark, -0.2))
      ctx.lineWidth = Math.max(1.5, r * 0.08)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(L * 0.42, 0)
      ctx.lineTo(L * 0.6, 0)
      ctx.stroke()

      // Casco exterior
      hullPath(ctx, L, W)
      ctx.fillStyle = hex(p.hullDark)
      ctx.fill()
      ctx.lineWidth = Math.max(1.2, r * 0.07)
      ctx.strokeStyle = hex(shade(p.hullDark, -0.45))
      ctx.stroke()

      // Tablazón del costado
      ctx.save()
      hullPath(ctx, L, W)
      ctx.clip()
      const side = ctx.createLinearGradient(0, -W / 2, 0, W / 2)
      side.addColorStop(0, hex(shade(p.hull, 0.18)))
      side.addColorStop(0.5, hex(p.hull))
      side.addColorStop(1, hex(shade(p.hull, -0.28)))
      ctx.fillStyle = side
      ctx.fillRect(-L, -W, L * 2, W * 2)
      ctx.strokeStyle = hex(shade(p.hull, -0.4), 0.45)
      ctx.lineWidth = 0.6
      for (let y = -W / 2; y < W / 2; y += Math.max(2.2, r * 0.12)) {
        ctx.beginPath()
        ctx.moveTo(-L, y)
        ctx.lineTo(L, y)
        ctx.stroke()
      }
      if (variant === 'ironclad') {
        ctx.fillStyle = 'rgba(20,24,30,0.35)'
        for (let x = -L / 2; x < L / 2; x += r * 0.45) ctx.fillRect(x, -W, 1.2, W * 2)
        ctx.fillStyle = 'rgba(220,225,230,0.5)'
        for (let x = -L / 2 + 3; x < L / 2; x += r * 0.22) {
          ctx.beginPath()
          ctx.arc(x, -W * 0.4, 0.9, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(x, W * 0.4, 0.9, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()

      // Portillas de cañón en la tablazón (a ambos costados)
      if (variant !== 'boat') {
        const ports = Math.max(3, Math.round(L / (r * 0.55)))
        for (let i = 0; i < ports; i++) {
          const x = -L * 0.34 + (L * 0.64 * i) / Math.max(1, ports - 1)
          const t = 1 - Math.min(1, Math.abs(x) / (L * 0.5))
          const edge = (W / 2) * (0.84 + 0.1 * t)
          for (const sgn of [-1, 1]) {
            ctx.fillStyle = hex(shade(p.hullDark, -0.55), 0.9)
            ctx.fillRect(x - r * 0.07, sgn * edge - r * 0.04 - (sgn > 0 ? r * 0.06 : 0), r * 0.14, r * 0.1)
            ctx.fillStyle = hex(p.trim, 0.55)
            ctx.fillRect(x - r * 0.08, sgn * edge - r * 0.05 - (sgn > 0 ? r * 0.06 : 0), r * 0.16, r * 0.02)
          }
        }
      }

      // Regala (borde superior)
      hullPath(ctx, L, W, 0.95, 0.84)
      ctx.lineWidth = Math.max(1, r * 0.075)
      ctx.strokeStyle = hex(p.trim, 0.9)
      ctx.stroke()

      // Cubierta
      hullPath(ctx, L, W, 0.9, 0.74)
      ctx.fillStyle = hex(p.deck)
      ctx.fill()
      ctx.save()
      hullPath(ctx, L, W, 0.9, 0.74)
      ctx.clip()
      ctx.strokeStyle = hex(shade(p.deck, -0.35), 0.4)
      ctx.lineWidth = 0.6
      for (let y = -W / 2; y < W / 2; y += Math.max(1.8, r * 0.1)) {
        ctx.beginPath()
        ctx.moveTo(-L, y)
        ctx.lineTo(L, y)
        ctx.stroke()
      }
      const rnd = mulberry32(key.length * 97 + r)
      ctx.strokeStyle = hex(shade(p.deck, -0.45), 0.35)
      for (let i = 0; i < 26; i++) {
        const x = (rnd() - 0.5) * L
        const y = (rnd() - 0.5) * W
        ctx.beginPath()
        ctx.moveTo(x, y - 0.9)
        ctx.lineTo(x, y + 0.9)
        ctx.stroke()
      }
      // Sombreado de la cubierta (luz desde arriba-izquierda)
      const lightG = ctx.createLinearGradient(0, -W / 2, 0, W / 2)
      lightG.addColorStop(0, 'rgba(255,255,255,0.18)')
      lightG.addColorStop(1, 'rgba(0,0,0,0.22)')
      ctx.fillStyle = lightG
      ctx.fillRect(-L, -W, L * 2, W * 2)
      ctx.restore()

      // Castillo de popa
      const cx0 = -L * 0.45
      const cx1 = -L * 0.2
      ctx.fillStyle = hex(shade(p.hull, -0.1))
      ctx.strokeStyle = hex(shade(p.hullDark, -0.3))
      ctx.lineWidth = 0.9
      const cw = W * 0.34
      ctx.beginPath()
      ctx.moveTo(cx0, -cw)
      ctx.lineTo(cx1, -cw * 0.95)
      ctx.lineTo(cx1, cw * 0.95)
      ctx.lineTo(cx0, cw)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = hex(p.trim, 0.8)
      ctx.lineWidth = 0.8
      ctx.strokeRect(cx0 + 1.5, -cw + 1.5, cx1 - cx0 - 3, cw * 2 - 3)
      // Escotilla central
      ctx.fillStyle = hex(shade(p.deck, -0.5))
      ctx.fillRect(-r * 0.2, -r * 0.14, r * 0.3, r * 0.28)
      ctx.strokeStyle = hex(shade(p.deck, 0.2), 0.6)
      ctx.lineWidth = 0.5
      for (let i = 1; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(-r * 0.2 + (r * 0.3 * i) / 3, -r * 0.14)
        ctx.lineTo(-r * 0.2 + (r * 0.3 * i) / 3, r * 0.14)
        ctx.stroke()
      }
      // Postes de la barandilla sobre la regala
      ctx.fillStyle = hex(shade(p.trim, -0.35), 0.9)
      const posts = Math.round(L / (r * 0.3))
      for (let i = 1; i < posts; i++) {
        const x = -L / 2 + (L * i) / posts
        const t = 1 - Math.min(1, Math.abs(x + L * 0.05) / (L * 0.52))
        const edge = (W / 2) * 0.84 * (0.6 + 0.4 * Math.sqrt(Math.max(0, t)))
        if (x > L * 0.4) continue
        ctx.fillRect(x - 0.45, -edge - 0.45, 0.9, 0.9)
        ctx.fillRect(x - 0.45, edge - 0.45, 0.9, 0.9)
      }
      // Rueda del timón en el castillo de popa
      const wx = -L * 0.3
      ctx.strokeStyle = hex(shade(p.hullDark, -0.2))
      ctx.lineWidth = Math.max(0.8, r * 0.045)
      ctx.beginPath()
      ctx.arc(wx, 0, r * 0.12, 0, Math.PI * 2)
      ctx.stroke()
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI
        ctx.beginPath()
        ctx.moveTo(wx + Math.cos(a) * r * 0.17, Math.sin(a) * r * 0.17)
        ctx.lineTo(wx - Math.cos(a) * r * 0.17, -Math.sin(a) * r * 0.17)
        ctx.stroke()
      }
      // Ventanales de popa (brillo cálido)
      ctx.fillStyle = 'rgba(255, 214, 120, 0.85)'
      for (const y of [-cw * 0.55, -cw * 0.18, cw * 0.18, cw * 0.55])
        ctx.fillRect(-L * 0.492, y - r * 0.05, r * 0.05, r * 0.1)
      // Faroles de popa
      for (const sgn of [-1, 1]) {
        const lx = -L * 0.47
        const ly = sgn * W * 0.3
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.22)
        g.addColorStop(0, 'rgba(255,230,150,0.95)')
        g.addColorStop(0.3, 'rgba(255,190,80,0.45)')
        g.addColorStop(1, 'rgba(255,170,60,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(lx, ly, r * 0.22, 0, Math.PI * 2)
        ctx.fill()
      }
      // Mascarón de proa
      ctx.fillStyle = hex(p.trim)
      ctx.beginPath()
      ctx.arc(L * 0.44, 0, Math.max(1.2, r * 0.07), 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = hex(shade(p.trim, -0.5))
      ctx.lineWidth = 0.6
      ctx.stroke()
    })
  })
}

export function hullShadowTex(r: number, variant: 'ship' | 'ironclad' | 'sleek' | 'boat' = 'ship'): Tex {
  return cached(`hullShadow:${r}:${variant}`, () => {
    const L = r * HULL_LENGTH * (variant === 'sleek' ? 1.08 : 1)
    const W = r * HULL_BEAM * (variant === 'sleek' ? 0.82 : variant === 'ironclad' ? 1.12 : 1)
    return softShadow(L * 1.2, W * 1.2, L * 0.6, W * 0.6, (ctx) => hullPath(ctx, L, W), r * 0.35)
  })
}

/** Vela cuadrada vista desde arriba: una media luna hinchada hacia proa con su verga. */
export function sailTex(key: string, span: number, color: number, emblem: number | null): Tex {
  return cached(`sail:${key}:${span}`, () => {
    const depth = span * 0.3
    const w = depth * 2.4 + 16
    const h = span + 16
    return worldTex(w, h, w / 2 - depth * 0.4, h / 2, (ctx) => {
      const belly = (dx: number, dy: number) => {
        ctx.beginPath()
        ctx.moveTo(dx, -span / 2 + dy)
        ctx.quadraticCurveTo(depth * 2 + dx, dy, dx, span / 2 + dy)
        ctx.quadraticCurveTo(depth * 0.15 + dx, dy, dx, -span / 2 + dy)
      }
      // Sombra proyectada sobre la cubierta: la vela se lee como algo elevado
      belly(3.5, 4.5)
      ctx.fillStyle = 'rgba(10,12,16,0.38)'
      ctx.fill()
      const g = ctx.createLinearGradient(0, 0, depth * 1.05, 0)
      g.addColorStop(0, hex(shade(color, -0.32)))
      g.addColorStop(0.55, hex(color))
      g.addColorStop(1, hex(shade(color, 0.2)))
      belly(0, 0)
      ctx.fillStyle = g
      ctx.fill()
      ctx.strokeStyle = hex(shade(color, -0.55), 0.85)
      ctx.lineWidth = 0.9
      ctx.stroke()
      // Costuras de los paños
      ctx.strokeStyle = hex(shade(color, -0.4), 0.55)
      ctx.lineWidth = 0.6
      for (let i = 1; i < 5; i++) {
        const t = i / 5
        ctx.beginPath()
        ctx.moveTo(0, -span / 2 + span * t)
        ctx.lineTo(depth * 0.98 * 4 * t * (1 - t), -span / 2 + span * t)
        ctx.stroke()
      }
      if (emblem !== null) {
        ctx.fillStyle = hex(emblem, 0.9)
        ctx.beginPath()
        ctx.arc(depth * 0.55, 0, span * 0.12, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = hex(shade(emblem, -0.5), 0.8)
        ctx.lineWidth = 0.7
        ctx.stroke()
      }
      // Verga y cofa
      ctx.strokeStyle = '#3d2412'
      ctx.lineWidth = Math.max(1.8, span * 0.055)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-0.5, -span / 2 - 4)
      ctx.lineTo(-0.5, span / 2 + 4)
      ctx.stroke()
      ctx.fillStyle = '#2a170a'
      ctx.beginPath()
      ctx.arc(-0.5, 0, Math.max(2, span * 0.065), 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.beginPath()
      ctx.arc(-1.2, -0.8, Math.max(0.8, span * 0.025), 0, Math.PI * 2)
      ctx.fill()
    })
  })
}

export function flagTex(color: number): Tex {
  return cached(`flag:${color}`, () =>
    worldTex(
      20,
      10,
      1,
      5,
      (ctx) => {
        ctx.fillStyle = hex(color)
        ctx.beginPath()
        ctx.moveTo(0, -3.5)
        ctx.quadraticCurveTo(9, -5, 18, 0)
        ctx.quadraticCurveTo(9, 5, 0, 3.5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.25)'
        ctx.fillRect(0, 0, 18, 3.5)
      },
      3,
    ),
  )
}

/** Cañón lateral sobre cureña, apuntando a +x. */
export function sideCannonTex(r: number, flared: boolean): Tex {
  return cached(`sideCannon:${r}:${flared}`, () => {
    const len = r * 0.55
    const wid = r * 0.2
    return worldTex(
      len + 8,
      wid * 2 + 6,
      4,
      wid + 3,
      (ctx) => {
        ctx.fillStyle = '#5a3a1e'
        ctx.fillRect(-2, -wid * 0.9, len * 0.45, wid * 1.8)
        const g = ctx.createLinearGradient(0, -wid / 2, 0, wid / 2)
        g.addColorStop(0, '#6d717a')
        g.addColorStop(0.5, '#2b2d32')
        g.addColorStop(1, '#141518')
        ctx.fillStyle = g
        ctx.beginPath()
        if (flared) {
          ctx.moveTo(0, -wid * 0.4)
          ctx.lineTo(len, -wid * 0.7)
          ctx.lineTo(len, wid * 0.7)
          ctx.lineTo(0, wid * 0.4)
        } else {
          ctx.moveTo(0, -wid * 0.5)
          ctx.lineTo(len, -wid * 0.38)
          ctx.lineTo(len, wid * 0.38)
          ctx.lineTo(0, wid * 0.5)
        }
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#101113'
        ctx.fillRect(len - 1.4, -wid * (flared ? 0.62 : 0.34), 1.4, wid * (flared ? 1.24 : 0.68))
      },
      3,
    )
  })
}

export function oarTex(r: number): Tex {
  return cached(`oar:${r}`, () => {
    const len = r * 0.95
    return worldTex(
      len + 4,
      10,
      1,
      5,
      (ctx) => {
        ctx.strokeStyle = '#4a2f18'
        ctx.lineWidth = 2.6
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(len * 0.7, 0)
        ctx.stroke()
        ctx.strokeStyle = '#9b6b3e'
        ctx.lineWidth = 1.4
        ctx.stroke()
        const g = ctx.createLinearGradient(len * 0.65, 0, len, 0)
        g.addColorStop(0, '#8a5a30')
        g.addColorStop(1, '#c08a55')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.moveTo(len * 0.66, -1.2)
        ctx.quadraticCurveTo(len * 0.8, -3.6, len, -2.6)
        ctx.quadraticCurveTo(len * 1.03, 0, len, 2.6)
        ctx.quadraticCurveTo(len * 0.8, 3.6, len * 0.66, 1.2)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#3d2412'
        ctx.lineWidth = 0.7
        ctx.stroke()
      },
      3,
    )
  })
}

export function ramTex(r: number, tier: number): Tex {
  return cached(`ram:${r}:${tier}`, () => {
    const len = r * (0.35 + tier * 0.12)
    const wid = r * (0.42 + tier * 0.06)
    return worldTex(
      len + 6,
      wid + 6,
      2,
      wid / 2 + 3,
      (ctx) => {
        const g = ctx.createLinearGradient(0, -wid / 2, 0, wid / 2)
        g.addColorStop(0, '#c9ced6')
        g.addColorStop(0.45, '#7a808a')
        g.addColorStop(1, '#33363c')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.moveTo(0, -wid / 2)
        ctx.lineTo(len, 0)
        ctx.lineTo(0, wid / 2)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#1d1f23'
        ctx.lineWidth = 0.9
        ctx.stroke()
        ctx.fillStyle = '#e6e9ee'
        for (let i = 0; i < 2 + tier; i++) {
          const t = (i + 0.5) / (2 + tier)
          ctx.beginPath()
          ctx.arc(len * t * 0.7, 0, 0.9, 0, Math.PI * 2)
          ctx.fill()
        }
        if (tier >= 3) {
          ctx.fillStyle = '#9aa0aa'
          for (const s of [-1, 1]) {
            ctx.beginPath()
            ctx.moveTo(len * 0.3, s * wid * 0.25)
            ctx.lineTo(len * 0.55, s * wid * 0.55)
            ctx.lineTo(len * 0.5, s * wid * 0.15)
            ctx.closePath()
            ctx.fill()
          }
        }
      },
      3,
    )
  })
}

export function rudderTex(r: number): Tex {
  return cached(`rudder:${r}`, () =>
    worldTex(
      r * 0.8,
      r * 0.3,
      r * 0.05,
      r * 0.15,
      (ctx) => {
        ctx.fillStyle = '#5c3a1c'
        ctx.beginPath()
        ctx.moveTo(0, -r * 0.06)
        ctx.lineTo(-r * 0.0, -r * 0.06)
        ctx.lineTo(r * 0.55, -r * 0.12)
        ctx.quadraticCurveTo(r * 0.7, 0, r * 0.55, r * 0.12)
        ctx.lineTo(0, r * 0.06)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#2e1c0e'
        ctx.lineWidth = 0.8
        ctx.stroke()
        ctx.fillStyle = '#8a8f99'
        ctx.fillRect(r * 0.05, -r * 0.08, 1.2, r * 0.16)
      },
      3,
    ),
  )
}

export function mineRackTex(r: number, big: boolean): Tex {
  return cached(`mineRack:${r}:${big}`, () =>
    worldTex(
      r * 0.6,
      r * 0.9,
      r * 0.3,
      r * 0.45,
      (ctx) => {
        ctx.fillStyle = '#5a3a1e'
        ctx.fillRect(-r * 0.24, -r * 0.4, r * 0.48, r * 0.8)
        const mr = r * (big ? 0.14 : 0.11)
        for (const y of [-r * 0.2, 0, r * 0.2]) {
          const g = ctx.createRadialGradient(-mr * 0.3, y - mr * 0.3, 0.3, 0, y, mr)
          g.addColorStop(0, '#6d7380')
          g.addColorStop(1, '#141518')
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(0, y, mr, 0, Math.PI * 2)
          ctx.fill()
        }
      },
      3,
    ),
  )
}

/** Torreta de cubierta con sus cañones, apuntando a +x. */
export function turretTex(tierId: string, r: number): Tex {
  return cached(`turret:${tierId}:${r}`, () => {
    const layout: DeckLayout =
      tierId === 'starter'
        ? { turrets: 1, barrelsPerTurret: 1, multiDirectional: false, style: 'light' }
        : deckLayout(tierId)
    const barrelLen = deckBarrelLength(layout.style, r) * (tierId === 'starter' ? 0.8 : 1)
    const baseR =
      r *
      (layout.style === 'heavy' || layout.style === 'buster' || layout.style === 'mortar'
        ? 0.3
        : layout.style === 'auto'
          ? 0.2
          : 0.24)
    const bw = {
      heavy: r * 0.17,
      sniper: r * 0.12,
      buster: r * 0.26,
      light: r * 0.1,
      auto: r * 0.09,
      gatling: r * 0.06,
      mortar: r * 0.3,
    }[layout.style]
    const size = (barrelLen + baseR) * 2 + 8
    return worldTex(size, size, size / 2, size / 2, (ctx) => {
      const dirs: number[] = []
      if (layout.multiDirectional) {
        if (layout.anglesDeg) for (const d of layout.anglesDeg) dirs.push((d * Math.PI) / 180)
        else
          for (let i = 0; i < layout.barrelsPerTurret; i++)
            dirs.push((i / layout.barrelsPerTurret) * Math.PI * 2)
      } else {
        dirs.push(0)
      }
      const offsets =
        !layout.multiDirectional && layout.barrelsPerTurret > 1
          ? Array.from(
              { length: layout.barrelsPerTurret },
              (_, i) => (i - (layout.barrelsPerTurret - 1) / 2) * bw * 1.35,
            )
          : [0]

      for (const a of dirs) {
        for (const off of offsets) {
          ctx.save()
          ctx.rotate(a)
          ctx.translate(0, off)
          if (layout.style === 'mortar') {
            // Mortero: boca ancha y corta, vista casi desde arriba
            const g = ctx.createRadialGradient(barrelLen * 0.6, -bw * 0.15, 0.5, barrelLen * 0.6, 0, bw * 0.7)
            g.addColorStop(0, '#7a7f89')
            g.addColorStop(1, '#1d1f23')
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.ellipse(barrelLen * 0.55, 0, barrelLen * 0.6, bw * 0.62, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#08090b'
            ctx.beginPath()
            ctx.ellipse(barrelLen * 0.9, 0, bw * 0.28, bw * 0.4, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#9aa0aa'
            ctx.lineWidth = 0.8
            ctx.stroke()
          } else if (layout.style === 'gatling') {
            for (const g of [-1, 0, 1]) {
              ctx.fillStyle = g === 0 ? '#2b2d32' : '#3f434b'
              ctx.fillRect(0, g * bw * 1.1 - bw / 2, barrelLen, bw)
            }
            ctx.fillStyle = '#6d717a'
            ctx.fillRect(barrelLen * 0.55, -bw * 1.8, 1.4, bw * 3.6)
          } else {
            const g = ctx.createLinearGradient(0, -bw / 2, 0, bw / 2)
            g.addColorStop(0, '#7a7f89')
            g.addColorStop(0.5, '#2d3035')
            g.addColorStop(1, '#131417')
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.moveTo(0, -bw * 0.6)
            ctx.lineTo(barrelLen, -bw * 0.45)
            ctx.lineTo(barrelLen, bw * 0.45)
            ctx.lineTo(0, bw * 0.6)
            ctx.closePath()
            ctx.fill()
            ctx.fillStyle = '#16171a'
            ctx.fillRect(barrelLen - 2, -bw * 0.58, 2, bw * 1.16)
            if (layout.style === 'sniper') {
              ctx.fillStyle = '#4a4e56'
              ctx.fillRect(barrelLen * 0.35, -bw * 0.75, 2, bw * 1.5)
            }
          }
          ctx.restore()
        }
      }

      const base = ctx.createRadialGradient(-baseR * 0.3, -baseR * 0.3, 0.5, 0, 0, baseR)
      base.addColorStop(0, layout.style === 'auto' ? '#9fb3c2' : '#8a8f99')
      base.addColorStop(0.6, '#3d4047')
      base.addColorStop(1, '#1a1b1f')
      ctx.fillStyle = base
      ctx.beginPath()
      ctx.arc(0, 0, baseR, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#111215'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = 'rgba(230,235,240,0.55)'
      const rivets = 8
      for (let i = 0; i < rivets; i++) {
        const a = (i / rivets) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(Math.cos(a) * baseR * 0.75, Math.sin(a) * baseR * 0.75, 0.7, 0, Math.PI * 2)
        ctx.fill()
      }
      if (layout.style === 'auto') {
        ctx.fillStyle = '#e8b64b'
        ctx.beginPath()
        ctx.arc(0, 0, baseR * 0.3, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  })
}
