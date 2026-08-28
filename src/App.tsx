import { useMemo, useState } from 'react'
import { BandLegend } from '@/components/band-legend'
import { BoardFooter } from '@/components/board-footer'
import { BoardHeader } from '@/components/board-header'
import { HedgeStrip } from '@/components/hedge-strip'
import { PositionCard } from '@/components/position-card'
import { SettingsSheet } from '@/components/settings/settings-sheet'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { useLiveQuotes } from '@/hooks/use-live-quotes'
import { useTheme } from '@/hooks/use-theme'
import { useWatchlist } from '@/hooks/use-watchlist'
import { applyQuotes } from '@/lib/quotes'
import { buildPositionView } from '@/lib/valuation'

export default function App() {
  const api = useWatchlist()
  const quotes = useLiveQuotes(api.watchlist.positions.map((position) => position.ticker))
  const { theme, toggleTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const board = useMemo(
    () => applyQuotes(api.watchlist, quotes.snapshot),
    [api.watchlist, quotes.snapshot],
  )

  const views = useMemo(
    () => board.positions.map(buildPositionView),
    [board.positions],
  )

  return (
    <div className="min-h-dvh">
      <BoardHeader
        watchlist={board}
        theme={theme}
        isEdited={api.isEdited}
        quotesStatus={quotes.status}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="mx-auto flex max-w-[120rem] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        {quotes.status === 'loading' ? (
          <div className="rounded-[3px] border border-dashed border-rule-strong bg-card px-6 py-16 text-center">
            <h2 className="text-[0.9375rem] font-medium">正在拉取美股最新成交</h2>
            <p className="mx-auto mt-2 max-w-md text-[0.8125rem] leading-relaxed text-muted-foreground">
              Alpaca · {board.positions.map((position) => position.ticker || '—').join(' / ')}
              。现价到位后再画带位，不先用基准日的旧数字。
            </p>
          </div>
        ) : (
          <>
            {quotes.status === 'stale' && quotes.error && (
              <p className="rounded-[3px] border border-rule bg-card px-3 py-2 text-[0.75rem] text-muted-foreground">
                {quotes.error}，先显示内置基准价。
              </p>
            )}
            {api.researchingIds.length > 0 && (
              <p className="rounded-[3px] border border-rule bg-card px-3 py-2 text-[0.75rem] text-muted-foreground">
                正在研究{' '}
                {api.watchlist.positions
                  .filter((position) => api.researchingIds.includes(position.id))
                  .map((position) => position.ticker || '新标的')
                  .join(' / ')}
                ：Alpaca 现价 + 财报三情景 DCF。
              </p>
            )}
            <BandLegend positions={board.positions} />

            {views.length === 0 ? (
              <div className="rounded-[3px] border border-dashed border-rule-strong bg-card px-6 py-16 text-center">
                <h2 className="text-[0.9375rem] font-medium">看板上还没有标的</h2>
                <p className="mx-auto mt-2 max-w-md text-[0.8125rem] leading-relaxed text-muted-foreground">
                  一个标的需要现价和 bear / base / bull 三条 DCF 边界。带位与颜色由这四个数字重算，
                  不用手填。
                </p>
                <Button className="mt-4" onClick={() => setSettingsOpen(true)}>
                  打开设置添加标的
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-3">
                {views.map((view) => (
                  <PositionCard key={view.position.id} view={view} />
                ))}
              </div>
            )}

            <HedgeStrip hedges={board.hedges} />
            <BoardFooter watchlist={board} />
          </>
        )}
      </main>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} api={api} />
      <Toaster position="bottom-right" theme={theme === 'dark' ? 'dark' : 'light'} />
    </div>
  )
}
