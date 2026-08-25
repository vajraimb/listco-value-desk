const money = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactMoney = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function fmtPrice(value: number): string {
  return `$${money.format(value)}`
}

export function fmtPriceCompact(value: number): string {
  return `$${compactMoney.format(value)}`
}

export function fmtAxis(value: number): string {
  return compactMoney.format(value)
}

export function fmtPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function fmtMultiple(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(2)}×`
}

export function fmtBillions(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `$${compactMoney.format(value)}B`
}

/** Turns 0.187 into "18.7" for percent-shaped form inputs. */
export function toPercentInput(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  return String(Number((value * 100).toPrecision(12)))
}

export function fromPercentInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  return Number((parsed / 100).toPrecision(12))
}

export function toNumberInput(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  return String(value)
}

export function fromNumberInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}
