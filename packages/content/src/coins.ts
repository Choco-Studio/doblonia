export type CoinKind = 'bronze' | 'silver' | 'gold' | 'ruby' | 'diamond' | 'emerald' | 'chest'

export interface CoinDef {
  kind: CoinKind
  value: number
  centerOnly: boolean
  color: number
  radius: number
}

export const COIN_DEFS: Record<CoinKind, CoinDef> = {
  bronze: { kind: 'bronze', value: 10, centerOnly: false, color: 0xb87333, radius: 6 },
  silver: { kind: 'silver', value: 20, centerOnly: false, color: 0xc7ccd6, radius: 6.5 },
  gold: { kind: 'gold', value: 30, centerOnly: false, color: 0xf4c430, radius: 7 },
  ruby: { kind: 'ruby', value: 50, centerOnly: true, color: 0xe0115f, radius: 8 },
  diamond: { kind: 'diamond', value: 100, centerOnly: true, color: 0x7fd3f4, radius: 8.5 },
  emerald: { kind: 'emerald', value: 500, centerOnly: true, color: 0x2ecc71, radius: 11 },
  chest: { kind: 'chest', value: 150, centerOnly: false, color: 0xd9a44a, radius: 14 },
}

export const COMMON_COIN_KINDS: CoinKind[] = ['bronze', 'silver', 'gold']
export const CENTER_COIN_KINDS: CoinKind[] = ['ruby', 'diamond']
