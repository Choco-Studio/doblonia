export interface FrameInput {
  throttle: number
  turn: number
  aimAngle: number
  /** Distancia al punto apuntado (morteros). */
  aimDist: number
  firing: boolean
  fireCoin: boolean
}

interface Stick {
  el: HTMLDivElement
  knob: HTMLDivElement
  pointerId: number | null
  cx: number
  cy: number
  x: number
  y: number
}

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

export const isTouchDevice = (): boolean =>
  matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window

export class InputManager {
  private keys = new Set<string>()
  private mouseDown = false
  autoFire = false
  private pendingFireCoin = false
  mouseX = innerWidth / 2
  mouseY = innerHeight / 2
  readonly touch: boolean
  private move: Stick | null = null
  private aim: Stick | null = null
  private touchRoot: HTMLDivElement | null = null
  onAutoFireToggled?: (enabled: boolean) => void
  enabled = true
  private lastTouchAim: number | null = null
  private lastTouchDistance = 300

  constructor(private target: HTMLElement) {
    this.touch = isTouchDevice()
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    window.addEventListener('resize', this.onBlur)
    target.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('mousemove', this.onMouseMove)
    target.addEventListener('contextmenu', this.onContextMenu)
    if (this.touch) this.buildTouchControls()
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    window.removeEventListener('resize', this.onBlur)
    this.target.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('mousemove', this.onMouseMove)
    this.target.removeEventListener('contextmenu', this.onContextMenu)
    this.touchRoot?.remove()
  }

