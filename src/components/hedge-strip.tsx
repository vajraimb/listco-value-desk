import type { HedgeStrip as HedgeStripData } from '@/lib/types'

const MARKERS = ['a', 'b', 'c', 'd', 'e', 'f']

const ACCENTS = [
  'var(--band-overshoot)',
  '#5b5ba8',
  '#2f6f8f',
  'var(--band-falsified)',
]

export function HedgeStrip({ hedges }: { hedges: HedgeStripData }) {
  if (hedges.items.length === 0) return null

  return (
    <section className="rounded-[3px] border border-rule bg-card">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule px-3 py-2 sm:px-4">
        <h2 className="text-[0.8125rem] font-semibold tracking-[0.08em]">{hedges.title}</h2>
        {hedges.note && (
          <p className="text-[0.6875rem] text-muted-foreground sm:ml-auto">{hedges.note}</p>
        )}
      </div>
      <div className="grid gap-px bg-rule sm:grid-cols-2 xl:grid-cols-4">
        {hedges.items.map((item, index) => (
          <div key={item.id} className="bg-card p-3 sm:p-4">
            <div
              className="mb-2.5 h-[3px] w-8 rounded-full"
              style={{ background: ACCENTS[index % ACCENTS.length] }}
            />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="num text-[0.6875rem] text-muted-foreground">
                {MARKERS[index] ?? index + 1}
              </span>
              <h3 className="text-[0.8125rem] font-medium">{item.title}</h3>
              {item.subtitle && (
                <span className="text-[0.6875rem] text-muted-foreground">{item.subtitle}</span>
              )}
            </div>
            <ul className="mt-2 space-y-1.5">
              {item.lines.map((line, lineIndex) => (
                <li
                  key={lineIndex}
                  className="text-[0.75rem] leading-relaxed text-foreground/85"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
