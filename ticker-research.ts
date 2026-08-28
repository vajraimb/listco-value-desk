/** Listed-co DCF pipeline used by the Vite research endpoint. Node-only. */

import {
  disclosureNotes,
  loadDisclosures,
  type DisclosureExtract,
} from './filing-extract.ts'

const NASDAQ_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SEC_UA = 'ListcoValueDesk/1.1 (local research; research@localhost)'
const NASDAQ_HEADERS = {
  Accept: 'application/json',
  Referer: 'https://www.nasdaq.com/',
  'User-Agent': NASDAQ_UA,
}

export interface ResearchTam {
  id: string
  label: string
  share: number | null
  verdict: '可行' | '紧' | '不可行'
}

export interface ResearchTrigger {
  id: string
  text: string
}

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
  tam: ResearchTam[]
  triggers: ResearchTrigger[]
  notes: string[]
  warnings: string[]
  sources: string[]
}

export async function researchTicker(ticker: string): Promise<TickerResearch> {
  const symbol = ticker.trim().toUpperCase()
  if (!/^[A-Z]{1,5}(?:\.[A-Z])?$/.test(symbol)) {
    throw new Error('ticker_invalid')
  }

  const warnings: string[] = []
  const sources: string[] = []

  const [asset, snapshot, annual, quarterly, summary] = await Promise.all([
    alpacaAsset(symbol),
    alpacaSnapshot(symbol),
    nasdaqFinancials(symbol, 1),
    nasdaqFinancials(symbol, 2),
    nasdaqSummary(symbol),
  ])

  const spot = snapshot.price ?? parsePlainNumber(summary?.PreviousClose?.value) ?? 0
  if (!(spot > 0)) throw new Error('missing_spot')
  sources.push('Alpaca 最新成交')

  const annualIncome = mapTable(annual?.incomeStatementTable)
  const annualCash = mapTable(annual?.cashFlowTable)
  const annualBalance = mapTable(annual?.balanceSheetTable)
  const qIncome = mapTable(quarterly?.incomeStatementTable)
  const qBalance = mapTable(quarterly?.balanceSheetTable)
  if (!annualIncome) throw new Error('missing_financials')
  sources.push('Nasdaq 年报/季报财务表')

  const annualRevenues = rowSeries(annualIncome, 'Total Revenue').map(nasdaqThousands)
  const latestAnnualRev = lastFinite(annualRevenues)
  if (latestAnnualRev === null || latestAnnualRev <= 0) throw new Error('missing_revenue')

  const ttmRev = ttmFromQuarterly(qIncome, 'Total Revenue')
  let startRevenue = ttmRev && ttmRev > 0 ? ttmRev : latestAnnualRev
  if (ttmRev && Math.abs(ttmRev - latestAnnualRev) / latestAnnualRev > 0.25) {
    warnings.push('TTM 收入与最近年报相差超过 25%，DCF 以 TTM 为起点')
  }

  const cik = await lookupCik(symbol).catch(() => null)
  const [secRevenue, disclosures] = await Promise.all([
    secLatestAnnualRevenue(symbol, cik).catch(() => null),
    cik ? loadDisclosures(cik).catch(() => null) : Promise.resolve(null),
  ])
  if (secRevenue && secRevenue > 0) {
    sources.push('SEC XBRL 年报收入')
    const gap = Math.abs(secRevenue - latestAnnualRev) / secRevenue
    if (gap > 0.05) {
      warnings.push(
        `年报收入双源差异 ${(gap * 100).toFixed(1)}%（SEC ${fmtB(secRevenue)} vs Nasdaq ${fmtB(latestAnnualRev)}），DCF 用 Nasdaq`,
      )
    }
  }

  if (disclosures?.fyGuidance) {
    const mid = (disclosures.fyGuidance.low + disclosures.fyGuidance.high) / 2
    if (mid > startRevenue * 0.8) {
      startRevenue = mid
      sources.push(...disclosures.sources)
    }
  } else if (disclosures?.sources.length) {
    sources.push(...disclosures.sources)
  }

  const histCagr = seriesCagr(annualRevenues.filter((value): value is number => value !== null))
  let baseCagr = clamp(histCagr ?? 0.12, 0.05, 0.22)
  const fyEnd = latestHeaderDate(annualIncome) ?? '2026-01-31'
  if (disclosures?.longTermGoal) {
    const goalYear = Number(disclosures.longTermGoal.year)
    const fyYear = Number(fyEnd.slice(0, 4))
    const years = Math.max(2, goalYear - fyYear)
    const impliedCagr = (disclosures.longTermGoal.revenue / startRevenue) ** (1 / years) - 1
    if (impliedCagr > 0.03 && impliedCagr < 0.35) {
      baseCagr = clamp(impliedCagr, 0.04, 0.25)
    }
  }
  const bearCagr = clamp(baseCagr * 0.6, 0.03, 0.12)
  const bullCagr = clamp(baseCagr * 1.4, 0.08, 0.28)

  const gross = lastFinite(rowSeries(annualIncome, 'Gross Profit').map(nasdaqThousands))
  const grossMargin = gross && latestAnnualRev ? clamp(gross / latestAnnualRev, 0.05, 0.95) : 0.5

  const ocf = lastFinite(rowSeries(annualCash, 'Net Cash Flow-Operating').map(nasdaqThousands))
  const capex = inferCapex(annualCash)
  const fcf = ocf === null ? null : ocf - (capex ?? 0)
  const fcfMarginRaw = fcf && latestAnnualRev ? fcf / latestAnnualRev : 0.25
  const fcfMargin = clamp(fcfMarginRaw, 0.08, 0.5)
  if (capex === null) warnings.push('年报资本开支为空，FCF 按经营现金流估计')

  const cash = latestCash(qBalance, annualBalance)
  const debt = latestDebt(qBalance, annualBalance)
  const netCash = (cash ?? 0) - (debt ?? 0)

  const marketCap = parsePlainNumber(summary?.MarketCap?.value)
  const shares = marketCap && marketCap > 0 ? marketCap / spot : startRevenue / Math.max(spot, 1)
  if (!marketCap) warnings.push('未读到市值，股本按收入粗估')

  const horizonYear = disclosures?.longTermGoal?.year
    ? String(disclosures.longTermGoal.year)
    : horizonLabel(fyEnd, 4)

  const bear = runDcf({
    startRevenue,
    cagr: bearCagr,
    fcfMargin: Math.max(0.08, fcfMargin - 0.06),
    wacc: 0.105,
    g: 0.025,
    netCash,
    shares,
  })
  const base = runDcf({
    startRevenue,
    cagr: baseCagr,
    fcfMargin,
    wacc: 0.093,
    g: 0.035,
    netCash,
    shares,
  })
  const bull = runDcf({
    startRevenue,
    cagr: bullCagr,
    fcfMargin: Math.min(0.5, fcfMargin + 0.03),
    wacc: 0.085,
    g: 0.04,
    netCash,
    shares,
  })

  const implied = impliedRevenue({
    startRevenue,
    fcfMargin,
    wacc: 0.093,
    g: 0.035,
    netCash,
    shares,
    targetEquity: spot * shares,
  })

  const multiple = base.equity > 0 ? round2((spot * shares) / base.equity) : 1
  const impliedRev = round2(implied.revenue / 1e9)
  const ttmOrAnnual = startRevenue
  const impliedOverNow = implied.revenue / ttmOrAnnual
  const tamShare = round3(impliedOverNow)
  const tamVerdict: ResearchTam['verdict'] =
    impliedOverNow < 1.8 ? '可行' : impliedOverNow < 2.8 ? '紧' : '不可行'

  const slug = symbol.toLowerCase().replace('.', '')
  const gmFloor = Math.max(0.05, grossMargin - 0.03)
  const growthFloor = Math.max(0.03, bearCagr - 0.02)
  const tam = buildTam(slug, impliedRev, tamShare, tamVerdict, histCagr, baseCagr, disclosures)
  const triggers = buildTriggers(slug, {
    disclosures,
    growthFloor,
    gmFloor,
    grossMargin,
    fcfMargin,
  })
  const notes = disclosures ? disclosureNotes(disclosures) : []

  return {
    ticker: symbol,
    name: cleanName(asset.name ?? symbol),
    exchange: asset.exchange || summary?.Exchange?.value || '',
    spot: round2(spot),
    bear: round2(Math.min(bear.price, base.price)),
    base: round2(base.price),
    bull: round2(Math.max(bull.price, base.price)),
    multiple,
    tvEv: round3(base.tvEv),
    impliedRev,
    horizonYear,
    cagr: round3(baseCagr),
    grossMargin: round3(grossMargin),
    tam,
    triggers,
    notes,
    warnings,
    sources,
  }
}

