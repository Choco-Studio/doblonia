import { settings, saveSettings, type Settings } from '../settings.js'
import { ICON } from './icons.js'
import { sound } from '../audio/Sound.js'

let open: HTMLDivElement | null = null
let restoreFocus: (() => void) | null = null

export function closeModal(): boolean {
  if (!open) return false
  open.remove()
  open = null
  restoreFocus?.()
  restoreFocus = null
  return true
}

export function isModalOpen(): boolean {
  return open !== null
}

export function shell(title: string, body: string, cls = ''): HTMLDivElement {
  closeModal()
  const back = document.createElement('div')
  back.className = 'modal-back'
  back.innerHTML = `
    <div class="modal panel ${cls}" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-head"><h3>${title}</h3><button class="modal-close" aria-label="Cerrar">${ICON.close}</button></div>
      ${body}
    </div>`
  back.addEventListener('pointerdown', (e) => {
    if (e.target === back) closeModal()
  })
  back.querySelector('.modal-close')!.addEventListener('click', () => {
    sound.play('click')
    closeModal()
  })
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const background = [...document.body.children].filter(
    (node): node is HTMLElement => node instanceof HTMLElement && !node.inert,
  )
  for (const node of background) node.inert = true
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      closeModal()
    } else if (event.key === 'Tab') {
      const focusable = [
        ...back.querySelectorAll<HTMLElement>(
          'button:not(:disabled):not([tabindex="-1"]), input:not(:disabled), a[href], [tabindex="0"]',
        ),
      ].filter((node) => node.getClientRects().length > 0)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }
  window.addEventListener('keydown', onKey, true)
  restoreFocus = () => {
    window.removeEventListener('keydown', onKey, true)
    for (const node of background) node.inert = false
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  }
  document.body.appendChild(back)
  open = back
  back.querySelector<HTMLButtonElement>('.modal-close')?.focus({ preventScroll: true })
  return back
}

export function openSettings(): void {
  const sliders: [keyof Settings, string][] = [
    ['masterVolume', 'Volumen general'],
    ['sfxVolume', 'Efectos'],
    ['ambientVolume', 'Ambiente (oleaje)'],
  ]
  const toggles: [keyof Settings, string][] = [
    ['screenShake', 'Temblor de cámara'],
    ['reduceEffects', 'Reducir partículas'],
    ['damageNumbers', 'Números de daño'],
    ['showNames', 'Nombres sobre los barcos'],
  ]
  const body = `
    <div>
      ${sliders.map(([k, label]) => `<label class="set-row"><span>${label}</span><input type="range" min="0" max="1" step="0.05" data-k="${k}" value="${settings[k]}" /></label>`).join('')}
      ${toggles.map(([k, label]) => `<div class="set-row"><span>${label}</span><button class="toggle ${settings[k] ? 'on' : ''}" data-k="${k}" aria-label="${label}" aria-pressed="${!!settings[k]}"></button></div>`).join('')}
    </div>
    <p class="help-text" style="font-size:11.5px;color:var(--ink-3)">Las preferencias se guardan solo en este navegador.</p>`
  const m = shell('Ajustes', body)
  m.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((el) => {
    el.addEventListener('input', () =>
      saveSettings({ [el.dataset.k!]: Number(el.value) } as Partial<Settings>),
    )
  })
  m.querySelectorAll<HTMLButtonElement>('.toggle').forEach((el) => {
    el.addEventListener('click', () => {
      const k = el.dataset.k as keyof Settings
      const v = !settings[k]
      saveSettings({ [k]: v } as Partial<Settings>)
      el.classList.toggle('on', v)
      el.setAttribute('aria-pressed', String(v))
      sound.play('click')
    })
  })
}

export function openHelp(): void {
  const body = `
    <div class="touch-help"><h4>Controles táctiles</h4><p class="help-text">Usa el mando izquierdo para gobernar el barco. Arrastra el derecho para apuntar y disparar. <b>AUTO</b> mantiene el fuego y el botón del doblón lanza una moneda (cuesta 10). Abre <b>Mejoras</b>, <b>Flota</b> o <b>Menú</b> desde la barra superior.</p></div>
    <div class="keyboard-help">
    <h4>Controles</h4>
    <div class="help-grid">
      <div><kbd>W</kbd><kbd>S</kbd></div><span>Acelerar y frenar (el barco tiene inercia)</span>
      <div><kbd>A</kbd><kbd>D</kbd></div><span>Girar el timón</span>
      <div><kbd>Ratón</kbd></div><span>Apuntar las torretas de cubierta</span>
      <div><kbd>Clic</kbd><kbd>Espacio</kbd></div><span>Disparar todas las armas</span>
      <div><kbd>E</kbd></div><span>Auto-disparo continuo</span>
      <div><kbd>F</kbd></div><span>Lanzar una moneda (cuesta 10)</span>
      <div><kbd>1</kbd>…<kbd>8</kbd></div><span>Mejorar estadísticas</span>
      <div><kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd><kbd>V</kbd><kbd>B</kbd></div><span>Elegir mejora de equipo cuando subes de nivel</span>
      <div><kbd>G</kbd></div><span>Astillero: árbol completo de armas</span>
      <div><kbd>9</kbd><kbd>0</kbd><kbd>T</kbd><kbd>Y</kbd></div><span>Contratar flota</span>
      <div><kbd>M</kbd></div><span>Silenciar</span>
    </div>
    </div><h4>Cómo se juega</h4>
    <p class="help-text">Recoge <b>doblones</b> para ganar monedas y experiencia. Con las monedas compras <b>8 estadísticas</b> (máximo 15 por estadística y <b>75 puntos</b> en total: no puedes tenerlo todo). Con la experiencia subes de nivel y desbloqueas los <b>4 puestos de armas</b>: Proa (nivel 2), Costados (3), Cubierta (4) y Popa (5). La primera elección de cada puesto es <b>permanente</b> durante esa vida.</p>
    <p class="help-text">Los cañones de costado disparan de lado: pon al enemigo en tu través. El centro del mapa tiene rubíes y diamantes, pero lo guardan tres <b>jefes</b>. Hundir uno da una gran recompensa. La <b>esmeralda</b> (500) cambia de lugar: el minimapa marca su zona.</p>
    <p class="help-text">Hay armas con efectos: la <b>palanqueta</b> rompe el aparejo y ralentiza, el <b>fuego griego</b> y el <b>aceite</b> queman durante unos segundos, y el <b>mortero</b> cae justo donde apunta el ratón. En las islas grandes hay <b>fuertes</b> con cañones que protegen su costa, a la deriva aparecen <b>cofres</b> (150) y los <b>remolinos</b> te arrastran hacia su centro, que hace daño.</p>
    <p class="help-text">Contrata una <b>flota</b> de hasta 3 barcos ligeros y 1 pesado. Al hundirte lo pierdes todo y reapareces desde cero, con unos segundos de protección que se rompen al disparar, embestir o recoger monedas.</p>`
  shell('Cómo jugar', body)
}
