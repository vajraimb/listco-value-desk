import type { Position, Watchlist } from './types'

export type QuoteSession = 'open' | 'pre' | 'closed'

export interface LiveQuote {
  ticker: string
  price: number
  time: string
}

export interface QuoteSnapshot {
  source: 'alpaca'
  session: QuoteSession
  anchor: string
  quotes: Record<string, LiveQuote>
}

export function applyQuotes(watchlist: Watchlist, snapshot: QuoteSnapshot | null): Watchlist {
  if (!snapshot) return watchlist
  return {
    ...watchlist,
    priceAnchor: snapshot.anchor,
    positions: watchlist.positions.map((position) => applyQuoteToPosition(position, snapshot)),
  }
}

function applyQuoteToPosition(position: Position, snapshot: QuoteSnapshot): Position {
  const quote = snapshot.quotes[position.ticker.trim().toUpperCase()]
  if (!quote) return position
  const ratio = position.spot > 0 ? quote.price / position.spot : 1
  return {
    ...position,
    spot: quote.price,
    multiple: scaleNullable(position.multiple, ratio),
    impliedRev: scaleNullable(position.impliedRev, ratio),
  }
}

function scaleNullable(value: number | null, ratio: number): number | null {
  if (value === null) return null
  return Number((value * ratio).toFixed(2))
}

export async function fetchLiveQuotes(
  tickers: string[],
  init: Pick<RequestInit, 'signal'> = {},
): Promise<QuoteSnapshot> {
  const symbols = uniqueTickers(tickers)
  const path = `${import.meta.env.BASE_URL}quotes.json`
  const url = symbols.length > 0 ? `${path}?symbols=${encodeURIComponent(symbols.join(','))}` : path
  const response = await fetch(url, { cache: 'no-store', signal: init.signal })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(errorMessage(payload) || `行情接口 ${response.status}`)
  }
  return parseSnapshot(payload)
}

export function uniqueTickers(tickers: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const ticker of tickers) {
    const symbol = ticker.trim().toUpperCase()
    if (symbol === '' || seen.has(symbol)) continue
    seen.add(symbol)
    result.push(symbol)
  }
  return result
}

function parseSnapshot(payload: unknown): QuoteSnapshot {
  if (!isRecord(payload) || payload.source !== 'alpaca' || !isRecord(payload.quotes)) {
    throw new Error('行情返回格式不对')
  }
  const quotes: Record<string, LiveQuote> = {}
  for (const [ticker, value] of Object.entries(payload.quotes)) {
    if (!isRecord(value)) continue
    const price = typeof value.price === 'number' ? value.price : Number.NaN
    if (!Number.isFinite(price) || price <= 0) continue
    quotes[ticker.toUpperCase()] = {
      ticker: ticker.toUpperCase(),
      price: Number(price.toFixed(2)),
      time: typeof value.time === 'string' ? value.time : '',
    }
  }
  const session = payload.session
  return {
    source: 'alpaca',
    session: session === 'open' || session === 'pre' || session === 'closed' ? session : 'closed',
    anchor: typeof payload.anchor === 'string' ? payload.anchor : 'Alpaca',
    quotes,
  }
}

function errorMessage(payload: unknown): string {
  if (isRecord(payload) && typeof payload.error === 'string') return payload.error
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