function alpacaHeaders(): Record<string, string> {
  const key = process.env.ALPACA_API_KEY?.trim() ?? ''
  const secret = process.env.ALPACA_SECRET_KEY?.trim() ?? ''
  if (key === '' || secret === '') throw new Error('missing_alpaca_credentials')
  return {
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret,
    Accept: 'application/json',
  }
}

async function alpacaAsset(symbol: string): Promise<{ name: string; exchange: string }> {
  const host = (process.env.ALPACA_API_KEY ?? '').startsWith('PK')
    ? 'https://paper-api.alpaca.markets'
    : 'https://api.alpaca.markets'
  const payload = await fetchJson(`${host}/v2/assets/${encodeURIComponent(symbol)}`, alpacaHeaders())
  return {
    name: typeof payload.name === 'string' ? payload.name : symbol,
    exchange: typeof payload.exchange === 'string' ? payload.exchange : '',
  }
}

async function alpacaSnapshot(symbol: string): Promise<{ price: number | null }> {
  const headers = alpacaHeaders()
  const url = `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${encodeURIComponent(symbol)}`
  const primary = await fetch(url, { headers })
  const payload = (
    primary.status === 403
      ? await fetchJson(`${url}&feed=iex`, headers)
      : await readJson(primary)
  ) as Record<string, { latestTrade?: { p?: number }; latestQuote?: { ap?: number; bp?: number }; dailyBar?: { c?: number } }>
  const snap = payload[symbol]
  const trade = snap?.latestTrade?.p
  if (typeof trade === 'number' && trade > 0) return { price: trade }
  const bid = snap?.latestQuote?.bp ?? 0
  const ask = snap?.latestQuote?.ap ?? 0
  if (bid > 0 && ask > 0) return { price: (bid + ask) / 2 }
  const close = snap?.dailyBar?.c
  return { price: typeof close === 'number' && close > 0 ? close : null }
}

