import type { Plugin } from 'vite'

type QuoteSession = 'open' | 'pre' | 'closed'

const DATA_URL = 'https://data.alpaca.markets/v2/stocks/snapshots'
const SESSION_LABEL: Record<QuoteSession, string> = {
  open: '盘中',
  pre: '盘前',
  closed: '已收盘',
}

interface AlpacaClock {
  is_open?: boolean
  timestamp?: string
  next_open?: string
}

interface AlpacaBar {
  c?: number
  t?: string
}

interface AlpacaTrade {
  p?: number
  t?: string
}

interface AlpacaQuote {
  ap?: number
  bp?: number
  t?: string
}

interface AlpacaSnapshot {
  latestTrade?: AlpacaTrade
  latestQuote?: AlpacaQuote
  dailyBar?: AlpacaBar
  prevDailyBar?: AlpacaBar
}

export function alpacaQuotes(): Plugin {
  return {
    name: 'alpaca-quotes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ? new URL(req.url, 'http://localhost') : null
        if (!url || !isQuotesPath(url.pathname, server.config.base)) {
          next()
          return
        }

        const symbols = (url.searchParams.get('symbols') ?? '')
          .split(',')
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean)

        loadQuoteSnapshot(symbols)
          .then((snapshot) => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify(snapshot))
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : '行情拉取失败'
            res.statusCode = message === 'missing_alpaca_credentials' ? 503 : 502
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify({ error: publicError(message) }))
          })
      })
    },
  }
}

function isQuotesPath(pathname: string, base: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const prefixed = `${base.replace(/\/+$/, '')}/quotes.json`
  return normalized === '/quotes.json' || normalized === prefixed
}

function alpacaHeaders(): { key: string; headers: Record<string, string> } {
  const key = process.env.ALPACA_API_KEY?.trim() ?? ''
  const secret = process.env.ALPACA_SECRET_KEY?.trim() ?? ''
  if (key === '' || secret === '') {
    throw new Error('missing_alpaca_credentials')
  }
  return {
    key,
    headers: {
      'APCA-API-KEY-ID': key,
      'APCA-API-SECRET-KEY': secret,
      Accept: 'application/json',
    },
  }
}

async function loadQuoteSnapshot(symbols: string[]) {
  const { key, headers } = alpacaHeaders()
  const clockUrl = key.startsWith('PK')
    ? 'https://paper-api.alpaca.markets/v2/clock'
    : 'https://api.alpaca.markets/v2/clock'

  const [clock, snapshots] = await Promise.all([
    fetchJson<AlpacaClock>(clockUrl, headers),
    symbols.length === 0
      ? Promise.resolve({} as Record<string, AlpacaSnapshot>)
      : fetchSnapshots(symbols, headers),
  ])

  const quotes: Record<string, { ticker: string; price: number; time: string }> = {}
  let latestTime = clock.timestamp ?? ''
  for (const symbol of symbols) {
    const parsed = pickPrice(snapshots[symbol])
    if (!parsed) continue
    quotes[symbol] = { ticker: symbol, price: Number(parsed.price.toFixed(2)), time: parsed.time }
    if (parsed.time > latestTime) latestTime = parsed.time
  }

  const session = clockSession(clock)
  return {
    source: 'alpaca' as const,
    session,
    anchor: `Alpaca ${formatEt(latestTime)} ${SESSION_LABEL[session]}`,
    quotes,
  }
}

async function fetchSnapshots(
  symbols: string[],
  headers: Record<string, string>,
): Promise<Record<string, AlpacaSnapshot>> {
  const query = `symbols=${encodeURIComponent(symbols.join(','))}`
  const primary = await fetch(`${DATA_URL}?${query}`, { headers })
  if (primary.status === 403) {
    return fetchJson(`${DATA_URL}?${query}&feed=iex`, headers)
  }
  if (!primary.ok) {
    const detail = await primary.text().catch(() => '')
    throw new Error(`alpaca_snapshots_${primary.status}${detail ? `:${detail.slice(0, 120)}` : ''}`)
  }
  return (await primary.json()) as Record<string, AlpacaSnapshot>
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`alpaca_http_${response.status}`)
  }
  return (await response.json()) as T
}

function pickPrice(snapshot: AlpacaSnapshot | undefined): { price: number; time: string } | null {
  if (!snapshot) return null
  const trade = snapshot.latestTrade
  if (trade && typeof trade.p === 'number' && trade.p > 0) {
    return { price: trade.p, time: trade.t ?? '' }
  }
  const quote = snapshot.latestQuote
  if (quote) {
    const bid = typeof quote.bp === 'number' && quote.bp > 0 ? quote.bp : 0
    const ask = typeof quote.ap === 'number' && quote.ap > 0 ? quote.ap : 0
    const price = bid > 0 && ask > 0 ? (bid + ask) / 2 : bid || ask
    if (price > 0) return { price, time: quote.t ?? '' }
  }
  const close = snapshot.dailyBar?.c ?? snapshot.prevDailyBar?.c
  const time = snapshot.dailyBar?.t ?? snapshot.prevDailyBar?.t ?? ''
  if (typeof close === 'number' && close > 0) return { price: close, time }
  return null
}

function clockSession(clock: AlpacaClock): QuoteSession {
  if (clock.is_open) return 'open'
  const now = clock.timestamp ? new Date(clock.timestamp) : new Date()
  const nextOpen = clock.next_open ? new Date(clock.next_open) : null
  if (nextOpen && now < nextOpen && etDay(now) === etDay(nextOpen)) return 'pre'
  return 'closed'
}

function etDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatEt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '时间未知'
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ET`
}

function publicError(message: string): string {
  if (message === 'missing_alpaca_credentials') return '未读取到 ALPACA_API_KEY / ALPACA_SECRET_KEY'
  if (message.startsWith('alpaca_http_401') || message.startsWith('alpaca_snapshots_401')) {
    return 'Alpaca 密钥无效'
  }
  if (message.startsWith('alpaca_http_403') || message.startsWith('alpaca_snapshots_403')) {
    return 'Alpaca 行情权限不足'
  }
  return 'Alpaca 美股行情拉取失败'
}
