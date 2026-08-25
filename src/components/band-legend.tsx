import { BANDS, tallyBands } from '@/lib/valuation'
import type { Position } from '@/lib/types'

export function BandLegend({ positions }: { positions: Position[] }) {
  const tally = tallyBands(positions)

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {BANDS.map((band) => (
        <div
          key={band.key}
          data-band={band.key}
          className="flex items-center gap-2 rounded-[2px] px-3 py-1.5"
          style={{ background: 'var(--band)', color: 'var(--band-fg)' }}
        >
          <span className="text-[0.8125rem] font-semibold tracking-[0.05em]">{band.label}</span>
          <span className="num text-[0.6875rem] opacity-80">{band.rule}</span>
          <span className="num ml-auto rounded-[2px] bg-black/15 px-1.5 py-px text-[0.625rem]">
            {tally[band.key]} 只
          </span>
        </div>
      ))}
    </div>
  )
}
