import { DEFAULT_SKIN, SKINS } from '@doblonia/content'

/** Preferencias locales del jugador. Solo comodidades de este navegador: nunca estado de juego. */
export interface Settings {
  masterVolume: number
  sfxVolume: number
  ambientVolume: number
  reduceEffects: boolean
  screenShake: boolean
  damageNumbers: boolean
  showNames: boolean
  name: string
  skin: string
  mode: 'ffa' | 'tdm'
  tutorialDone: boolean
}

const KEY = 'doblonia.settings.v1'

const DEFAULTS: Settings = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  ambientVolume: 0.5,
  reduceEffects: false,
  screenShake: true,
  damageNumbers: true,
  showNames: true,
  name: '',
  skin: DEFAULT_SKIN,
  mode: 'ffa',
  tutorialDone: false,
}

export function validateSettings(raw: unknown, defaults: Settings = DEFAULTS): Settings {
  const result = { ...defaults }
  if (!raw || typeof raw !== 'object') return result
  const saved = raw as Record<string, unknown>
  for (const key of ['masterVolume', 'sfxVolume', 'ambientVolume'] as const) {
    const value = saved[key]
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.max(0, Math.min(1, value))
  }
  for (const key of ['reduceEffects', 'screenShake', 'damageNumbers', 'showNames', 'tutorialDone'] as const) {
    if (typeof saved[key] === 'boolean') result[key] = saved[key]
  }
  if (typeof saved.name === 'string') result.name = saved.name.slice(0, 16)
  if (typeof saved.skin === 'string' && SKINS.some((skin) => skin.id === saved.skin)) result.skin = saved.skin
  if (saved.mode === 'ffa' || saved.mode === 'tdm') result.mode = saved.mode
  return result
}

function load(): Settings {
  const defaults = { ...DEFAULTS }
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    defaults.screenShake = false
    defaults.reduceEffects = true
  }
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? validateSettings(JSON.parse(raw), defaults) : defaults
  } catch {
    return defaults
  }
}

export const settings: Settings = load()

const listeners = new Set<() => void>()

export function saveSettings(patch: Partial<Settings>): void {
  Object.assign(settings, validateSettings(patch, settings))
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // almacenamiento no disponible (modo privado): se mantiene solo en memoria
  }
  for (const l of listeners) l()
}

export function onSettingsChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