  private typing(e: Event): boolean {
    const el = e.target as HTMLElement | null
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null
    if (!this.enabled || this.typing(e) || target?.closest('[role="dialog"]')) return
    // El foco de una compra no debe dejar el timón bloqueado; espacio/Enter siguen activando el botón.
    if ((e.key === ' ' || e.key === 'Enter') && target?.closest('button')) return
    const k = e.key.toLowerCase()
    this.keys.add(k)
    if (k === ' ' || k.startsWith('arrow')) e.preventDefault()
    if (e.repeat) return
    if (k === 'e') this.toggleAutoFire()
    if (k === 'f') this.pendingFireCoin = true
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase())
  }

  reset(): void {
    this.keys.clear()
    this.mouseDown = false
    this.pendingFireCoin = false
    this.autoFire = false
    for (const stick of [this.move, this.aim]) {
      if (!stick) continue
      if (stick.pointerId !== null && stick.el.hasPointerCapture(stick.pointerId))
        stick.el.releasePointerCapture(stick.pointerId)
      stick.pointerId = null
      stick.x = stick.y = 0
      stick.knob.style.transform = 'translate(0,0)'
    }
    this.touchRoot?.querySelector('.touch-auto')?.classList.remove('on')
    this.touchRoot?.querySelector('.touch-auto')?.setAttribute('aria-pressed', 'false')
    this.onAutoFireToggled?.(false)
  }

  private onBlur = (): void => this.reset()

  private onVisibilityChange = (): void => {
    if (document.hidden) this.reset()
  }

  private onContextMenu = (event: Event): void => event.preventDefault()

  private onMouseDown = (e: MouseEvent): void => {
    if (this.enabled && e.button === 0) this.mouseDown = true
  }

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = false
  }

  private onMouseMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX
    this.mouseY = e.clientY
  }

  toggleAutoFire(): void {
    if (!this.enabled) return
    this.autoFire = !this.autoFire
    this.touchRoot?.querySelector('.touch-auto')?.setAttribute('aria-pressed', String(this.autoFire))
    this.onAutoFireToggled?.(this.autoFire)
  }

  requestCoinShot(): void {
    if (!this.enabled) return
    this.pendingFireCoin = true
  }

  private held(...names: string[]): boolean {
    return names.some((n) => this.keys.has(n))
  }

  /** Dirección de apuntado táctil (si el stick derecho está activo). */
  touchAim(): number | null {
    if (!this.touch) return null
    if (this.aim && this.aim.pointerId !== null && Math.hypot(this.aim.x, this.aim.y) >= 0.15) {
      this.lastTouchAim = Math.atan2(this.aim.y, this.aim.x)
    }
    return this.lastTouchAim
  }

  /** Con el stick de apuntar, la inclinación decide lo lejos que cae el mortero. */
  touchAimDist(): number | null {
    if (!this.touch) return null
    if (this.aim && this.aim.pointerId !== null)
      this.lastTouchDistance = 90 + Math.min(1, Math.hypot(this.aim.x, this.aim.y)) * 430
    return this.lastTouchDistance
  }

  sample(aimAngle: number, shipAngle: number, aimDist: number): FrameInput {
    const fireCoin = this.pendingFireCoin
    this.pendingFireCoin = false
    if (!this.enabled) return { throttle: 0, turn: 0, aimAngle, aimDist, firing: false, fireCoin: false }

    let throttle = (this.held('w', 'arrowup') ? 1 : 0) - (this.held('s', 'arrowdown') ? 1 : 0)
    let turn = (this.held('d', 'arrowright') ? 1 : 0) - (this.held('a', 'arrowleft') ? 1 : 0)
    let firing = this.mouseDown || this.held(' ') || this.autoFire

    if (this.move && this.move.pointerId !== null) {
      const m = Math.min(1, Math.hypot(this.move.x, this.move.y))
      if (m > 0.12) {
        const desired = Math.atan2(this.move.y, this.move.x)
        const diff = wrap(desired - shipAngle)
        turn = Math.max(-1, Math.min(1, diff / 0.45))
        throttle = Math.abs(diff) > 2.3 ? 0.25 : m
      }
    }
    if (this.aim && this.aim.pointerId !== null && Math.hypot(this.aim.x, this.aim.y) > 0.35) firing = true

    return { throttle, turn, aimAngle, aimDist, firing, fireCoin }
  }

  // ---------------------------------------------------------------------------
  // Controles táctiles
  // ---------------------------------------------------------------------------

  private buildTouchControls(): void {
    const root = document.createElement('div')
    root.className = 'touch-controls'
    root.innerHTML = `
      <div class="stick stick-left"><div class="knob"></div><span>Rumbo</span></div>
      <div class="stick stick-right"><div class="knob"></div><span>Apuntar · fuego</span></div>
      <button class="touch-btn touch-auto" aria-label="Auto-disparo" aria-pressed="false">AUTO</button>
      <button class="touch-btn touch-coin" aria-label="Lanzar moneda, cuesta 10 doblones"><span aria-hidden="true">◈</span><small>10</small></button>
    `
    // Comparte el contexto de capas del HUD para que los paneles puedan cubrir los mandos.
    const container = this.target.parentElement ?? document.body
    container.appendChild(root)
    this.touchRoot = root
    const mk = (sel: string): Stick => {
      const el = root.querySelector(sel) as HTMLDivElement
      return {
        el,
        knob: el.querySelector('.knob') as HTMLDivElement,
        pointerId: null,
        cx: 0,
        cy: 0,
        x: 0,
        y: 0,
      }
    }
    this.move = mk('.stick-left')
    this.aim = mk('.stick-right')
    for (const st of [this.move, this.aim]) this.bindStick(st)
    root.querySelector('.touch-auto')!.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.toggleAutoFire()
      ;(e.currentTarget as HTMLElement).classList.toggle('on', this.autoFire)
    })
    root.querySelector('.touch-coin')!.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.pendingFireCoin = true
    })
  }

  private bindStick(st: Stick): void {
    st.el.addEventListener('pointerdown', (e) => {
      if (st.pointerId !== null || !this.enabled) return
      e.preventDefault()
      st.pointerId = e.pointerId
      st.el.setPointerCapture(e.pointerId)
      const rect = st.el.getBoundingClientRect()
      st.cx = rect.left + rect.width / 2
      st.cy = rect.top + rect.height / 2
      update(e)
    })
    const update = (e: PointerEvent) => {
      if (st.pointerId !== e.pointerId) return
      let dx = e.clientX - st.cx
      let dy = e.clientY - st.cy
      const R = st.el.clientWidth * 0.36
      const d = Math.hypot(dx, dy)
      if (d > R) {
        dx = (dx / d) * R
        dy = (dy / d) * R
      }
      st.x = dx / R
      st.y = dy / R
      st.knob.style.transform = `translate(${dx}px, ${dy}px)`
    }
    st.el.addEventListener('pointermove', update)
    const end = (e: PointerEvent) => {
      if (st.pointerId !== e.pointerId) return
      st.pointerId = null
      st.x = 0
      st.y = 0
      st.knob.style.transform = 'translate(0,0)'
    }
    st.el.addEventListener('pointerup', end)
    st.el.addEventListener('pointercancel', end)
    st.el.addEventListener('lostpointercapture', end)
  }
}
