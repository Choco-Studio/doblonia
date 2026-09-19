import {
  BRANCHES_BY_SLOT,
  SLOT_NAMES,
  SLOT_ORDER,
  SLOT_UNLOCK_LEVEL,
  equipOptionsForSlot,
  type SlotId,
  type WeaponBranch,
  type WeaponTier,
} from '@doblonia/content'
import type { ShipStateSchema } from '@doblonia/protocol'
import type { GameView } from '../render/GameView.js'
import { ICON } from './icons.js'
import { shell, closeModal } from './Modals.js'
import { tierTags, type EquipMap } from './loadoutMetrics.js'
import { sound } from '../audio/Sound.js'

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

/** Nodos desde la raíz de la rama hasta `tierId` (el camino ya recorrido). */
function pathTo(branch: WeaponBranch, tierId: string): Set<string> {
  const byId = new Map(branch.tiers.map((t) => [t.id, t]))
  const walk = (t: WeaponTier, acc: string[]): string[] | null => {
    const here = [...acc, t.id]
    if (t.id === tierId) return here
    for (const n of t.nextIds ?? []) {
      const nt = byId.get(n)
      const r = nt && walk(nt, here)
      if (r) return r
    }
    return null
  }
  return new Set(walk(branch.tiers[0], []) ?? [])
}

export interface ShipyardDeps {
  view: GameView
  ship: () => ShipStateSchema | undefined
  pick: (slot: SlotId, branchId: string, tierId: string) => void
}

/**
 * Astillero: árbol completo de armas por puesto, con miniaturas del barco,
 * el camino ya elegido y las mejoras disponibles ahora (clic para elegirlas).
 */
export function openShipyard(deps: ShipyardDeps, initial?: SlotId): void {
  const s = deps.ship()
  const start =
    initial ??
    SLOT_ORDER.find(
      (sl) =>
        s &&
        s.equipPicks > 0 &&
        equipOptionsForSlot(sl, parse<EquipMap>(s.equipJson, {})[sl]).length > 0 &&
        s.equipLevel >= SLOT_UNLOCK_LEVEL[sl],
    ) ??
    'deck'
  const tabs = SLOT_ORDER.map(
    (sl) =>
      `<button class="sy-tab" data-slot="${sl}">${ICON[sl]}<span>${SLOT_NAMES[sl]}</span><small>Nv ${SLOT_UNLOCK_LEVEL[sl]}</small></button>`,
  ).join('')
  const m = shell(
    'Astillero',
    `<div class="sy-tabs">${tabs}</div><div class="sy-body"></div><p class="sy-legend"><span class="lg owned"></span>Tu camino <span class="lg next"></span>Disponible ahora <span class="lg closed"></span>Rama descartada</p>`,
    'shipyard',
  )
  const body = m.querySelector('.sy-body') as HTMLElement

  const render = (slot: SlotId): void => {
    m.querySelectorAll<HTMLButtonElement>('.sy-tab').forEach((b) => {
      b.classList.toggle('sel', b.dataset.slot === slot)
      b.setAttribute('aria-pressed', String(b.dataset.slot === slot))
    })
    const ship = deps.ship()
    const equip = parse<EquipMap>(ship?.equipJson ?? '{}', {})
    const cur = equip[slot]
    const unlocked = !!ship && ship.equipLevel >= SLOT_UNLOCK_LEVEL[slot]
    const canPick = !!ship && ship.alive && ship.equipPicks > 0 && unlocked
    const available = new Set(canPick ? equipOptionsForSlot(slot, cur).map((o) => o.tier.id) : [])
    const skin = ship?.skin ?? ''
    const team = ship?.team ?? ''

    const cols = BRANCHES_BY_SLOT[slot].map((branch) => {
      const chosen = cur?.branchId === branch.id
      const closed = !!cur && !chosen
      const owned = chosen ? pathTo(branch, cur!.tierId) : new Set<string>()
      const depth = Math.max(...branch.tiers.map((t) => t.tier))
      const rows: string[] = []
      for (let d = 1; d <= depth; d++) {
        const nodes = branch.tiers
          .filter((t) => t.tier === d)
          .map((t) => {
            const state = owned.has(t.id)
              ? t.id === cur?.tierId
                ? 'owned current'
                : 'owned'
              : available.has(t.id)
                ? 'next'
                : closed
                  ? 'closed'
                  : ''
            const thumb = deps.view.loadoutThumb(
              { [slot]: { branchId: branch.id, tierId: t.id } },
              '{}',
              skin,
              team,
              true,
            )
            const tags = tierTags(t)
              .slice(0, 2)
              .map((tg) => `<span class="${tg.cls}">${esc(tg.text)}</span>`)
              .join('')
            return `<button class="sy-node ${state}" data-branch="${branch.id}" data-tier="${t.id}" title="${esc(t.blurb)}" ${state.includes('next') ? '' : 'tabindex="-1"'}>
            <span class="sy-thumb" data-slot="${slot}">${thumb ? `<img src="${thumb}" alt="" draggable="false">` : ''}</span>
            <span class="sy-name">${esc(t.name)}</span>
            <span class="sy-tags">${tags}</span>
          </button>`
          })
        rows.push(`<div class="sy-row">${nodes.join('')}</div>`)
      }
      return `<div class="sy-col ${chosen ? 'chosen' : ''} ${closed ? 'closed' : ''}">
        <div class="sy-branch"><b>${esc(branch.name)}</b><span>${esc(branch.description)}</span></div>
        ${rows.join('<div class="sy-link"></div>')}
      </div>`
    })
    const note = !unlocked
      ? `<p class="sy-note">${ICON.lock} Este puesto se abre al llegar al nivel ${SLOT_UNLOCK_LEVEL[slot]}.</p>`
      : canPick && available.size > 0
        ? `<p class="sy-note ok">${ICON.star} Tienes ${ship!.equipPicks} mejora${ship!.equipPicks > 1 ? 's' : ''} pendiente${ship!.equipPicks > 1 ? 's' : ''}: haz clic en una casilla dorada.</p>`
        : !cur
          ? `<p class="sy-note">La primera rama que elijas en ${SLOT_NAMES[slot]} es permanente durante esta vida.</p>`
          : ''
    const depth = Math.max(...BRANCHES_BY_SLOT[slot].flatMap((branch) => branch.tiers.map((t) => t.tier)))
    body.innerHTML = `${note}<p class="sy-swipe-hint">Desliza para explorar las ramas →</p><div class="sy-cols" style="--cols:${cols.length};--rows:${depth * 2}">${cols.join('')}</div>`
    body.querySelectorAll<HTMLButtonElement>('.sy-node.next').forEach((b) =>
      b.addEventListener('click', () => {
        deps.pick(slot, b.dataset.branch!, b.dataset.tier!)
        closeModal()
      }),
    )
  }

  m.querySelectorAll<HTMLButtonElement>('.sy-tab').forEach((b) =>
    b.addEventListener('click', () => {
      sound.play('click')
      render(b.dataset.slot as SlotId)
    }),
  )
  render(start)
}
