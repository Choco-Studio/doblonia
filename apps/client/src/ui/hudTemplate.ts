import { MAX_LIGHT_FLEET, MAX_HEAVY_FLEET, TOTAL_STAT_POINTS_CAP, TEAM_COLORS } from '@doblonia/content'
import { ICON } from './icons.js'

export function hudTemplate(): string {
  return `
    <nav class="mobile-actions" aria-label="Opciones de partida">
      <button class="btn-ghost" data-panel="stats" aria-controls="hud-stats" aria-expanded="false">${ICON.star}<span>Mejoras</span></button>
      <button class="btn-ghost" data-panel="fleet" aria-controls="hud-fleet" aria-expanded="false">${ICON.ship}<span>Flota</span></button>
      <button class="btn-ghost" data-panel="rank" aria-controls="hud-rank" aria-expanded="false">${ICON.trophy}<span>Rangos</span></button>
      <button class="btn-ghost" data-panel="menu" aria-controls="hud-menu" aria-expanded="false">${ICON.gear}<span>Menú</span></button>
    </nav>
    <div class="hud-tl">
      <div class="panel player-card">
        <div class="pc-top"><span class="pc-level" data-el="pcLevel">NV 1</span><span class="pc-name" data-el="pcName"></span><span class="pc-power">Poder <b data-el="pcPower">0</b>/${TOTAL_STAT_POINTS_CAP}</span></div>
        <div class="bar hp" data-el="hpBar"><div class="ghost" data-el="hpGhost"></div><div class="fill" data-el="hpFill"></div><span class="bar-text" data-el="hpText"></span></div>
        <div class="pc-coins">${ICON.coin}<b data-el="coins">0</b><span class="delta" data-el="coinsDelta"></span></div>
      </div>
      <div id="hud-stats" class="panel stats interactive"><div class="panel-title"><span>Mejoras</span><span data-el="statsTitle"></span><button class="drawer-close" data-act="close-panel" aria-label="Cerrar mejoras">${ICON.close}</button></div></div>
    </div>

    <div class="hud-tr">
      <div id="hud-menu" class="icon-row">
        <button class="icon-btn interactive" data-el="btnSound" title="Silenciar (M)"></button>
        <button class="icon-btn interactive" data-act="shipyard" title="Astillero (G)">${ICON.tree}</button>
        <button class="icon-btn interactive" data-act="help" title="Cómo jugar">${ICON.info}</button>
        <button class="icon-btn interactive" data-act="settings" title="Ajustes (Esc)">${ICON.gear}</button>
        <button class="icon-btn interactive" data-act="fullscreen" title="Pantalla completa">${ICON.expand}</button>
        <button class="icon-btn interactive" data-act="exit" title="Volver al puerto">${ICON.close}</button>
      </div>
      <div id="hud-rank" class="panel leaderboard"><div class="panel-title"><span>Clasificación</span>${ICON.trophy}<button class="drawer-close" data-act="close-panel" aria-label="Cerrar clasificación">${ICON.close}</button></div><ol class="lb" data-el="lb"></ol><div class="pop" data-el="pop"></div></div>
      <div class="killfeed"></div>
    </div>

    <div class="hud-tc">
      <div class="panel team-score" data-el="teamScore"><span class="ts red" data-el="tsRed">0</span><span class="vs">${TEAM_COLORS.red.name.toUpperCase()} · ${TEAM_COLORS.blue.name.toUpperCase()}</span><span class="ts blue" data-el="tsBlue">0</span></div>
      <div class="panel boss-bar" data-el="bossBar"><div class="bb-top"><span class="bb-name" data-el="bossName"></span><span class="bb-state" data-el="bossState"></span></div><div class="bar"><div class="fill" data-el="bossFill"></div></div></div>
      <div class="toasts" role="status" aria-live="polite"></div>
      <div class="panel hint interactive" data-el="hint">${ICON.info}<span data-el="hintText"></span><button title="Ocultar consejos">${ICON.close}</button></div>
    </div>

    <div class="hud-bc">
      <div class="status-chips"><span class="chip auto" data-el="chipAuto">${ICON.target} Auto-disparo</span><span class="chip shield" data-el="chipShield">${ICON.shield} Protegido</span><span class="chip burn" data-el="chipBurn">${ICON.fire} Ardiendo</span><span class="chip slow" data-el="chipSlow">${ICON.chain} Aparejo roto</span></div>
      <div class="panel equip-tray interactive" data-el="tray">
        <div class="et-head"><span class="et-title" data-el="trayTitle"></span><span class="et-sub" data-el="traySub"></span><button class="et-later" data-act="tree">${ICON.tree} Árbol</button><button class="et-later" data-act="later">Más tarde</button></div>
        <div class="et-options" data-el="trayOpts"></div>
      </div>
      <div class="slots"></div>
      <div class="panel xp-wrap"><span class="xp-level" data-el="xpLevel">Nv 1</span><div class="bar xp" data-el="xpBar"><div class="fill" data-el="xpFill"></div></div><span class="xp-next" data-el="xpNext"></span></div>
    </div>

    <div id="hud-fleet" class="hud-bl"><div class="panel fleet interactive"><div class="panel-title"><span>Flota</span><span>${MAX_LIGHT_FLEET} ligeros · ${MAX_HEAVY_FLEET} pesado</span><button class="drawer-close" data-act="close-panel" aria-label="Cerrar flota">${ICON.close}</button></div><div class="fleet-grid"></div></div></div>

    <div class="hud-br"><div class="panel minimap"><canvas></canvas><span class="compass">N</span></div><div class="coords" data-el="coords"></div></div>

    <div class="death" data-el="death">
      <div class="panel death-card">
        <div class="d-icon">${ICON.skull}</div>
        <h2>Tu barco se hundió</h2>
        <p class="d-by" data-el="dBy"></p>
        <div class="d-stats">
          <div class="d-stat">${ICON.clock}<b data-el="dTime">0:00</b><span>A flote</span></div>
          <div class="d-stat">${ICON.star}<b data-el="dScore">0</b><span>Puntos</span></div>
          <div class="d-stat">${ICON.swords}<b data-el="dKills">0</b><span>Bajas</span></div>
          <div class="d-stat">${ICON.anchor}<b data-el="dLevel">1</b><span>Nivel</span></div>
        </div>
        <p class="d-tip" data-el="dTip"></p>
        <button class="btn-primary" data-el="dBtn">Zarpar de nuevo</button>
      </div>
    </div>`
}
