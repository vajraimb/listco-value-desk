import { fmtAxis } from '@/lib/format'
import type { PositionView } from '@/lib/valuation'

const SEGMENT_COLOR: Record<string, string> = {
  falsified: 'var(--band-falsified-soft)',
  discount: 'var(--band-discount-soft)',
  premium: 'var(--band-premium-soft)',
  overshoot: 'var(--band-overshoot-soft)',
}

function clampPct(pct: number): number {
  return Math.min(100, Math.max(0, pct))
}

/** Keeps edge labels inside the axis instead of letting them clip. */
function anchor(pct: number): { left: string; transform: string } {
  const left = `${clampPct(pct)}%`
  if (pct < 10) return { left, transform: 'translateX(0)' }
  if (pct > 90) return { left, transform: 'translateX(-100%)' }
  return { left, transform: 'translateX(-50%)' }
}

export function BandBar({ view }: { view: PositionView }) {
  const { segments, spotMark, costMark, bearMark, baseMark, bullMark } = view
  const stacked = costMark !== null && Math.abs(costMark.pct - spotMark.pct) < 16

  return (
    <div>
      <div className={stacked ? 'relative h-9' : 'relative h-5'}>
        {costMark && (
          <div
            className="absolute whitespace-nowrap text-[0.6875rem] text-muted-foreground"
            style={{ ...anchor(costMark.pct), top: stacked ? 0 : '0.25rem' }}
          >
            <span className="num">成本 {fmtAxis(costMark.value)}</span>
            <span className="ml-1 text-[0.5rem] align-middle">◆</span>
          </div>
        )}
        <div
          className="absolute whitespace-nowrap text-[0.6875rem] font-medium"
          style={{ ...anchor(spotMark.pct), top: stacked ? '1.25rem' : '0.25rem' }}
        >
          <span className="num">现 {fmtAxis(spotMark.value)}</span>
          <span className="ml-1 text-[0.5rem] align-middle">▼</span>
        </div>
      </div>

      <div className="relative h-3.5 overflow-hidden rounded-[2px] ring-1 ring-inset ring-black/10">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="absolute inset-y-0"
            style={{
              left: `${segment.left}%`,
              width: `${segment.width}%`,
              background: SEGMENT_COLOR[segment.key],
            }}
          />
        ))}
        {costMark && (
          <div
            className="absolute inset-y-0 w-0 border-l border-dashed border-foreground/60"
            style={{ left: `${clampPct(costMark.pct)}%` }}
          />
        )}
        <div
          className="absolute inset-y-[-2px] w-[2px] bg-foreground"
          style={{ left: `${clampPct(spotMark.pct)}%`, transform: 'translateX(-1px)' }}
        />
      </div>

      <div className="relative mt-1 h-4 text-[0.625rem] text-muted-foreground">
        {[
          { key: 'bear', prefix: '底', mark: bearMark },
          { key: 'base', prefix: '基', mark: baseMark },
          { key: 'bull', prefix: '涨', mark: bullMark },
        ].map(({ key, prefix, mark }) => (
          <div
            key={key}
            className="absolute whitespace-nowrap"
            style={anchor(mark.pct)}
          >
            {prefix} <span className="num">{fmtAxis(mark.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