async function nasdaqFinancials(symbol: string, frequency: 1 | 2) {
  const url = `https://api.nasdaq.com/api/company/${encodeURIComponent(symbol)}/financials?frequency=${frequency}`
  const payload = await fetchJson(url, NASDAQ_HEADERS)
  const data = isRecord(payload.data) ? payload.data : null
  return data
}

async function nasdaqSummary(symbol: string) {
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/summary?assetclass=stocks`
  const payload = await fetchJson(url, NASDAQ_HEADERS)
  const data = isRecord(payload.data) ? payload.data : null
  const summary = data && isRecord(data.summaryData) ? data.summaryData : null
  return summary as Record<string, { value?: string }> | null
}

function buildTam(
  slug: string,
  impliedRev: number,
  tamShare: number,
  tamVerdict: ResearchTam['verdict'],
  histCagr: number | null,
  baseCagr: number,
  disclosures: DisclosureExtract | null,
): ResearchTam[] {
  const rows: ResearchTam[] = []
  if (disclosures?.tamBillions) {
    const share = impliedRev / disclosures.tamBillions
    rows.push({
      id: `${slug}-tam-1`,
      label: `公司 TAM $${disclosures.tamBillions}B`,
      share: round3(share),
      verdict: share < 0.25 ? '可行' : share < 0.4 ? '紧' : '不可行',
    })
  } else {
    rows.push({
      id: `${slug}-tam-1`,
      label: '隐含收入 / TTM',
      share: tamShare,
      verdict: tamVerdict,
    })
  }
  if (disclosures?.longTermGoal) {
    const goalB = disclosures.longTermGoal.revenue / 1e9
    const share = goalB > 0 ? impliedRev / goalB : 0
    rows.push({
      id: `${slug}-tam-2`,
      label: `${disclosures.longTermGoal.year} 公司计划 $${goalB.toFixed(0)}B`,
      share: round3(share),
      verdict: share <= 1.05 ? '可行' : share <= 1.25 ? '紧' : '不可行',
    })
  } else {
    rows.push({
      id: `${slug}-tam-2`,
      label: '近三年收入 CAGR',
      share: round3(histCagr ?? baseCagr),
      verdict: (histCagr ?? 0) > 0.25 ? '紧' : '可行',
    })
  }
  return rows
}

function buildTriggers(
  slug: string,
  input: {
    disclosures: DisclosureExtract | null
    growthFloor: number
    gmFloor: number
    grossMargin: number
    fcfMargin: number
  },
): ResearchTrigger[] {
  const triggers: ResearchTrigger[] = []
  const fy = input.disclosures?.fyGuidance
  if (fy) {
    const floor = fy.low * 0.98
    triggers.push({
      id: `${slug}-trg-guide`,
      text: `${fy.period} 收入 < $${(floor / 1e9).toFixed(2)}B（指引 $${(fy.low / 1e9).toFixed(2)}–${(fy.high / 1e9).toFixed(2)}B）`,
    })
  } else {
    triggers.push({
      id: `${slug}-trg-1`,
      text: `连续两季收入增速 < ${(input.growthFloor * 100).toFixed(0)}%`,
    })
  }
  const kpi = input.disclosures?.kpis.find((item) => item.includes('前') && item.includes('承诺'))
  if (kpi) {
    triggers.push({
      id: `${slug}-trg-kpi`,
      text: `${kpi}，或出现公开回迁竞品`,
    })
  }
  const rival = input.disclosures?.competitors[0]
  if (rival) {
    triggers.push({
      id: `${slug}-trg-comp`,
      text: `核心产品被 ${rival} 公开抢走大客户`,
    })
  }
  triggers.push({
    id: `${slug}-trg-gm`,
    text: `毛利率 < ${(input.gmFloor * 100).toFixed(0)}%（现约 ${(input.grossMargin * 100).toFixed(0)}%）`,
  })
  triggers.push({
    id: `${slug}-trg-fcf`,
    text: `FCF 利润率 < ${(Math.max(0.05, input.fcfMargin - 0.08) * 100).toFixed(0)}%（模型基准 ${(input.fcfMargin * 100).toFixed(0)}%）`,
  })
  return triggers.slice(0, 5)
}

async function secLatestAnnualRevenue(symbol: string, knownCik?: string | null): Promise<number | null> {
  const cik = knownCik ?? (await lookupCik(symbol))
  if (!cik) return null
  const padded = cik.replace(/^0+/, '').padStart(10, '0')
  const tags = [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
  ]
  for (const tag of tags) {
    const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${padded}/us-gaap/${tag}.json`
    const payload = await fetchJson(url, { Accept: 'application/json', 'User-Agent': SEC_UA }).catch(
      () => null,
    )
    if (!payload) continue
    const units = isRecord(payload.units) ? payload.units : null
    const usd = units && Array.isArray(units.USD) ? units.USD : []
    const annual = usd
      .filter((row) => isRecord(row) && (row.form === '10-K' || row.form === '10-K/A'))
      .sort((a, b) => String(a.end).localeCompare(String(b.end)))
    const last = annual.at(-1)
    const value = last && typeof last.val === 'number' ? last.val : null
    if (value && value > 0) return value
  }
  return null
}

