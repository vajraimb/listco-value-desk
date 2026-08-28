/** Pull guidance, TAM, KPIs and management quotes from SEC 8-K / 10-K text. */

const ARCHIVE_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ListcoValueDesk/1.1 research@example.com'
const DATA_UA = 'ListcoValueDesk/1.1 (local research; research@example.com)'

export interface FyGuidance {
  period: string
  low: number
  high: number
}

export interface LongTermGoal {
  year: string
  revenue: number
}

export interface DisclosureExtract {
  fyGuidance: FyGuidance | null
  qGuidance: FyGuidance | null
  tamBillions: number | null
  longTermGoal: LongTermGoal | null
  kpis: string[]
  quotes: string[]
  competitors: string[]
  sources: string[]
}

export async function loadDisclosures(cik: string): Promise<DisclosureExtract> {
  const empty: DisclosureExtract = {
    fyGuidance: null,
    qGuidance: null,
    tamBillions: null,
    longTermGoal: null,
    kpis: [],
    quotes: [],
    competitors: [],
    sources: [],
  }
  const padded = cik.replace(/\D/g, '').padStart(10, '0')
  const submissions = await fetchJson(
    `https://data.sec.gov/submissions/CIK${padded}.json`,
    { Accept: 'application/json', 'User-Agent': DATA_UA },
  ).catch(() => null)
  if (!submissions) return empty

  const recent = isRecord(submissions.filings) && isRecord(submissions.filings.recent)
    ? submissions.filings.recent
    : null
  if (!recent) return empty
  const forms = asStrings(recent.form)
  const accessions = asStrings(recent.accessionNumber)
  const docs = asStrings(recent.primaryDocument)
  const dates = asStrings(recent.filingDate)

  const eightKs: FilingRef[] = []
  const reportDates: string[] = []
  let tenK: FilingRef | null = null
  for (let i = 0; i < forms.length; i += 1) {
    const form = forms[i] ?? ''
    const accession = accessions[i]
    const doc = docs[i]
    const filed = dates[i] ?? ''
    if (!accession || !doc) continue
    if (form === '8-K') eightKs.push({ cik: padded, accession, doc, filed })
    if (form === '10-Q' || form === '10-K' || form === '10-K/A') reportDates.push(filed)
    if ((form === '10-K' || form === '10-K/A') && !tenK) {
      tenK = { cik: padded, accession, doc, filed }
    }
  }
  eightKs.sort((a, b) => {
    const ae = earningsScore(a.filed, reportDates)
    const be = earningsScore(b.filed, reportDates)
    return be - ae
  })

  const merged = { ...empty }
  let earningsFound = 0
  for (const filing of eightKs.slice(0, 6)) {
    if (earningsFound >= 2) break
    const raw = await fetchArchiveText(filingTxtUrl(filing)).catch(() => '')
    if (raw === '' || !/guidance|Financial Outlook/i.test(raw)) continue
    const exhibit =
      [extractExhibit(raw, 'EX-99.1'), extractExhibit(raw, 'EX-99.2')].filter(Boolean).join(' ') ||
      htmlToText(raw)
    const parsed = parseEarningsText(exhibit)
    if (!parsed.fyGuidance && parsed.kpis.length === 0) continue
    earningsFound += 1
    merged.sources.push(`SEC 8-K ${filing.filed} EX-99.1`)
    if (!merged.fyGuidance && parsed.fyGuidance) merged.fyGuidance = parsed.fyGuidance
    if (!merged.qGuidance && parsed.qGuidance) merged.qGuidance = parsed.qGuidance
    if (!merged.tamBillions && parsed.tamBillions) merged.tamBillions = parsed.tamBillions
    if (!merged.longTermGoal && parsed.longTermGoal) merged.longTermGoal = parsed.longTermGoal
    merged.kpis = unique([...merged.kpis, ...parsed.kpis])
    merged.quotes = unique([...merged.quotes, ...parsed.quotes])
  }

  if (!merged.tamBillions && tenK) {
    const html = await fetchArchiveText(filingDocUrl(tenK), 2_500_000).catch(() => '')
    if (html) {
      const parsed = parseEarningsText(htmlToText(html))
      if (parsed.tamBillions) {
        merged.tamBillions = parsed.tamBillions
        merged.sources.push(`SEC 10-K ${tenK.filed}`)
      }
      merged.competitors = unique([...merged.competitors, ...parsed.competitors])
      if (parsed.longTermGoal && !merged.longTermGoal) merged.longTermGoal = parsed.longTermGoal
    }
  }

  return merged
}

