import { hudTemplate } from './hudTemplate.js'
import type { Room } from '@colyseus/sdk'
import type { ActionResult, RoomStateSchema, ShipStateSchema } from '@doblonia/protocol'
import {
  FLEET_SHIPS,
  MAX_HEAVY_FLEET,
  MAX_LIGHT_FLEET,
  SLOT_NAMES,
  SLOT_ORDER,
  SLOT_UNLOCK_LEVEL,
  STAT_DEFS,
  STAT_ORDER,
  TOTAL_STAT_POINTS_CAP,
  equipOptionsForSlot,
  findBossDef,
  findBranch,
  findFleetDef,
  findTier,
  statUpgradeCost,
  xpForEquipLevel,
  type SlotId,
  type StatId,
  type WeaponBranch,
  type WeaponTier,
} from '@doblonia/content'

import { fleetTypeLimit, type WorldEvent } from '@doblonia/sim'
import type { Connection } from '../net/Connection.js'
import type { GameView } from '../render/GameView.js'
import type { InputManager } from '../input/InputManager.js'
import { ICON } from './icons.js'
import { Minimap } from './Minimap.js'
import { openHelp, openSettings, closeModal, isModalOpen } from './Modals.js'
import { sound } from '../audio/Sound.js'
import { settings, saveSettings } from '../settings.js'
import type { EquipMap } from './loadoutMetrics.js'
import { openShipyard } from './Shipyard.js'

const STAT_LABEL: Record<StatId, string> = {
  hull: 'Casco',
  repair: 'Reparación',
  range: 'Alcance',
  damage: 'Daño',
  reload: 'Recarga',
  speed: 'Velocidad',
  turn: 'Giro',
  ram: 'Embestida',
}

const FLEET_KEYS = ['9', '0', 't', 'y']
const EQUIP_KEYS = ['z', 'x', 'c', 'v', 'b']
const FLEET_SHORT: Record<string, string> = {
  fishing_boat: 'Pesquero',
  mine_dropper_fleet: 'Minador',
  battleship: 'Escolta',
  man_of_war: 'Navío',
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

function parse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function fmt(n: number): string {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.floor(n))
}

interface TutorialStep {
  id: string
  text: string
  touchText: string
  done: (s: ShipStateSchema) => boolean
}

const TUTORIAL: TutorialStep[] = [
  {
    id: 'move',
    text: 'Navega con <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> y recoge doblones: son tu dinero y tu experiencia.',
    touchText: 'Mueve el mando izquierdo para navegar. Recoge doblones para mejorar tu barco.',
    done: (s) => s.equipXp >= 30,
  },
  {
    id: 'stat',
    text: 'Pulsa <kbd>1</kbd>–<kbd>8</kbd> (o haz clic en el panel) para comprar mejoras con tus doblones.',
    touchText: 'Abre <b>Mejoras</b> en la barra superior y gasta tus doblones en estadísticas.',
    done: (s) =>
      s.statsJson !== '{}' &&
      Object.values(parse<Record<string, number>>(s.statsJson, {})).some((v) => v > 0),
  },
  {
    id: 'equip',
    text: 'Has subido de nivel: elige tu primera arma abajo con <kbd>Z</kbd> <kbd>X</kbd> o clic. Es permanente en esta vida.',
    touchText: 'Elige tu primera arma en el panel inferior. Esa rama se conserva durante esta vida.',
    done: (s) => s.equipJson !== '{}',
  },
  {
    id: 'fire',
    text: 'Apunta con el ratón y dispara con clic o <kbd>Espacio</kbd>. <kbd>E</kbd> activa el auto-disparo.',
    touchText: 'Arrastra el mando derecho para apuntar y disparar. <b>AUTO</b> mantiene el fuego.',
    done: () => false,
  },
]

export class Hud {
  readonly root = document.createElement('div')
  private minimap: Minimap
  private el: Record<string, HTMLElement> = {}
  private statRows = new Map<StatId, HTMLButtonElement>()
  private slotEls = new Map<SlotId, HTMLButtonElement>()
  private fleetBtns = new Map<string, HTMLButtonElement>()
  private trayLoadouts: EquipMap[] = []
  private equipOpts: { slot: SlotId; branch: WeaponBranch; tier: WeaponTier }[] = []
  private equipKey = ''
  private equipDeferredAt = -1
  private lastCoins = -1
  private lastLevel = 1
  private lastAlive = true
  private deathShownAt = 0
  private toastsEl!: HTMLElement
  private killfeedEl!: HTMLElement
  private lbKey = ''
  private tutorialIndex = 0
  private tutorialFireTimer = 0
  private statKey = ''
  private destroyed = false
  private updateElapsed = 0
  private stopActions: () => void

