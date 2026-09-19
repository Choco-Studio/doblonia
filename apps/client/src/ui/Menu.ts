import { SKINS, type SkinDef } from '@doblonia/content'
import { settings, saveSettings } from '../settings.js'
import { fetchStatus, type Mode } from '../net/Connection.js'
import { ICON } from './icons.js'
import { openHelp, openSettings } from './Modals.js'
import { sound } from '../audio/Sound.js'
import project from '../../../../package.json'

const hexc = (n: number) => `#${n.toString(16).padStart(6, '0')}`

/** Aclara (+) u oscurece (−) un color. */
function tone(c: number, k: number): string {
  const ch = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))
  return `rgb(${ch((c >> 16) & 255)},${ch((c >> 8) & 255)},${ch(c & 255)})`
}

/** Miniatura del barco vista desde arriba, con el mismo estilo que el barco del juego. */
function skinSvg(s: SkinDef): string {
  const id = `sk-${s.id}`
  const HULL =
    'M41 24 C 36 16.2, 22 15.3, 10.5 16.8 Q 7 17.6, 7 21 L 7 27 Q 7 30.4, 10.5 31.2 C 22 32.7, 36 31.8, 41 24 Z'
  const sail = (x: number, w: number, main: boolean) => `
      <path d="M${x - 1} ${24 - w} Q ${x + 6} 24, ${x - 1} ${24 + w} Q ${x + 1.6} 24, ${x - 1} ${24 - w} Z" fill="url(#${id}-sail)" stroke="${tone(s.sail, -0.45)}" stroke-width=".5"/>
      <path d="M${x - 1} ${24 - w} L ${x - 1} ${24 + w}" stroke="#4a2c14" stroke-width="1.1" stroke-linecap="round"/>
      ${main ? `<circle cx="${x + 1.9}" cy="24" r="1.9" fill="${hexc(s.trim)}" stroke="${tone(s.trim, -0.4)}" stroke-width=".4"/>` : ''}
      <circle cx="${x - 1}" cy="24" r="1.1" fill="#3a2410"/>`
  return `<svg viewBox="0 0 48 48" aria-hidden="true">
    <defs>
      <linearGradient id="${id}-hull" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${tone(s.hull, 0.22)}"/><stop offset=".55" stop-color="${hexc(s.hull)}"/><stop offset="1" stop-color="${hexc(s.hullDark)}"/>
      </linearGradient>
      <linearGradient id="${id}-deck" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${tone(s.deck, -0.15)}"/><stop offset="1" stop-color="${tone(s.deck, 0.12)}"/>
      </linearGradient>
      <linearGradient id="${id}-sail" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${tone(s.sail, -0.18)}"/><stop offset="1" stop-color="${tone(s.sail, 0.15)}"/>
      </linearGradient>
    </defs>
    <g class="ship">
      <!-- Estela -->
      <path d="M7 21.5 Q 1 19.5, -4 20.5 M7 26.5 Q 1 28.5, -4 27.5" fill="none" stroke="rgba(230,248,255,.55)" stroke-width="1.3" stroke-linecap="round"/>
      <!-- Sombra en el agua -->
      <path d="${HULL}" transform="translate(1.6 2.6)" fill="rgba(0,10,18,.4)"/>
      <!-- Bauprés -->
      <path d="M39.5 24 L 46.5 24" stroke="#5a3a1c" stroke-width="1.3" stroke-linecap="round"/>
      <!-- Casco, regala y cubierta -->
      <path d="${HULL}" fill="url(#${id}-hull)" stroke="${tone(s.hullDark, -0.35)}" stroke-width=".8"/>
      <path d="M37.8 24 C 33.8 18.6, 22 17.8, 11.4 19.2 L 11.4 28.8 C 22 30.2, 33.8 29.4, 37.8 24 Z" fill="url(#${id}-deck)"/>
      <path d="M12 21.4 H 33 M12 24 H 36 M12 26.6 H 33" stroke="${tone(s.deck, -0.4)}" stroke-opacity=".35" stroke-width=".45"/>
      <!-- Portillas de los cañones -->
      <g fill="${tone(s.hullDark, -0.5)}">
        <rect x="15" y="16.7" width="2" height="1.1" rx=".3"/><rect x="21" y="16.2" width="2" height="1.1" rx=".3"/><rect x="27" y="16.6" width="2" height="1.1" rx=".3"/>
        <rect x="15" y="30.2" width="2" height="1.1" rx=".3"/><rect x="21" y="30.7" width="2" height="1.1" rx=".3"/><rect x="27" y="30.3" width="2" height="1.1" rx=".3"/>
      </g>
      <!-- Camarote de popa con ventanas -->
      <rect x="8.6" y="20.2" width="5.4" height="7.6" rx="1.2" fill="${tone(s.hull, 0.1)}" stroke="${tone(s.hullDark, -0.3)}" stroke-width=".5"/>
      <rect x="9.6" y="21.4" width="1.3" height="1.6" rx=".3" fill="${hexc(s.trim)}"/><rect x="9.6" y="25" width="1.3" height="1.6" rx=".3" fill="${hexc(s.trim)}"/>
      <!-- Remate de la regala -->
      <path d="M40.2 24 C 36 17.2, 22 16.3, 10.8 17.7" fill="none" stroke="${hexc(s.trim)}" stroke-opacity=".75" stroke-width=".6"/>
      ${sail(19.5, 9.5, false)}
      ${sail(29, 8.5, true)}
      <!-- Gallardete -->
      <path d="M18.5 24 L 13 22.3 L 14.2 24 L 13 25.7 Z" fill="${hexc(s.trim)}"/>
    </g>
  </svg>`
}

