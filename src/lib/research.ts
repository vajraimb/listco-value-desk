import type { Position } from './types'

export interface TickerResearch {
  ticker: string
  name: string
  exchange: string
  spot: number
  bear: number
  base: number
  bull: number
  multiple: number
  tvEv: number
  impliedRev: number
  horizonYear: string
  cagr: number
  grossMargin: number
  tam: Position['tam']
  triggers: Position['triggers']
  notes: string[]
  warnings: string[]
  sources: string[]
}

export async function fetchTickerResearch(
  ticker: string,
  init: Pick<RequestInit, 'signal'> = {},
): Promise<TickerResearch> {
  const symbol = ticker.trim().toUpperCase()
  const url = `${import.meta.env.BASE_URL}research.json?ticker=${encodeURIComponent(symbol)}`
  const response = await fetch(url, { cache: 'no-store', signal: init.signal })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(errorMessage(payload) || `研究接口 ${response.status}`)
  }
  return parseResearch(payload, symbol)
}

export function applyResearch(position: Position, research: TickerResearch): Position {
  return {
    ...position,
    ticker: research.ticker,
    name: research.name,
    exchange: research.exchange,
    spot: research.spot,
    bear: research.bear,
    base: research.base,
    bull: research.bull,
    multiple: research.multiple,
    tvEv: research.tvEv,
    impliedRev: research.impliedRev,
    horizonYear: research.horizonYear,
    cagr: research.cagr,
    grossMargin: research.grossMargin,
    tam: research.tam,
    triggers: research.triggers,
    notes: research.notes,
  }
}

export function isResearchableTicker(ticker: string): boolean {
  return /^[A-Z]{1,5}(?:\.[A-Z])?$/.test(ticker.trim().toUpperCase())
}

function parseResearch(payload: unknown, fallbackTicker: string): TickerResearch {
  if (!isRecord(payload)) throw new Error('研究返回格式不对')
  const num = (key: string): number => {
    const value = payload[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }
  const str = (key: string, fallback = ''): string =>
    typeof payload[key] === 'string' ? (payload[key] as string) : fallback
  return {
    ticker: str('ticker', fallbackTicker),
    name: str('name', fallbackTicker),
    exchange: str('exchange'),
    spot: num('spot'),
    bear: num('bear'),
    base: num('base'),
    bull: num('bull'),
    multiple: num('multiple'),
    tvEv: num('tvEv'),
    impliedRev: num('impliedRev'),
    horizonYear: str('horizonYear'),
    cagr: num('cagr'),
    grossMargin: num('grossMargin'),
    tam: Array.isArray(payload.tam) ? (payload.tam as TickerResearch['tam']) : [],
    triggers: Array.isArray(payload.triggers)
      ? (payload.triggers as TickerResearch['triggers'])
      : [],
    notes: Array.isArray(payload.notes)
      ? payload.notes.filter((row): row is string => typeof row === 'string')
      : [],
    warnings: Array.isArray(payload.warnings)
      ? payload.warnings.filter((row): row is string => typeof row === 'string')
      : [],
    sources: Array.isArray(payload.sources)
      ? payload.sources.filter((row): row is string => typeof row === 'string')
      : [],
  }
}

function errorMessage(payload: unknown): string {
  return isRecord(payload) && typeof payload.error === 'string' ? payload.error : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