export function disclosureNotes(extract: DisclosureExtract): string[] {
  const notes: string[] = []
  if (extract.fyGuidance) {
    const g = extract.fyGuidance
    notes.push(`指引：${g.period} 收入 ${fmtRange(g.low, g.high)}`)
  }
  if (extract.qGuidance) {
    const g = extract.qGuidance
    notes.push(`下季指引：${g.period} 收入 ${fmtRange(g.low, g.high)}`)
  }
  if (extract.longTermGoal) {
    notes.push(
      `长期目标：${extract.longTermGoal.year} 收入 ${fmtB(extract.longTermGoal.revenue)}`,
    )
  }
  if (extract.tamBillions) {
    notes.push(`公司 TAM 口径：约 $${extract.tamBillions}B`)
  }
  for (const kpi of extract.kpis.slice(0, 3)) notes.push(kpi)
  for (const quote of extract.quotes.slice(0, 2)) notes.push(quote)
  return notes.slice(0, 7)
}

interface FilingRef {
  cik: string
  accession: string
  doc: string
  filed: string
}

function filingTxtUrl(filing: FilingRef): string {
  const bareCik = String(Number(filing.cik))
  const acc = filing.accession.replaceAll('-', '')
  return `https://www.sec.gov/Archives/edgar/data/${bareCik}/${acc}/${filing.accession}.txt`
}

function filingDocUrl(filing: FilingRef): string {
  const bareCik = String(Number(filing.cik))
  const acc = filing.accession.replaceAll('-', '')
  return `https://www.sec.gov/Archives/edgar/data/${bareCik}/${acc}/${filing.doc}`
}

function parseEarningsText(text: string): Omit<DisclosureExtract, 'sources'> {
  const plain = squeeze(text)
  return {
    fyGuidance: parseGuidance(plain, /fiscal year ending/i),
    qGuidance: parseGuidance(plain, /quarter ending/i),
    tamBillions: parseTamBillions(plain),
    longTermGoal: parseLongTermGoal(plain),
    kpis: parseKpis(plain),
    quotes: parseQuotes(plain),
    competitors: parseCompetitors(plain),
  }
}

function parseGuidance(text: string, periodRe: RegExp): FyGuidance | null {
  const block = text.match(
    new RegExp(
      `${periodRe.source} ([A-Za-z]+ \\d{1,2}, \\d{4}) as follows.{0,480}?Total revenues between \\$([0-9,\\.]+) and \\$([0-9,\\.]+) (million|billion)`,
      'i',
    ),
  )
  if (block) {
    return {
      period: block[1],
      low: toDollars(block[2], block[4]),
      high: toDollars(block[3], block[4]),
    }
  }
  const loose = text.match(
    /(?:expects?|expecting) (?:total )?revenues? (?:of|to be|between) \$([0-9,\.]+)(?: (?:to|and) \$([0-9,\.]+))? (million|billion)/i,
  )
  if (!loose) return null
  const unit = loose[3]
  const low = toDollars(loose[1], unit)
  const high = loose[2] ? toDollars(loose[2], unit) : low
  return { period: '公司指引', low, high }
}

function parseTamBillions(text: string): number | null {
  const patterns = [
    /\$([0-9]+(?:\.[0-9]+)?)\s*(billion|B)\+?\s+(?:total )?addressable market/i,
    /(?:total )?addressable market(?:\s*\(\s*TAM\s*\))?[^\.]{0,80}\$([0-9]+(?:\.[0-9]+)?)\s*(billion|B)/i,
    /\bTAM\b[^\.]{0,40}\$([0-9]+(?:\.[0-9]+)?)\s*(billion|B)/i,
    /\$([0-9]+(?:\.[0-9]+)?)\s*(billion|B)\+?\s+Life Sciences TAM/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    const value = Number(match[1])
    if (Number.isFinite(value) && value >= 1 && value <= 5000) return value
  }
  return null
}