  constructor(
    container: HTMLElement,
    private room: Room<RoomStateSchema>,
    private myId: string,
    private conn: Connection,
    private view: GameView,
    private input: InputManager,
    private onExit: () => void,
  ) {
    this.root.className = 'ui-root'
    this.root.innerHTML = hudTemplate()
    container.appendChild(this.root)
    const q = (s: string) => this.root.querySelector(s) as HTMLElement
    for (const k of [
      'pcLevel',
      'pcName',
      'pcPower',
      'hpBar',
      'hpFill',
      'hpGhost',
      'hpText',
      'coins',
      'coinsDelta',
      'statsTitle',
      'lb',
      'pop',
      'bossBar',
      'bossName',
      'bossState',
      'bossFill',
      'teamScore',
      'tsRed',
      'tsBlue',
      'hint',
      'hintText',
      'chipAuto',
      'chipShield',
      'chipBurn',
      'chipSlow',
      'tray',
      'trayTitle',
      'traySub',
      'trayOpts',
      'xpLevel',
      'xpBar',
      'xpFill',
      'xpNext',
      'death',
      'dBy',
      'dTime',
      'dScore',
      'dKills',
      'dLevel',
      'dBtn',
      'dTip',
      'btnSound',
      'coords',
    ]) {
      this.el[k] = q(`[data-el="${k}"]`)
    }
    this.toastsEl = q('.toasts')
    this.killfeedEl = q('.killfeed')
    this.buildStats()
    this.buildSlots()
    this.buildFleet()
    this.minimap = new Minimap(q('.minimap canvas') as HTMLCanvasElement, room, myId, view)

    q('[data-act="settings"]').addEventListener('click', () => {
      sound.play('click')
      openSettings()
    })
    q('[data-act="help"]').addEventListener('click', () => {
      sound.play('click')
      openHelp()
    })
    q('[data-act="shipyard"]').addEventListener('click', () => {
      sound.play('click')
      this.openShipyard()
    })
    q('[data-act="tree"]').addEventListener('click', () => {
      sound.play('click')
      this.openShipyard(this.equipOpts[0]?.slot)
    })
    q('[data-act="fullscreen"]').addEventListener('click', () => this.toggleFullscreen())
    q('[data-act="exit"]').addEventListener('click', () => this.onExit())
    this.root.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach((button) => {
      button.addEventListener('click', () => this.togglePanel(button.dataset.panel!))
    })
    this.root.querySelectorAll<HTMLButtonElement>('[data-act="close-panel"]').forEach((button) => {
      button.addEventListener('click', () => this.togglePanel(''))
    })
    this.root.querySelectorAll<HTMLButtonElement>('button[title]').forEach((button) => {
      if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', button.title)
    })
    this.stopActions = room.onMessage<ActionResult>('actionResult', (result) => {
      if (this.destroyed) return
      if (result.ok) {
        sound.play(result.action === 'equipPick' ? 'equip' : 'buy', { volume: 0.7 })
        if (result.action === 'equipPick') {
          this.equipKey = ''
          this.hideTray()
        }
      } else {
        const reasons: Record<string, string> = {
          insufficient_funds: 'No tienes suficientes doblones.',
          dead: 'Espera a volver a zarpar.',
          no_picks: 'Ya has usado las mejoras disponibles.',
          cap_reached: 'Has alcanzado el límite de poder.',
          stat_maxed: 'Esta estadística ya está al máximo.',
          branch_locked: 'La rama elegida se mantiene durante esta vida.',
        }
        sound.play('error', { volume: 0.5 })
        this.toast(
          reasons[result.reason ?? ''] ??
            'No se pudo aplicar la mejora. Revisa tu equipo y vuelve a intentarlo.',
          'bad',
        )
      }
    })
    this.el.btnSound.addEventListener('click', () => this.toggleMute())
    q('[data-act="later"]').addEventListener('click', () => {
      this.equipDeferredAt = this.currentShip()?.equipPicks ?? 0
      this.hideTray()
    })
    this.el.hint.querySelector('button')!.addEventListener('click', () => {
      saveSettings({ tutorialDone: true })
      this.el.hint.classList.remove('show')
    })
    this.el.dBtn.addEventListener('click', () => this.respawn())
    this.refreshMuteIcon()
    if (settings.tutorialDone) this.tutorialIndex = TUTORIAL.length

    window.addEventListener('keydown', this.onKey)
  }