export class Menu {
  readonly root = document.createElement('div')
  private status: HTMLElement
  private play: HTMLButtonElement
  private input: HTMLInputElement
  private statusTimer: number | undefined
  private mode: Mode = settings.mode
  private skin = settings.skin
  private destroyed = false
  private pollAbort = new AbortController()
  private focusTimer: ReturnType<typeof setTimeout> | undefined

  constructor(private onPlay: (mode: Mode, name: string, skin: string) => void) {
    this.root.className = 'menu'
    this.root.innerHTML = `
      <div class="menu-inner">
        <div class="logo"><h1>Doblonia<span>.io</span></h1><p>Recoge doblones. Arma tu barco. Hunde al resto.</p></div>
        <div class="panel menu-card">
          <div>
            <label class="field-label" for="captain-name">Nombre de capitán</label>
            <input id="captain-name" class="name-input" maxlength="16" placeholder="Capitán sin nombre" autocomplete="nickname" spellcheck="false" enterkeyhint="go" />
          </div>
          <div>
            <div class="field-label"><span>Barco</span><span class="skin-name"></span></div>
            <div class="skins">${SKINS.map((s) => `<button class="skin" data-skin="${s.id}" title="${s.name}" aria-label="${s.name}">${skinSvg(s)}</button>`).join('')}</div>
          </div>
          <div>
            <div class="field-label"><span>Modo</span></div>
            <div class="modes">
              <button class="mode" data-mode="ffa"><b>Todos contra todos</b><small><span class="dot"></span><span data-count="ffa">—</span></small></button>
              <button class="mode" data-mode="tdm"><b>Por equipos</b><small><span class="dot"></span><span data-count="tdm">—</span></small></button>
            </div>
          </div>
          <button class="btn-primary" data-act="play">${ICON.anchor} Zarpar</button>
          <div class="menu-status" role="status" aria-live="polite"></div>
          <div class="menu-row">
            <button class="btn-ghost" data-act="help">${ICON.info} Cómo jugar</button>
            <button class="btn-ghost" data-act="settings">${ICON.gear} Ajustes</button>
          </div>
        </div>
        <div class="menu-foot">Versión ${project.version} · Código abierto (AGPL-3.0). Sin anuncios y sin ventajas de pago.<br/>Sin afiliación con los creadores del juego naval original de 2016.</div>
      </div>`
    this.status = this.root.querySelector('.menu-status')!
    this.play = this.root.querySelector('[data-act="play"]')!
    this.input = this.root.querySelector('.name-input')!
    this.input.value = settings.name
    const sourceUrl = import.meta.env.VITE_SOURCE_URL ?? 'https://github.com/Choco-Studio/doblonia'
    if (sourceUrl) {
      try {
        const url = new URL(sourceUrl)
        if (url.protocol === 'https:' || url.protocol === 'http:') {
          const link = document.createElement('a')
          link.href = url.href
          link.textContent = 'Código fuente y contribuciones'
          link.target = '_blank'
          link.rel = 'noopener noreferrer'
          const footer = this.root.querySelector('.menu-foot')!
          footer.append(document.createElement('br'), link)
        }
      } catch {
        console.warn('VITE_SOURCE_URL must be a valid HTTP(S) repository URL')
      }
    }

    this.root.querySelectorAll<HTMLButtonElement>('.skin').forEach((b) =>
      b.addEventListener('click', () => {
        sound.unlock()
        sound.play('click')
        this.skin = b.dataset.skin!
        this.refresh()
      }),
    )
    this.root.querySelectorAll<HTMLButtonElement>('.mode').forEach((b) =>
      b.addEventListener('click', () => {
        sound.unlock()
        sound.play('click')
        this.mode = b.dataset.mode as Mode
        this.refresh()
      }),
    )
    this.play.addEventListener('click', () => this.submit())
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submit()
    })
    this.root.querySelector('[data-act="help"]')!.addEventListener('click', () => {
      sound.unlock()
      openHelp()
    })
    this.root.querySelector('[data-act="settings"]')!.addEventListener('click', () => {
      sound.unlock()
      openSettings()
    })
    this.refresh()
    this.pollStatus()
    if (!matchMedia('(pointer: coarse)').matches) this.focusTimer = setTimeout(() => this.input.focus(), 80)
  }

  private refresh(): void {
    this.root.querySelectorAll<HTMLButtonElement>('.skin, .mode').forEach((b) => {
      const selected = b.dataset.skin === this.skin || b.dataset.mode === this.mode
      b.classList.toggle('sel', selected)
      b.setAttribute('aria-pressed', String(selected))
    })
    this.root.querySelector('.skin-name')!.textContent = SKINS.find((s) => s.id === this.skin)?.name ?? ''
  }

  private async pollStatus(): Promise<void> {
    const timeout = setTimeout(() => this.pollAbort.abort(), 5000)
    const st = await fetchStatus(this.pollAbort.signal)
    clearTimeout(timeout)
    if (this.destroyed) return
    this.pollAbort = new AbortController()
    for (const m of ['ffa', 'tdm'] as const) {
      const el = this.root.querySelector(`[data-count="${m}"]`)
      if (el)
        el.textContent = st ? (st[m] > 0 ? `${st[m]} jugando` : 'Nueva partida') : 'Servidor no disponible'
    }
    this.statusTimer = window.setTimeout(() => this.pollStatus(), 5000)
  }

  private submit(): void {
    if (this.play.disabled || this.destroyed) return
    sound.unlock()
    sound.play('click')
    const name = this.input.value.trim().slice(0, 16) || 'Capitán'
    saveSettings({ name: this.input.value.trim(), skin: this.skin, mode: this.mode })
    this.play.disabled = true
    this.play.innerHTML = `${ICON.anchor} Zarpando…`
    this.status.textContent = ''
    this.onPlay(this.mode, name, this.skin)
  }

  setError(msg: string): void {
    this.status.textContent = msg
    this.play.disabled = false
    this.play.innerHTML = `${ICON.anchor} Zarpar`
  }

  destroy(): void {
    this.destroyed = true
    this.pollAbort.abort()
    clearTimeout(this.focusTimer)
    window.clearTimeout(this.statusTimer)
    this.root.remove()
  }
}
