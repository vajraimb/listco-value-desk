import seed from '../../data/watchlist.json'
import { TAM_VERDICTS, WATCHLIST_SCHEMA } from './types'
import type {
  HedgeItem,
  HedgeStrip,
  Position,
  TamRow,
  TamVerdict,
  TriggerRow,
  Watchlist,
} from './types'

export const SEED_WATCHLIST = normalizeWatchlist(seed)

export function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function num(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return fallback
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && Number.isFinite(Number(value))) return Number(value)
  return null
}

function verdict(value: unknown): TamVerdict {
  return TAM_VERDICTS.includes(value as TamVerdict) ? (value as TamVerdict) : '紧'
}

function normalizeTam(raw: unknown, positionId: string, index: number): TamRow {
  const row = isRecord(raw) ? raw : {}
  return {
    id: str(row.id) || makeId(`${positionId}-tam`),
    label: str(row.label, `口径 ${index + 1}`),
    share: numOrNull(row.share),
    verdict: verdict(row.verdict),
  }
}

function normalizeTrigger(raw: unknown, positionId: string): TriggerRow {
  if (typeof raw === 'string') return { id: makeId(`${positionId}-trg`), text: raw }
  const row = isRecord(raw) ? raw : {}
  return {
    id: str(row.id) || makeId(`${positionId}-trg`),
    text: str(row.text),
  }
}

function normalizePosition(raw: unknown, index: number): Position {
  const row = isRecord(raw) ? raw : {}
  const ticker = str(row.ticker, `TICKER${index + 1}`).toUpperCase()
  const id = str(row.id) || makeId(ticker.toLowerCase() || 'pos')
  const base = num(row.base, 0)
  return {
    id,
    ticker,
    name: str(row.name, ticker),
    exchange: str(row.exchange),
    spot: num(row.spot, 0),
    cost: numOrNull(row.cost),
    bear: num(row.bear, 0),
    base,
    bull: num(row.bull, base),
    multiple: numOrNull(row.multiple),
    tvEv: numOrNull(row.tvEv),
    impliedRev: numOrNull(row.impliedRev),
    horizonYear: str(row.horizonYear),
    cagr: numOrNull(row.cagr),
    grossMargin: numOrNull(row.grossMargin),
    tam: Array.isArray(row.tam) ? row.tam.map((item, i) => normalizeTam(item, id, i)) : [],
    triggers: Array.isArray(row.triggers)
      ? row.triggers.map((item) => normalizeTrigger(item, id)).filter((item) => item.text !== '')
      : [],
    notes: Array.isArray(row.notes) ? row.notes.map((item) => str(item)).filter(Boolean) : [],
  }
}

function normalizeHedgeItem(raw: unknown, index: number): HedgeItem {
  const row = isRecord(raw) ? raw : {}
  return {
    id: str(row.id) || makeId('hedge'),
    title: str(row.title, `工具 ${index + 1}`),
    subtitle: str(row.subtitle),
    lines: Array.isArray(row.lines) ? row.lines.map((line) => str(line)).filter(Boolean) : [],
  }
}

function normalizeHedges(raw: unknown): HedgeStrip {
  const row = isRecord(raw) ? raw : {}
  return {
    title: str(row.title, '股票不能买不能卖时的降风险'),
    note: str(row.note),
    items: Array.isArray(row.items) ? row.items.map(normalizeHedgeItem) : [],
  }
}

/**
 * Accepts anything shaped roughly like a watchlist (a fresh export, a hand
 * edited file, an older localStorage payload) and fills in what is missing.
 * Throws only when the payload cannot be read as an object at all.
 */
export function normalizeWatchlist(raw: unknown): Watchlist {
  if (!isRecord(raw)) {
    throw new Error('JSON 顶层必须是一个对象')
  }
  const positions = Array.isArray(raw.positions) ? raw.positions : []
  if (!Array.isArray(raw.positions)) {
    throw new Error('缺少 positions 数组')
  }
  return {
    schema: WATCHLIST_SCHEMA,
    skill: str(raw.skill, 'listed_co_marketcap_vs_dcf.v1.1'),
    version: str(raw.version, 'v1.1'),
    title: str(raw.title, '估值边界看板'),
    asOf: str(raw.asOf),
    priceAnchor: str(raw.priceAnchor),
    currency: str(raw.currency, 'USD'),
    disclaimer: str(raw.disclaimer, '风险边界，不是买卖建议。'),
    researchNote: str(raw.researchNote),
    positions: positions.map(normalizePosition),
    hedges: normalizeHedges(raw.hedges),
  }
}

export function parseWatchlistJson(text: string): Watchlist {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('不是合法的 JSON')
  }
  const watchlist = normalizeWatchlist(parsed)
  if (watchlist.positions.length === 0) {
    throw new Error('positions 为空，至少需要一个标的')
  }
  return watchlist
}

export function serializeWatchlist(watchlist: Watchlist): string {
  return `${JSON.stringify(watchlist, null, 2)}\n`
}

function tickerKey(ticker: string): string {
  return ticker.trim().toUpperCase()
}

/** True when the row is a newly added shell: code maybe filled, DCF and research not. */
export function isShellPosition(position: Position): boolean {
  return (
    position.bear === 0 &&
    position.base === 0 &&
    position.bull === 0 &&
    position.tam.length === 0 &&
    position.triggers.length === 0 &&
    position.multiple === null &&
    position.impliedRev === null
  )
}

/**
 * Local edits win, but a later seed (new ticker, or a shell the desk added in
 * settings) must still receive the checked-in research. Cost on the local row
 * is kept; id is kept so the open editor does not remount.
 */
export function hydrateFromSeed(stored: Watchlist, seed: Watchlist): Watchlist {
  const seedByTicker = new Map(
    seed.positions
      .map((position) => [tickerKey(position.ticker), position] as const)
      .filter(([ticker]) => ticker !== ''),
  )
  const seen = new Set<string>()
  const positions = stored.positions.map((local) => {
    const key = tickerKey(local.ticker)
    const seeded = key === '' ? undefined : seedByTicker.get(key)
    if (!seeded) return local
    seen.add(key)
    if (!isShellPosition(local)) return local
    return {
      ...seeded,
      id: local.id,
      cost: local.cost !== null ? local.cost : seeded.cost,
    }
  })
  for (const seeded of seed.positions) {
    const key = tickerKey(seeded.ticker)
    if (key === '' || seen.has(key)) continue
    positions.push(seeded)
  }
  return { ...stored, positions }
}

/** Data problems worth surfacing in the editor; none of these block rendering. */
export function positionIssues(position: Position): string[] {
  const issues: string[] = []
  if (position.ticker.trim() === '') issues.push('代码为空')
  if (!(position.bear <= position.base)) issues.push('bear 应当 ≤ base')
  if (!(position.base <= position.bull)) issues.push('base 应当 ≤ bull')
  if (position.spot <= 0) issues.push('现价应当 > 0')
  if (position.cost !== null && position.cost <= 0) issues.push('成本应当 > 0 或留空')
  return issues
}

export function blankPosition(): Position {
  const id = makeId('pos')
  return {
    id,
    ticker: '',
    name: '',
    exchange: '',
    spot: 0,
    cost: null,
    bear: 0,
    base: 0,
    bull: 0,
    multiple: null,
    tvEv: null,
    impliedRev: null,
    horizonYear: '',
    cagr: null,
    grossMargin: null,
    tam: [],
    triggers: [],
    notes: [],
  }
}
