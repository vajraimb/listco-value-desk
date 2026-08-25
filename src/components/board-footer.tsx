import { BANDS } from '@/lib/valuation'
import type { Watchlist } from '@/lib/types'

export function BoardFooter({ watchlist }: { watchlist: Watchlist }) {
  return (
    <footer className="border-t border-rule-strong pt-3 text-[0.6875rem] text-muted-foreground">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="num">版本 {watchlist.version}</span>
          <span className="text-rule-strong">·</span>
          <span style={{ color: 'var(--band-overshoot)' }}>{watchlist.disclaimer}</span>
          <span className="text-rule-strong">·</span>
          <span className="num">技能 {watchlist.skill}</span>
          {watchlist.priceAnchor && (
            <>
              <span className="text-rule-strong">·</span>
              <span>行情锚 {watchlist.priceAnchor}</span>
            </>
          )}
          {watchlist.researchNote && (
            <>
              <span className="text-rule-strong">·</span>
              <span>{watchlist.researchNote}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:ml-auto">
          {BANDS.map((band) => (
            <span key={band.key} data-band={band.key} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-[1px]"
                style={{ background: 'var(--band-soft)' }}
              />
              {band.label}
            </span>
          ))}
        </div>
      </div>
    </footer>
  )
}
