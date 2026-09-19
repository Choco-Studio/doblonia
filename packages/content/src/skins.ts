/** Skins puramente cosméticas. Todas disponibles desde el inicio, sin coste ni ventaja. */
export interface SkinDef {
  id: string
  name: string
  hull: number
  hullDark: number
  deck: number
  sail: number
  trim: number
}

export const SKINS: SkinDef[] = [
  {
    id: 'roble',
    name: 'Roble',
    hull: 0x9a5b32,
    hullDark: 0x5e341b,
    deck: 0xd9b27c,
    sail: 0xf4ead2,
    trim: 0xe0a64a,
  },
  {
    id: 'corsario',
    name: 'Corsario',
    hull: 0x2b2b33,
    hullDark: 0x15151a,
    deck: 0x8c7a62,
    sail: 0x1c1c22,
    trim: 0xd9c27a,
  },
  {
    id: 'real',
    name: 'Armada Real',
    hull: 0x1f4f8f,
    hullDark: 0x0f2c55,
    deck: 0xd8c39a,
    sail: 0xf7f3e6,
    trim: 0xf0c14b,
  },
  {
    id: 'coral',
    name: 'Coral',
    hull: 0xc4553f,
    hullDark: 0x7a2c1f,
    deck: 0xf0cfa6,
    sail: 0xfff1e0,
    trim: 0xffd27a,
  },
  {
    id: 'esmeralda',
    name: 'Esmeralda',
    hull: 0x1f7a58,
    hullDark: 0x0f4531,
    deck: 0xcfd9a8,
    sail: 0xf0f7e8,
    trim: 0xe8d27a,
  },
  {
    id: 'hueso',
    name: 'Hueso',
    hull: 0xd8cfb8,
    hullDark: 0x958a70,
    deck: 0x6b5a45,
    sail: 0x3a3228,
    trim: 0xb03a2e,
  },
  {
    id: 'purpura',
    name: 'Púrpura Imperial',
    hull: 0x5b2f7a,
    hullDark: 0x341845,
    deck: 0xd9c0a0,
    sail: 0xf5ecf8,
    trim: 0xf0c14b,
  },
  {
    id: 'fantasma',
    name: 'Fantasma',
    hull: 0x6f8f96,
    hullDark: 0x3c5359,
    deck: 0xa9c1c6,
    sail: 0xdff2f5,
    trim: 0x9ff0ff,
  },
]

export const DEFAULT_SKIN = 'roble'

export function findSkin(id: string | undefined): SkinDef {
  return SKINS.find((s) => s.id === id) ?? SKINS[0]
}

export type TeamId = '' | 'red' | 'blue'

export const TEAM_COLORS: Record<'red' | 'blue', { name: string; color: number; sail: number }> = {
  red: { name: 'Carmesí', color: 0xd9433a, sail: 0xf2c9c2 },
  blue: { name: 'Cobalto', color: 0x2f7fd9, sail: 0xc6dcf5 },
}