  destroy(): void {
    this.destroyed = true
    this.stopActions()
    window.removeEventListener('keydown', this.onKey)
    this.root.remove()
  }

  private buildStats(): void {
    const panel = this.root.querySelector('.stats') as HTMLElement
    STAT_ORDER.forEach((id, i) => {
      const def = STAT_DEFS[id]
      const row = document.createElement('button')
      row.className = 'stat-row'
      row.style.setProperty('--c', `var(--c-${id})`)
      row.title = def.description
      row.innerHTML = `<kbd>${i + 1}</kbd><span class="st-icon">${ICON[id]}</span><span class="st-main"><span class="st-name">${STAT_LABEL[id]}</span><span class="pips">${'<i></i>'.repeat(15)}</span></span><span class="st-cost"></span>`
      row.addEventListener('click', () => this.buyStat(id))
      panel.appendChild(row)
      this.statRows.set(id, row)
    })
  }

  private buildSlots(): void {
    const wrap = this.root.querySelector('.slots') as HTMLElement
    for (const slot of SLOT_ORDER) {
      const el = document.createElement('button')
      el.className = 'panel slot interactive'
      el.setAttribute('aria-label', `Equipo de ${SLOT_NAMES[slot]}`)
      el.innerHTML = `<span class="sl-icon">${ICON[slot]}</span><span class="sl-text"><span class="sl-label">${SLOT_NAMES[slot]}</span><span class="sl-name"></span><span class="sl-tiers"></span></span>`
      el.addEventListener('click', () => {
        if (el.classList.contains('pending') && !this.el.tray.classList.contains('show')) {
          this.equipDeferredAt = -1
          this.equipKey = ''
        } else {
          sound.play('click')
          this.openShipyard(slot)
        }
      })
      wrap.appendChild(el)
      this.slotEls.set(slot, el)
    }
  }

  private buildFleet(): void {
    const grid = this.root.querySelector('.fleet-grid') as HTMLElement
    FLEET_SHIPS.forEach((def, i) => {
      const b = document.createElement('button')
      b.className = 'fleet-btn'
      b.title = `${def.name} — ${def.hp} de vida`
      b.innerHTML = `<span class="fb-count"></span><kbd>${FLEET_KEYS[i].toUpperCase()}</kbd><span class="fb-icon">${ICON[def.id as keyof typeof ICON] ?? ICON.ship}</span><span class="fb-name">${FLEET_SHORT[def.id]}</span><span class="fb-cost">${ICON.coin}${def.cost}</span>`
      b.addEventListener('click', () => this.buyFleet(def.id))
      grid.appendChild(b)
      this.fleetBtns.set(def.id, b)
    })
  }

  // -------------------------------------------------------------------------
  // Acciones
  // -------------------------------------------------------------------------

  private currentShip(): ShipStateSchema | undefined {
    return this.room.state?.ships.get(this.myId)
  }

  private togglePanel(panel: string): void {
    this.root.dataset.panel = this.root.dataset.panel === panel ? '' : panel
    this.root.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach((button) => {
      button.setAttribute('aria-expanded', String(button.dataset.panel === this.root.dataset.panel))
    })
  }

  private buyStat(id: StatId): void {
    const s = this.currentShip()
    const row = this.statRows.get(id)!
    if (!s || !s.alive) return
    const lv = parse<Record<string, number>>(s.statsJson, {})[id] ?? 0
    const total = Object.values(parse<Record<string, number>>(s.statsJson, {})).reduce((a, b) => a + b, 0)
    if (lv >= 15 || total >= TOTAL_STAT_POINTS_CAP || s.coins < statUpgradeCost(lv)) {
      row.classList.remove('denied')
      void row.offsetWidth
      row.classList.add('denied')
      sound.play('error', { volume: 0.5 })
      return
    }
    this.conn.buyStat(id)
    row.classList.remove('pulse')
    void row.offsetWidth
    row.classList.add('pulse')
  }

  private buyFleet(defId: string): void {
    const b = this.fleetBtns.get(defId)!
    if (!b.classList.contains('can')) {
      b.classList.remove('denied')
      void b.offsetWidth
      b.classList.add('denied')
      sound.play('error', { volume: 0.5 })
      return
    }
    this.conn.buyFleet(defId)
  }

  private pickEquip(i: number): void {
    const opt = this.equipOpts[i]
    if (!opt) return
    this.conn.equipPick(opt.slot, opt.branch.id, opt.tier.id)
    this.equipKey = ''
    this.hideTray()
  }

