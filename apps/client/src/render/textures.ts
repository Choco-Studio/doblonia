// Procedural artwork, grouped by the resources each renderer owns.
export { TEX_SCALE, type Tex, hex, shade, mulberry32 } from './textures/shared.js'
export { glowTex, smokeTex, foamTex, sparkTex, ringTex, plankTex, cannonballTex } from './textures/effects.js'
export { waterBaseTex, waterWavesTex, vignetteTex, damageVignetteTex } from './textures/water.js'
export { type IslandCircle, islandTex, shoreFoamTex } from './textures/islands.js'
export {
  HULL_LENGTH,
  HULL_BEAM,
  type HullPalette,
  paletteFromSkin,
  hullTex,
  hullShadowTex,
  sailTex,
  flagTex,
  sideCannonTex,
  oarTex,
  ramTex,
  rudderTex,
  mineRackTex,
  turretTex,
} from './textures/ships.js'
export {
  mineTex,
  streakTex,
  chainShotTex,
  fireballTex,
  targetMarkerTex,
  oilTex,
} from './textures/ordnance.js'
export { coinTex, chestTex } from './textures/treasure.js'
export {
  whirlpoolTex,
  whirlFunnelTex,
  whirlArmsTex,
  whirlRimTex,
  fortTex,
  flagPoleTex,
  cloudShadowTex,
  gullTex,
  gullShadowTex,
  buoyTex,
  sunGlintTex,
} from './textures/world.js'
