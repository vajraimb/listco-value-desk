import { BandBar } from '@/components/band-bar'
import { fmtBillions, fmtMultiple, fmtPercent, fmtPrice, fmtPriceCompact } from '@/lib/format'
import { bandMeta } from '@/lib/valuation'
import type { TamVerdict } from '@/lib/types'
import type { PositionView } from '@/lib/valuation'

const VERDICT_COLOR: Record<TamVerdict, string> = {
  可行: 'var(--band-discount)',
  紧: 'var(--band-premium)',
  不可行: 'var(--band-overshoot)',
}

const VERDICT_TINT: Record<TamVerdict, string> = {
  可行: 'var(--band-discount-tint)',
  紧: 'var(--band-premium-tint)',
  不可行: 'var(--band-overshoot-tint)',
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div className="num mt-0.5 text-[0.8125rem]">{value}</div>
    </div>
  )
}

export function PositionCard({ view }: { view: PositionView }) {
  const { position, band, costBand, gap } = view
  const meta = bandMeta(band)
  const costMeta = costBand === null ? null : bandMeta(costBand)

  return (
    <article
      data-band={band}
      className="flex flex-col overflow-hidden rounded-[3px] border border-rule bg-card"
    >
      <header
        className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2"
        style={{ background: 'var(--band)', color: 'var(--band-fg)' }}
      >
        <span className="num text-sm font-semibold tracking-[0.12em]">
          {position.ticker || '—'}
        </span>
        {position.exchange && (
          <span className="text-[0.625rem] tracking-[0.14em] opacity-75">
            {position.exchange}
          </span>
        )}
        <span className="opacity-50">·</span>
        <span className="text-[0.8125rem] font-medium">{meta.label}</span>
        <span className="ml-auto text-[0.6875rem] opacity-85">{position.name}</span>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="num text-[2.5rem] leading-none tracking-[-0.02em]"
              style={{ color: 'var(--band)' }}
            >
              {fmtMultiple(position.multiple)}
            </div>
            <div className="label-caps mt-1.5">市值 / 基准</div>
          </div>
          <div
            className="num rounded-[2px] px-2 py-1 text-[0.6875rem]"
            style={{ background: 'var(--band-tint)', color: 'var(--band)' }}
          >
            {meta.rule}
          </div>
        </div>

        <div className="space-y-1 border-t border-rule pt-2.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.8125rem]">
            <span>
              现价 <span className="num font-medium">{fmtPrice(position.spot)}</span>
            </span>
            {position.cost !== null && (
              <span className="text-muted-foreground">
                成本 <span className="num">{fmtPriceCompact(position.cost)}</span>
              </span>
            )}
          </div>
          <p className="text-[0.6875rem] leading-relaxed" style={{ color: 'var(--band)' }}>
            {gap.label} <span className="num">{fmtPriceCompact(gap.abs)}</span>
            <span className="num">（{fmtPercent(gap.pct)}）</span>
            {costMeta && (
              <span className="text-muted-foreground">
                {' · '}成本落在{costMeta.label}
              </span>
            )}
          </p>
        </div>

        <BandBar view={view} />

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-rule pt-2.5 sm:grid-cols-4">
          <Metric label="TV / EV" value={fmtPercent(position.tvEv)} />
          <Metric
            label={`隐含 ${position.horizonYear || '目标年'} 收入`}
            value={fmtBillions(position.impliedRev)}
          />
          <Metric label="CAGR" value={fmtPercent(position.cagr)} />
          <Metric label="毛利率" value={fmtPercent(position.grossMargin)} />
        </div>

        {position.tam.length > 0 && (
          <div className="border-t border-rule pt-2.5">
            <div className="label-caps">TAM 判定</div>
            <ul className="mt-1.5 space-y-1">
              {position.tam.map((row) => (
                <li key={row.id} className="flex items-baseline gap-2 text-[0.75rem]">
                  <span
                    className="w-[3.25rem] shrink-0 rounded-[2px] px-1 py-px text-center text-[0.625rem]"
                    style={{
                      background: VERDICT_TINT[row.verdict],
                      color: VERDICT_COLOR[row.verdict],
                    }}
                  >
                    {row.verdict}
                  </span>
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="num ml-auto">{fmtPercent(row.share)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {position.triggers.length > 0 && (
          <div
            className="mt-auto rounded-[2px] border-l-2 p-2.5"
            style={{ borderColor: 'var(--band)', background: 'var(--band-tint)' }}
          >
            <div className="label-caps" style={{ color: 'var(--band)' }}>
              证伪触发
            </div>
            <ul className="mt-1.5 space-y-1">
              {position.triggers.map((trigger) => (
                <li
                  key={trigger.id}
                  className="flex gap-1.5 text-[0.75rem] leading-relaxed text-foreground/85"
                >
                  <span className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-current opacity-60" />
                  <span>{trigger.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  )
}