  private openShipyard(slot?: SlotId): void {
    this.togglePanel('')
    openShipyard(
      {
        view: this.view,
        ship: () => this.currentShip(),
        pick: (sl, branchId, tierId) => {
          this.conn.equipPick(sl, branchId, tierId)
          this.equipKey = ''
        },
      },
      slot,
    )
  }

  private respawn(): void {
    const s = this.currentShip()
    if (!s || s.alive || this.view.serverTime < s.respawnAt) return
    sound.play('click')
    this.conn.respawn()
  }

  private toggleMute(): void {
    const muted = settings.masterVolume === 0
    saveSettings({ masterVolume: muted ? 0.7 : 0 })
    this.refreshMuteIcon()
  }

  private refreshMuteIcon(): void {
    this.el.btnSound.innerHTML = settings.masterVolume === 0 ? ICON.mute : ICON.sound
    this.el.btnSound.classList.toggle('on', settings.masterVolume === 0)
  }

  private toggleFullscreen(): void {
    const change = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen?.()
    void change?.catch(() => this.toast('El navegador no permite activar la pantalla completa.', 'bad'))
  }

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
    const k = e.key.toLowerCase()
    if (k === 'escape') {
      if (this.root.dataset.panel) {
        this.togglePanel('')
        return
      }
      if (!closeModal()) openSettings()
      return
    }
    if (isModalOpen() || e.repeat) return
    const s = this.currentShip()
    if (s && !s.alive && (k === 'enter' || k === ' ')) {
      e.preventDefault()
      this.respawn()
      return
    }
    const n = Number(k)
    if (Number.isInteger(n) && n >= 1 && n <= 8) this.buyStat(STAT_ORDER[n - 1])
    const fi = FLEET_KEYS.indexOf(k)
    if (fi >= 0) this.buyFleet(FLEET_SHIPS[fi].id)
    const ei = EQUIP_KEYS.indexOf(k)
    if (ei >= 0 && this.el.tray.classList.contains('show')) this.pickEquip(ei)
    if (k === 'm') this.toggleMute()
    if (k === 'g') this.openShipyard()
  }

  // -------------------------------------------------------------------------
  // Eventos
  // -------------------------------------------------------------------------

  toast(html: string, kind: '' | 'big' | 'bad' = '', ms = 3200): void {
    const t = document.createElement('div')
    t.className = `toast ${kind}`
    t.innerHTML = html
    this.toastsEl.appendChild(t)
    while (this.toastsEl.children.length > 3) this.toastsEl.firstElementChild?.remove()
    setTimeout(() => {
      t.classList.add('out')
      setTimeout(() => t.remove(), 450)
    }, ms)
  }

  private feed(html: string, cls: string): void {
    const d = document.createElement('div')
    d.className = `kf ${cls}`
    d.innerHTML = html
    this.killfeedEl.prepend(d)
    while (this.killfeedEl.children.length > 5) this.killfeedEl.lastElementChild?.remove()
    setTimeout(() => {
      d.style.opacity = '0'
      setTimeout(() => d.remove(), 500)
    }, 6000)
  }

  handleEvents(events: WorldEvent[]): void {
    for (const e of events) {
      if (e.type === 'death') {
        const mine = e.killedByShipId === this.myId
        const meDied = e.shipId === this.myId
        this.feed(
          `<span class="k">${esc(e.killerName)}</span>${ICON.swords}<span class="v">${esc(e.victimName)}</span>`,
          mine ? 'mine' : meDied ? 'me-died' : '',
        )
        if (mine) this.toast(`${ICON.swords} Hundiste a <b>${esc(e.victimName)}</b>`)
      } else if (e.type === 'bossDeath' && findBossDef(e.archetype).kind === 'fort') {
        const mine = e.killedByShipId === this.myId
        this.feed(
          `<span class="k">${esc(e.killerName)}</span>${ICON.crown}<span class="v">Fuerte</span>`,
          'boss',
        )
        if (mine) this.toast(`${ICON.crown} Tomaste el Fuerte (+${e.reward})`, 'big', 3500)
      } else if (e.type === 'bossDeath') {
        const name = findBossDef(e.archetype).name
        this.feed(
          `<span class="k">${esc(e.killerName)}</span>${ICON.crown}<span class="v">${esc(name)}</span>`,
          'boss',
        )
        const mine = e.killedByShipId === this.myId
        this.toast(
          `${ICON.crown} ${mine ? 'Hundiste' : `${esc(e.killerName)} hundió`} al ${esc(name)} (+${e.reward})`,
          mine ? 'big' : '',
          4500,
        )
      } else if (e.type === 'bossSpawn' && findBossDef(e.archetype).kind !== 'fort') {
        this.toast(`${ICON.skull} El ${esc(findBossDef(e.archetype).name)} vuelve a guardar el centro`, 'bad')
      } else if (e.type === 'pickup' && e.coinKind === 'chest' && e.shipId === this.myId) {
        this.toast(`${ICON.coin} ¡Cofre del tesoro! (+150)`, 'big', 2600)
      } else if (e.type === 'pickup' && e.coinKind === 'emerald') {
        const who = this.room.state?.ships.get(e.shipId)?.name ?? 'Alguien'
        this.toast(
          `${ICON.star} ${e.shipId === this.myId ? '¡Encontraste' : `${esc(who)} encontró`} la Esmeralda! (+500)`,
          e.shipId === this.myId ? 'big' : '',
        )
      } else if (e.type === 'levelUp' && e.shipId === this.myId) {
        const unlocked = SLOT_ORDER.find((s) => SLOT_UNLOCK_LEVEL[s] === e.level)
        this.toast(`Nivel ${e.level}${unlocked ? ` · se abre ${SLOT_NAMES[unlocked]}` : ''}`, 'big', 2600)
        this.equipDeferredAt = -1
      }
    }
  }

  // -------------------------------------------------------------------------
  // Actualización por fotograma
  // -------------------------------------------------------------------------

  update(dt: number): void {
    if (this.destroyed) return
    this.updateElapsed += dt
    if (this.updateElapsed < 0.1) return
    dt = this.updateElapsed
    this.updateElapsed = 0
    const state = this.room.state
    if (!state) return
    const s = state.ships.get(this.myId)
    if (s) {
      this.updatePlayer(s)
      this.updateStats(s)
      this.updateSlotsAndTray(s)
      this.updateFleet(s, state)
      this.updateDeath(s)
      this.updateTutorial(s, dt)
      this.el.chipAuto.classList.toggle('show', this.input.autoFire)
      this.el.chipShield.classList.toggle('show', s.alive && s.spawnProtectedUntil > this.view.serverTime)
      this.el.chipBurn.classList.toggle('show', s.alive && (s.status & 2) !== 0)
      this.el.chipSlow.classList.toggle('show', s.alive && (s.status & 1) !== 0)
      const pos = this.view.myPosition()
      this.el.coords.textContent = `${Math.round(pos.x)}, ${Math.round(pos.y)}`
    }
    this.updateLeaderboard(state)
    this.updateBossBar(state)
    this.updateTeams(state, s)
    this.minimap.render(dt)
  }

  private updatePlayer(s: ShipStateSchema): void {
    const stats = parse<Record<string, number>>(s.statsJson, {})
    const power = Object.values(stats).reduce((a, b) => a + b, 0)
    this.el.pcLevel.textContent = `NV ${s.equipLevel}`
    if (this.el.pcName.textContent !== s.name) this.el.pcName.textContent = s.name
    this.el.pcPower.textContent = String(power)
    const frac = Math.max(0, Math.min(1, s.hp / Math.max(1, s.maxHp)))
    this.el.hpFill.style.width = `${frac * 100}%`
    this.el.hpGhost.style.width = `${frac * 100}%`
    this.el.hpText.textContent = `${Math.ceil(Math.max(0, s.hp))} / ${Math.round(s.maxHp)}`
    this.el.hpBar.classList.toggle('mid', frac <= 0.5 && frac > 0.25)
    this.el.hpBar.classList.toggle('low', frac <= 0.25)

    if (s.coins !== this.lastCoins) {
      if (this.lastCoins >= 0) {
        const diff = s.coins - this.lastCoins
        const d = this.el.coinsDelta
        d.textContent = diff > 0 ? `+${diff}` : String(diff)
        d.classList.toggle('neg', diff < 0)
        d.classList.remove('show')
        void d.offsetWidth
        d.classList.add('show')
        const wrap = this.el.coins.parentElement!
        wrap.classList.remove('bump')
        void wrap.offsetWidth
        wrap.classList.add('bump')
      }
      this.lastCoins = s.coins
      this.el.coins.textContent = fmt(s.coins)
    }

    const cur = xpForEquipLevel(s.equipLevel)
    const next = xpForEquipLevel(s.equipLevel + 1)
    const xpFrac = Math.max(0, Math.min(1, (s.equipXp - cur) / Math.max(1, next - cur)))
    this.el.xpFill.style.width = `${xpFrac * 100}%`
    this.el.xpLevel.textContent = `Nv ${s.equipLevel}`
    this.el.xpNext.textContent =
      s.equipLevel >= 16 ? 'Máx.' : `${fmt(s.equipXp - cur)} / ${fmt(next - cur)} XP`
    this.el.xpBar.classList.toggle('ready', s.equipPicks > 0)
  }

  private updateStats(s: ShipStateSchema): void {
    const key = `${s.statsJson}|${s.coins}|${s.alive}`
    if (key === this.statKey) return
    this.statKey = key
    const stats = parse<Record<string, number>>(s.statsJson, {})
    const total = Object.values(stats).reduce((a, b) => a + b, 0)
    this.el.statsTitle.innerHTML = `<b>${total}</b>/${TOTAL_STAT_POINTS_CAP}`
    for (const id of STAT_ORDER) {
      const row = this.statRows.get(id)!
      const lv = stats[id] ?? 0
      const cost = statUpgradeCost(lv)
      row.querySelectorAll('.pips i').forEach((p, i) => p.classList.toggle('on', i < lv))
      const costEl = row.querySelector('.st-cost')!
      const maxed = lv >= 15
      costEl.textContent = maxed ? 'MÁX' : total >= TOTAL_STAT_POINTS_CAP ? '—' : `${cost}`
      row.classList.toggle('maxed', maxed)
      row.classList.toggle('can', s.alive && !maxed && total < TOTAL_STAT_POINTS_CAP && s.coins >= cost)
      row.setAttribute(
        'aria-disabled',
        String(!s.alive || maxed || total >= TOTAL_STAT_POINTS_CAP || s.coins < cost),
      )
    }
  }

  private updateSlotsAndTray(s: ShipStateSchema): void {
    const equip = parse<Partial<Record<SlotId, { branchId: string; tierId: string }>>>(s.equipJson, {})
    let pendingSlot: SlotId | null = null
    for (const slot of SLOT_ORDER) {
      const el = this.slotEls.get(slot)!
      const unlocked = s.equipLevel >= SLOT_UNLOCK_LEVEL[slot]
      const eq = equip[slot]
      const options = unlocked ? equipOptionsForSlot(slot, eq) : []
      const pending = s.alive && s.equipPicks > 0 && options.length > 0
      if (pending && !pendingSlot) pendingSlot = slot
      el.classList.toggle('filled', !!eq)
      el.classList.toggle('locked', !unlocked)
      el.classList.toggle('pending', pending)
      const nameEl = el.querySelector('.sl-name')!
      const tiersEl = el.querySelector('.sl-tiers')!
      if (eq) {
        const branch = findBranch(slot, eq.branchId)
        const tier = findTier(slot, eq.branchId, eq.tierId)
        nameEl.textContent = tier?.name ?? '—'
        const depth = tier?.tier ?? 1
        const maxDepth = Math.max(...(branch?.tiers.map((t) => t.tier) ?? [1]))
        const html = Array.from(
          { length: maxDepth },
          (_, i) => `<i class="${i < depth ? 'on' : ''}"></i>`,
        ).join('')
        if (tiersEl.innerHTML !== html) tiersEl.innerHTML = html
      } else {
        nameEl.textContent = unlocked
          ? slot === 'deck'
            ? 'Cañoncito'
            : 'Sin elegir'
          : `Nivel ${SLOT_UNLOCK_LEVEL[slot]}`
        if (tiersEl.innerHTML !== '') tiersEl.innerHTML = ''
      }
      el.querySelector('.sl-icon')!.innerHTML = unlocked ? ICON[slot] : ICON.lock
    }

    const deferred = this.equipDeferredAt >= 0 && this.equipDeferredAt === s.equipPicks
    if (!pendingSlot || deferred) {
      this.hideTray()
      if (!pendingSlot) this.equipKey = ''
      return
    }
    const options = equipOptionsForSlot(pendingSlot, equip[pendingSlot])
    const key = `${pendingSlot}|${options.map((o) => o.tier.id).join(',')}`
    if (key === this.equipKey && this.el.tray.classList.contains('show')) return
    this.equipKey = key
    this.equipOpts = options.map((o) => ({ slot: pendingSlot!, ...o }))
    const first = !equip[pendingSlot]
    this.el.trayTitle.textContent = first
      ? `Elige arma: ${SLOT_NAMES[pendingSlot]}`
      : `Mejora: ${SLOT_NAMES[pendingSlot]}`
    this.el.traySub.textContent = first
      ? 'La rama elegida es permanente en esta vida'
      : s.equipPicks > 1
        ? `${s.equipPicks} mejoras pendientes`
        : ''
    this.el.trayOpts.innerHTML = this.trayCards(s, equip, pendingSlot, first)
    this.el.trayOpts.querySelectorAll<HTMLButtonElement>('.et-opt').forEach((b) => {
      const i = Number(b.dataset.i)
      b.addEventListener('click', () => this.pickEquip(i))
      b.addEventListener('pointerenter', (ev) => {
        if (ev.pointerType === 'mouse') this.view.previewEquip(this.trayLoadouts[i] ?? null)
      })
      b.addEventListener('pointerleave', () => this.view.previewEquip(null))
    })
    this.el.tray.classList.add('show')
  }

  /**
   * Tarjetas compactas: miniatura ampliada sobre la zona donde va la pieza, nombre y qué hace.
   * Al pasar el ratón, tu barco la muestra montada y la cámara se acerca (GameView.previewEquip).
   */
  private trayCards(s: ShipStateSchema, equip: EquipMap, slot: SlotId, first: boolean): string {
    this.trayLoadouts = this.equipOpts.map(
      (o) => ({ ...equip, [slot]: { branchId: o.branch.id, tierId: o.tier.id } }) as EquipMap,
    )
    return this.equipOpts
      .map((o, i) => {
        const thumb = this.view.loadoutThumb(this.trayLoadouts[i], s.statsJson, s.skin, s.team, true)
        const what = first ? o.branch.description : o.tier.blurb
        return `<button class="et-opt" data-i="${i}">
          <span class="eo-thumb" data-slot="${slot}">${thumb ? `<img src="${thumb}" alt="" draggable="false">` : ''}</span>
          <span class="eo-text">
            <span class="eo-name">${esc(o.tier.name)}${!first ? `<small>Nv ${o.tier.tier}</small>` : ''}</span>
            <span class="eo-blurb">${esc(what)}</span>
          </span>
          <kbd>${EQUIP_KEYS[i]?.toUpperCase() ?? ''}</kbd>
        </button>`
      })
      .join('')
  }

  private hideTray(): void {
    this.el.tray.classList.remove('show')
    this.view.previewEquip(null)
  }

  private updateFleet(s: ShipStateSchema, state: RoomStateSchema): void {
    const byType: Record<string, number> = {}
    let light = 0
    let heavy = 0
    state.fleet.forEach((f) => {
      if (f.ownerShipId !== this.myId) return
      byType[f.defId] = (byType[f.defId] ?? 0) + 1
      if (findFleetDef(f.defId)?.fleetClass === 'heavy') heavy++
      else light++
    })
    for (const def of FLEET_SHIPS) {
      const b = this.fleetBtns.get(def.id)!
      const count = byType[def.id] ?? 0
      const limit = fleetTypeLimit(def.id)
      const classFull = def.fleetClass === 'light' ? light >= MAX_LIGHT_FLEET : heavy >= MAX_HEAVY_FLEET
      const full = count >= limit || classFull
      b.classList.toggle('full', full)
      b.classList.toggle('can', s.alive && !full && s.coins >= def.cost)
      b.setAttribute('aria-disabled', String(!s.alive || full || s.coins < def.cost))
      const c = b.querySelector('.fb-count')!
      const txt = count > 0 ? `${count}/${limit}` : ''
      if (c.textContent !== txt) c.textContent = txt
    }
  }

  private updateLeaderboard(state: RoomStateSchema): void {
    const list: { id: string; name: string; score: number; team: string }[] = []
    state.ships.forEach((s, id) => list.push({ id, name: s.name, score: s.score, team: s.team }))
    list.sort((a, b) => b.score - a.score)
    const top = list.slice(0, 10)
    const myRank = list.findIndex((x) => x.id === this.myId)
    const rows = top.map((x, i) => ({ ...x, rank: i + 1 }))
    if (myRank >= 10) rows.push({ ...list[myRank], rank: myRank + 1 })
    const key =
      rows.map((r) => `${r.id}:${r.score}`).join('|') + state.playerCount + Math.round(this.conn.rtt / 10)
    if (key === this.lbKey) return
    this.lbKey = key
    this.el.lb.innerHTML = rows
      .map(
        (r, i) =>
          `${i === 10 ? '<li class="sep">···</li>' : ''}<li class="${r.id === this.myId ? 'me' : ''} ${r.team}"><span class="rk">${r.rank}</span><span class="nm">${esc(r.name)}</span><span class="sc">${fmt(r.score)}</span></li>`,
      )
      .join('')
    this.el.pop.innerHTML = `<span>${ICON.users}<b>${state.playerCount}</b> jugando</span><span>${ICON.wifi}<b>${Math.round(this.conn.rtt)}</b> ms</span>`
  }

  private updateBossBar(state: RoomStateSchema): void {
    const pos = this.view.myPosition()
    let best: { name: string; frac: number; chase: boolean; d: number } | null = null
    state.bosses.forEach((b) => {
      if (!b.alive) return
      const d = Math.hypot(b.x - pos.x, b.y - pos.y)
      const def = findBossDef(b.archetype)
      const near = def.kind === 'fort' ? def.guardRadius + 150 : 950
      if (d < near && (!best || d < best.d))
        best = { name: def.name, frac: b.hp / Math.max(1, b.maxHp), chase: b.state === 'chase', d }
    })
    const bar = this.el.bossBar
    if (!best) {
      bar.classList.remove('show')
      return
    }
    const b = best as { name: string; frac: number; chase: boolean }
    bar.classList.add('show')
    if (this.el.bossName.textContent !== b.name) this.el.bossName.textContent = b.name
    this.el.bossFill.style.width = `${b.frac * 100}%`
    this.el.bossState.textContent = b.chase ? 'En combate' : 'Vigilando'
    this.el.bossState.classList.toggle('chase', b.chase)
  }

  private updateTeams(state: RoomStateSchema, s: ShipStateSchema | undefined): void {
    const tdm = state.mode === 'tdm'
    this.el.teamScore.classList.toggle('show', tdm)
    if (!tdm) return
    this.el.tsRed.textContent = String(state.scoreRed)
    this.el.tsBlue.textContent = String(state.scoreBlue)
    this.el.tsRed.classList.toggle('mine', s?.team === 'red')
    this.el.tsBlue.classList.toggle('mine', s?.team === 'blue')
  }

  private updateDeath(s: ShipStateSchema): void {
    if (!s.alive && this.lastAlive) {
      this.deathShownAt = performance.now()
      this.el.dBy.innerHTML = `Hundido por <b>${esc(s.killedByName || 'el mar')}</b>`
      const lifeMs = Math.max(0, s.respawnAt - 2000 - s.lifeStartedAt)
      const m = Math.floor(lifeMs / 60000)
      const sec = Math.floor((lifeMs % 60000) / 1000)
      this.el.dTime.textContent = `${m}:${String(sec).padStart(2, '0')}`
      this.el.dScore.textContent = fmt(s.score)
      this.el.dKills.textContent = String(s.kills)
      this.el.dLevel.textContent = String(s.equipLevel)
      const tips = [
        'Los cañones de costado disparan de lado: gira para poner al enemigo en tu través.',
        'Comprar Casco también te cura al instante: úsalo como botiquín.',
        'Un Pesquero de la flota recoge monedas por ti mientras combates.',
        'Las minas castigan a quien te persigue. Úsalas al huir.',
        'No puedes maximizarlo todo: 75 puntos para 8 estadísticas. Especialízate.',
        'Los jefes solo disparan el costado que te mira. Colócate en su proa o su popa.',
      ]
      this.el.dTip.textContent = tips[Math.floor(Math.random() * tips.length)]
      this.el.death.classList.add('show')
      this.hideTray()
    }
    if (s.alive && !this.lastAlive) this.el.death.classList.remove('show')
    this.lastAlive = s.alive
    if (!s.alive) {
      const remaining = Math.max(0, s.respawnAt - this.view.serverTime)
      const btn = this.el.dBtn as HTMLButtonElement
      btn.disabled = remaining > 0
      btn.textContent = remaining > 0 ? `Zarpar de nuevo (${Math.ceil(remaining / 1000)})` : 'Zarpar de nuevo'
    }
  }

  private updateTutorial(s: ShipStateSchema, dt: number): void {
    if (this.tutorialIndex >= TUTORIAL.length || !s.alive) {
      this.el.hint.classList.remove('show')
      return
    }
    const step = TUTORIAL[this.tutorialIndex]
    if (step.id === 'fire') {
      this.tutorialFireTimer += dt
      if (this.tutorialFireTimer > 9) {
        this.tutorialIndex++
        saveSettings({ tutorialDone: true })
        return
      }
    } else if (step.done(s)) {
      this.tutorialIndex++
      return
    }
    if (step.id === 'equip' && s.equipPicks === 0) {
      this.el.hint.classList.remove('show')
      return
    }
    const text = this.input.touch ? step.touchText : step.text
    if (this.el.hintText.innerHTML !== text) this.el.hintText.innerHTML = text
    this.el.hint.classList.add('show')
  }
}
