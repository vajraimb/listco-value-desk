import type { BandKey, Position } from './types'

export interface BandMeta {
  key: BandKey
  /** Short name used on chips, card headers and the legend. */
  label: string
  /** The rule that produced the band, written the way the skill states it. */
  rule: string
}

export const BANDS: BandMeta[] = [
  { key: 'falsified', label: '证伪带', rule: 'spot < bear' },
  { key: 'discount', label: '折价带', rule: 'bear ≤ spot < base' },
  { key: 'premium', label: '成长溢价带', rule: 'base ≤ spot ≤ bull' },
  { key: 'overshoot', label: '叙事越界', rule: 'spot > bull' },
]

const BAND_BY_KEY = new Map(BANDS.map((band) => [band.key, band]))

export function bandMeta(key: BandKey): BandMeta {
  return BAND_BY_KEY.get(key) ?? BANDS[0]
}

interface Boundaries {
  bear: number
  base: number
  bull: number
}

/**
 * The single source of truth for band colour anywhere in the app: the band is
 * always recomputed from the price and the three DCF boundaries, never stored.
 */
export function classify(price: number, { bear, base, bull }: Boundaries): BandKey {
  if (price < bear) return 'falsified'
  if (price < base) return 'discount'
  if (price <= bull) return 'premium'
  return 'overshoot'
}

export interface BandSegment {
  key: BandKey
  from: number
  to: number
  /** Left edge as a percentage of the drawn axis. */
  left: number
  width: number
}

export interface AxisMark {
  value: number
  /** Position as a percentage of the drawn axis. */
  pct: number
}

export interface PositionView {
  position: Position
  band: BandKey
  costBand: BandKey | null
  axisMin: number
  axisMax: number
  segments: BandSegment[]
  spotMark: AxisMark
  costMark: AxisMark | null
  bearMark: AxisMark
  baseMark: AxisMark
  bullMark: AxisMark
  /** Signed distance from spot to the boundary that matters for this band. */
  gap: { label: string; abs: number; pct: number }
}

function axisDomain(position: Position) {
  const { spot, cost, bear, base, bull } = position
  const points = [spot, bear, base, bull, ...(cost === null ? [] : [cost])]
  const high = Math.max(...points)
  const low = Math.min(...points, 0)
  const headroom = (high - low) * 0.08
  return { axisMin: low, axisMax: high + Math.max(headroom, 1) }
}

export function buildPositionView(position: Position): PositionView {
  const { spot, cost, bear, base, bull } = position
  const { axisMin, axisMax } = axisDomain(position)
  const span = axisMax - axisMin || 1
  const pctOf = (value: number) => ((value - axisMin) / span) * 100

  const edges: Array<{ key: BandKey; from: number; to: number }> = [
    { key: 'falsified', from: axisMin, to: bear },
    { key: 'discount', from: bear, to: base },
    { key: 'premium', from: base, to: bull },
    { key: 'overshoot', from: bull, to: axisMax },
  ]

  const segments = edges.map(({ key, from, to }) => {
    const left = pctOf(from)
    return { key, from, to, left, width: Math.max(pctOf(to) - left, 0) }
  })

  const band = classify(spot, position)

  return {
    position,
    band,
    costBand: cost === null ? null : classify(cost, position),
    axisMin,
    axisMax,
    segments,
    spotMark: { value: spot, pct: pctOf(spot) },
    costMark: cost === null ? null : { value: cost, pct: pctOf(cost) },
    bearMark: { value: bear, pct: pctOf(bear) },
    baseMark: { value: base, pct: pctOf(base) },
    bullMark: { value: bull, pct: pctOf(bull) },
    gap: gapToBoundary(spot, band, position),
  }
}

function gapToBoundary(spot: number, band: BandKey, { bear, base, bull }: Boundaries) {
  const target =
    band === 'falsified'
      ? { label: '低于 bear', value: bear }
      : band === 'discount'
        ? { label: '距 base', value: base }
        : band === 'premium'
          ? { label: '距 bull', value: bull }
          : { label: '超出 bull', value: bull }

  const abs = Math.abs(spot - target.value)
  const pct = target.value === 0 ? 0 : abs / target.value
  return { label: target.label, abs, pct }
}

/** Counts how many positions sit in each band, for the header tally. */
export function tallyBands(positions: Position[]): Record<BandKey, number> {
  const tally: Record<BandKey, number> = {
    falsified: 0,
    discount: 0,
    premium: 0,
    overshoot: 0,
  }
  for (const position of positions) tally[classify(position.spot, position)] += 1
  return tally
}