async function lookupCik(symbol: string): Promise<string | null> {
  const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(symbol)}&forms=10-K,10-Q`
  const payload = await fetchJson(url, { Accept: 'application/json', 'User-Agent': NASDAQ_UA })
  const hits = isRecord(payload.hits) && Array.isArray(payload.hits.hits) ? payload.hits.hits : []
  const needle = `(${symbol})`
  for (const hit of hits) {
    if (!isRecord(hit) || !isRecord(hit._source)) continue
    const names = Array.isArray(hit._source.display_names)
      ? hit._source.display_names.map(String)
      : []
    if (!names.some((name) => name.includes(needle))) continue
    const ciks = Array.isArray(hit._source.ciks) ? hit._source.ciks.map(String) : []
    if (ciks[0]) return ciks[0]
  }
  return null
}

interface DcfInput {
  startRevenue: number
  cagr: number
  fcfMargin: number
  wacc: number
  g: number
  netCash: number
  shares: number
}

function runDcf(input: DcfInput): { price: number; equity: number; tvEv: number } {
  const { startRevenue, cagr, fcfMargin, netCash, shares } = input
  const wacc = input.wacc
  const g = Math.min(input.g, wacc - 0.02)
  let pvFcf = 0
  let lastFcf = 0
  for (let i = 0; i < 5; i += 1) {
    const rev = startRevenue * (1 + cagr) ** i
    const fcf = rev * fcfMargin
    lastFcf = fcf
    pvFcf += fcf / (1 + wacc) ** (0.43 + i)
  }
  const tv = lastFcf * (1 + g) / (wacc - g)
  const pvTv = tv / (1 + wacc) ** (0.43 + 4)
  const ev = pvFcf + pvTv
  const equity = ev + netCash
  return {
    price: shares > 0 ? equity / shares : 0,
    equity,
    tvEv: ev > 0 ? pvTv / ev : 0,
  }
}

function impliedRevenue(input: Omit<DcfInput, 'cagr'> & { targetEquity: number }): {
  revenue: number
} {
  let lo = 0
  let hi = 0.5
  let cagr = 0.12
  for (let i = 0; i < 48; i += 1) {
    cagr = (lo + hi) / 2
    const equity = runDcf({ ...input, cagr }).equity
    if (equity < input.targetEquity) lo = cagr
    else hi = cagr
  }
  const start = input.startRevenue
  return { revenue: start * (1 + cagr) ** 4 }
}

function mapTable(table: unknown): { dates: string[]; rows: Map<string, string[]> } | null {
  if (!isRecord(table) || !Array.isArray(table.rows)) return null
  const headers = isRecord(table.headers) ? table.headers : {}
  const dates = ['value2', 'value3', 'value4', 'value5'].map((key) => String(headers[key] ?? ''))
  const rows = new Map<string, string[]>()
  for (const row of table.rows) {
    if (!isRecord(row)) continue
    const label = String(row.value1 ?? '').trim()
    if (label === '') continue
    rows.set(label, ['value2', 'value3', 'value4', 'value5'].map((key) => String(row[key] ?? '')))
  }
  return { dates, rows }
}

function rowSeries(
  table: { rows: Map<string, string[]> } | null,
  label: string,
): Array<number | null> {
  if (!table) return []
  return (table.rows.get(label) ?? []).map(parseNasdaqNumber)
}

function nasdaqThousands(value: number | null): number | null {
  return value === null ? null : value * 1000
}

function ttmFromQuarterly(
  table: { rows: Map<string, string[]> } | null,
  label: string,
): number | null {
  const series = rowSeries(table, label).map(nasdaqThousands).filter((value): value is number => value !== null)
  if (series.length < 4) return null
  return series.slice(0, 4).reduce((sum, value) => sum + value, 0)
}

function inferCapex(table: { rows: Map<string, string[]> } | null): number | null {
  const explicit = lastFinite(rowSeries(table, 'Capital Expenditures').map(nasdaqThousands))
  if (explicit !== null) return Math.abs(explicit)
  const other = lastFinite(rowSeries(table, 'Other Investing Activities').map(nasdaqThousands))
  const ocf = lastFinite(rowSeries(table, 'Net Cash Flow-Operating').map(nasdaqThousands))
  if (other === null || ocf === null) return null
  const capex = Math.abs(other)
  if (ocf > 0 && capex / ocf > 0.15) return 0
  return capex
}

function latestCash(
  quarterly: { dates: string[]; rows: Map<string, string[]> } | null,
  annual: { dates: string[]; rows: Map<string, string[]> } | null,
): number | null {
  const pick = (table: { rows: Map<string, string[]> } | null) => {
    const cash = lastFinite(rowSeries(table, 'Cash and Cash Equivalents').map(nasdaqThousands))
    const sti = lastFinite(rowSeries(table, 'Short-Term Investments').map(nasdaqThousands)) ?? 0
    return cash === null ? null : cash + sti
  }
  const q = pick(quarterly)
  const a = pick(annual)
  if (q !== null && quarterlyNewer(quarterly, annual)) return q
  return q ?? a
}

function latestDebt(
  quarterly: { dates: string[]; rows: Map<string, string[]> } | null,
  annual: { dates: string[]; rows: Map<string, string[]> } | null,
): number | null {
  const pick = (table: { rows: Map<string, string[]> } | null) => {
    const st = lastFinite(
      rowSeries(table, 'Short-Term Debt / Current Portion of Long-Term Debt').map(nasdaqThousands),
    )
    const lt = lastFinite(rowSeries(table, 'Long-Term Debt').map(nasdaqThousands))
    if (st === null && lt === null) return 0
    return (st ?? 0) + (lt ?? 0)
  }
  const q = quarterly ? pick(quarterly) : null
  const a = annual ? pick(annual) : null
  if (q !== null && quarterlyNewer(quarterly, annual)) return q
  return q ?? a ?? 0
}

function quarterlyNewer(
  quarterly: { dates: string[] } | null,
  annual: { dates: string[] } | null,
): boolean {
  const q = parseUsDate(quarterly?.dates[0] ?? '')
  const a = parseUsDate(annual?.dates[0] ?? '')
  return Boolean(q && a && q > a)
}

function latestHeaderDate(table: { dates: string[] } | null): string | null {
  const parsed = parseUsDate(table?.dates[0] ?? '')
  return parsed
}

function parseUsDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function horizonLabel(fyEnd: string, years: number): string {
  const year = Number(fyEnd.slice(0, 4)) + years
  return Number.isFinite(year) ? `FY${year}` : `${years}Y`
}

function seriesCagr(values: number[]): number | null {
  if (values.length < 2) return null
  const newest = values[0]
  const oldest = values[values.length - 1]
  const n = values.length - 1
  if (!(newest > 0 && oldest > 0 && n > 0)) return null
  return (newest / oldest) ** (1 / n) - 1
}

function lastFinite(values: Array<number | null>): number | null {
  for (const value of values) {
    if (value !== null && Number.isFinite(value)) return value
  }
  return null
}

function parseNasdaqNumber(raw: string): number | null {
  const text = raw.trim()
  if (text === '' || text === '--' || text === 'N/A') return null
  const negative = text.includes('(') && text.includes(')')
  const value = Number(text.replace(/[$,()]/g, ''))
  if (!Number.isFinite(value)) return null
  return negative ? -value : value
}

function parsePlainNumber(raw: string | undefined): number | null {
  if (!raw) return null
  const value = Number(raw.replace(/[$,]/g, ''))
  return Number.isFinite(value) ? value : null
}

function cleanName(name: string): string {
  return name
    .replace(/\s+Common Stock$/i, '')
    .replace(/\s+Ordinary Shares$/i, '')
    .replace(/\s+Class [A-Z].*$/i, '')
    .replace(/\s+Inc\.?$/i, '')
    .trim()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round2(value: number): number {
  return Number(value.toFixed(2))
}

function round3(value: number): number {
  return Number(value.toFixed(3))
}

function fmtB(value: number): string {
  return `$${(value / 1e9).toFixed(2)}B`
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers })
  return readJson(response)
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(`http_${response.status}`)
  const payload: unknown = await response.json()
  if (!isRecord(payload)) throw new Error('bad_json')
  return payload
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function publicResearchError(message: string): string {
  if (message === 'missing_alpaca_credentials') return '未读取到 ALPACA_API_KEY / ALPACA_SECRET_KEY'
  if (message === 'ticker_invalid') return '代码不像美股 ticker'
  if (message === 'missing_spot') return '没有拉到现价'
  if (message === 'missing_financials' || message === 'missing_revenue') return '没有拉到财报收入'
  if (message.startsWith('http_404')) return '找不到这个代码的财报'
  return '自动研究失败'
}
