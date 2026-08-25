export const WATCHLIST_SCHEMA = 'listco-value-desk.watchlist.v1'

export const TAM_VERDICTS = ['可行', '紧', '不可行'] as const
export type TamVerdict = (typeof TAM_VERDICTS)[number]

export type BandKey = 'falsified' | 'discount' | 'premium' | 'overshoot'

export interface TamRow {
  id: string
  label: string
  /** Implied share of the addressable market, stored as a decimal (0.187 === 18.7%). */
  share: number | null
  verdict: TamVerdict
}

export interface TriggerRow {
  id: string
  text: string
}

export interface Position {
  id: string
  ticker: string
  name: string
  exchange: string
  spot: number
  /** Entry cost per share. Null when the desk holds no position. */
  cost: number | null
  bear: number
  base: number
  bull: number
  /** Market cap over the DCF base case, as reported by the skill. */
  multiple: number | null
  /** Terminal value share of enterprise value, stored as a decimal. */
  tvEv: number | null
  /** Revenue the market price implies at the horizon year, in USD billions. */
  impliedRev: number | null
  horizonYear: string
  cagr: number | null
  grossMargin: number | null
  tam: TamRow[]
  triggers: TriggerRow[]
}

export interface HedgeItem {
  id: string
  title: string
  subtitle: string
  lines: string[]
}

export interface HedgeStrip {
  title: string
  note: string
  items: HedgeItem[]
}

export interface Watchlist {
  schema: string
  skill: string
  version: string
  title: string
  asOf: string
  priceAnchor: string
  currency: string
  disclaimer: string
  researchNote: string
  positions: Position[]
  hedges: HedgeStrip
}
