/** Iconos SVG propios (24×24, currentColor). Sin emojis: se ven igual en todos los sistemas. */
const svg = (body: string, extra = '') =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`

export const ICON = {
  coin: `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><defs><radialGradient id="cg" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff3b0"/><stop offset=".55" stop-color="#f4c430"/><stop offset="1" stop-color="#8f6508"/></radialGradient></defs><circle cx="12" cy="12" r="10" fill="url(#cg)" stroke="#6b4a06" stroke-width="1.2"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff7d0" stroke-opacity=".5"/><path d="M12 8v8M9.5 10h5M8.5 13.5q3.5 4 7 0" fill="none" stroke="#7a5608" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  heart: svg(
    '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor" stroke="none"/>',
  ),
  anchor: svg('<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8M5 14a7 7 0 0 0 14 0"/>'),
  skull: svg(
    '<path d="M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4.1 3 5.1V18h8v-2.9c1.8-1 3-2.7 3-5.1a7 7 0 0 0-7-7z"/><circle cx="9.3" cy="10.5" r="1.4" fill="currentColor"/><circle cx="14.7" cy="10.5" r="1.4" fill="currentColor"/><path d="M10 18v3M14 18v3"/>',
  ),
  crown: svg('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="currentColor" fill-opacity=".25"/>'),
  swords: svg(
    '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 17.5L21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4M5 21l-2-2"/>',
  ),
  shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  ship: svg('<path d="M3 16l2 4h14l2-4zM12 3v13M12 4l6 9h-6M12 6L7 13h5"/>'),
  sound: svg(
    '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" fill-opacity=".2"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  ),
  mute: svg(
    '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" fill-opacity=".2"/><path d="M17 9l5 6M22 9l-5 6"/>',
  ),
  gear: svg(
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  ),
  expand: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  target: svg(
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  ),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  trophy: svg(
    '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  ),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  star: svg(
    '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor" fill-opacity=".25"/>',
  ),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  users: svg(
    '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-4-5.6"/>',
  ),
  wifi: svg('<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01"/>'),
  // Estadísticas
  hull: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" fill="currentColor" fill-opacity=".2"/>'),
  repair: svg(
    '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  ),
  range: svg(
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  ),
  damage: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor" fill-opacity=".25"/>'),
  reload: svg('<path d="M20 11A8 8 0 1 0 17.7 17M20 4v7h-7"/>'),
  speed: svg('<path d="M3 12h9M5 7h7M5 17h7M14 5l7 7-7 7"/>'),
  turn: svg('<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/>'),
  ram: svg('<path d="M3 12h11l7-7v14l-7-7" fill="currentColor" fill-opacity=".2"/>'),
  // Slots
  front: svg('<path d="M4 12h12M12 6l6 6-6 6"/>'),
  side: svg('<path d="M12 4v16M5 8h14M5 16h14"/>'),
  deck: svg('<circle cx="12" cy="12" r="5"/><path d="M12 7V2"/>'),
  rear: svg('<path d="M20 12H8M12 6l-6 6 6 6"/>'),
  // Estados y astillero
  fire: svg(
    '<path d="M12 3c.5 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.8 1.6-4 2.2-6 .9 1 1.3 2 1.3 3.2C12 9 12.6 6.5 12 3z" fill="currentColor" fill-opacity=".3"/>',
  ),
  chain: svg(
    '<rect x="2.5" y="9" width="10" height="6" rx="3"/><rect x="11.5" y="9" width="10" height="6" rx="3"/>',
  ),
  tree: svg(
    '<rect x="9" y="3" width="6" height="5" rx="1.2"/><rect x="3" y="16" width="6" height="5" rx="1.2"/><rect x="15" y="16" width="6" height="5" rx="1.2"/><path d="M12 8v4M6 16v-4h12v4"/>',
  ),
  // Flota
  fishing_boat: svg('<path d="M4 15l2 4h12l2-4zM12 5v10M12 6l5 8h-5"/><path d="M4 15c3-2 5-2 8 0"/>'),
  mine_dropper_fleet: svg(
    '<circle cx="12" cy="12" r="5" fill="currentColor" fill-opacity=".25"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  ),
  battleship: svg('<path d="M3 15l2 4h14l2-4zM8 15v-4h8v4M12 11V6M12 7h5"/>'),
  man_of_war: svg('<path d="M2 15l2 4h16l2-4zM7 15V5M12 15V3M17 15V5M7 6l3 5H7M12 4l4 7h-4M17 6l3 5h-3"/>'),
}

export function icon(name: keyof typeof ICON): string {
  return ICON[name]
}