function parseLongTermGoal(text: string): LongTermGoal | null {
  const match = text.match(
    /\$([0-9]+(?:\.[0-9]+)?)\s*billion revenue (?:goal|target|plan)(?: by | in )?(calendar year |FY|CY)?\s*(20\d{2})?/i,
  )
  const alt = text.match(
    /on track for (?:our )?\$([0-9]+(?:\.[0-9]+)?)\s*billion(?: revenue goal)?(?: by | in )?(20\d{2})?/i,
  )
  const hit = match ?? alt
  if (!hit) return null
  const revenue = Number(hit[1]) * 1e9
  const year = (match?.[3] || alt?.[2] || '2030').toString()
  if (!Number.isFinite(revenue) || revenue < 1e8) return null
  return { year, revenue }
}

function parseKpis(text: string): string[] {
  const items: string[] = []
  const live = text.match(
    /((?:Veeva )?[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)?)\s+(?:leadership )?(?:grew with )?more than (\d+) customers live/i,
  )
  if (live && live[1].length < 32) items.push(`${live[1].trim()}：${live[2]}+ 客户已上线`)
  const top = text.match(/total top (\d+) commitments to (\d+)/i)
  if (top) items.push(`前${top[1]}大承诺 ${top[2]} 家`)
  const topAlt = text.match(/(\d+) of (?:the )?top (\d+) (?:biopharmas?|customers|accounts)/i)
  if (topAlt) items.push(`前${topAlt[2]}大中已拿下 ${topAlt[1]} 家`)
  const customers = text.match(/surpassed (\d+) total customers/i)
  if (customers) items.push(`相关产品客户超过 ${customers[1]} 家`)
  return unique(items)
}

function parseQuotes(text: string): string[] {
  const items: string[] = []
  const re =
    /said (?:CEO|CFO|Chief Executive Officer|Chief Financial Officer) ([A-Z][A-Za-z .'-]{1,40})\.\s+([A-Z][^.]{20,180}\.)/g
  for (const match of text.matchAll(re)) {
    items.push(`${match[1].trim()}：${match[2].trim()}`)
    if (items.length >= 3) break
  }
  return items
}

function parseCompetitors(text: string): string[] {
  const match = text.match(/primarily compete with ([^.]{8,80})/i)
  if (!match) return []
  return match[1]
    .split(/,| and /)
    .map((part) => part.replace(/\s+/g, ' ').replace(/which has.*$/i, '').trim())
    .filter((part) => part.length > 2 && part.length < 40)
    .slice(0, 4)
}

function extractExhibit(raw: string, type: string): string {
  const match = raw.match(new RegExp(`<TYPE>${type}\\b([\\s\\S]*?)(?=<TYPE>|$)`, 'i'))
  return match ? htmlToText(match[1]) : ''
}

function htmlToText(raw: string): string {
  return squeeze(
    raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#\d+;/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&'),
  )
}

function squeeze(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function toDollars(raw: string, unit: string): number {
  const value = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(value)) return 0
  return unit.toLowerCase().startsWith('b') ? value * 1e9 : value * 1e6
}

function fmtB(value: number): string {
  return `$${(value / 1e9).toFixed(2).replace(/\.00$/, '')}B`
}

function fmtRange(low: number, high: number): string {
  const a = (low / 1e8).toFixed(2)
  const b = (high / 1e8).toFixed(2)
  if (a === b) return `${a} 亿美元`
  return `${a}–${b} 亿美元`
}

function unique(items: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

function earningsScore(filed: string, reportDates: string[]): number {
  const t = Date.parse(filed)
  if (!Number.isFinite(t)) return 0
  let best = 0
  for (const report of reportDates) {
    const r = Date.parse(report)
    if (!Number.isFinite(r)) continue
    const days = Math.abs(t - r) / 86_400_000
    if (days <= 2) best = Math.max(best, 10 - days)
    else if (days <= 25) best = Math.max(best, 2)
  }
  return best
}

async function fetchArchiveText(url: string, maxBytes = 1_200_000): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'text/plain,text/html', 'User-Agent': ARCHIVE_UA },
      })
      if (!response.ok) throw new Error(`archive_${response.status}`)
      const buffer = await response.arrayBuffer()
      const slice = buffer.byteLength > maxBytes ? buffer.slice(0, maxBytes) : buffer
      return new TextDecoder('utf-8', { fatal: false }).decode(slice)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('archive_fetch')
}

async function fetchJson(
  url: string,
  headers: Record<string, string>,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`http_${response.status}`)
  const payload: unknown = await response.json()
  if (!isRecord(payload)) throw new Error('bad_json')
  return payload
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
