import { useMemo, useState } from 'react'
import { BandLegend } from '@/components/band-legend'
import { BoardFooter } from '@/components/board-footer'
import { BoardHeader } from '@/components/board-header'
import { HedgeStrip } from '@/components/hedge-strip'
import { PositionCard } from '@/components/position-card'
import { SettingsSheet } from '@/components/settings/settings-sheet'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { useTheme } from '@/hooks/use-theme'
import { useWatchlist } from '@/hooks/use-watchlist'
import { buildPositionView } from '@/lib/valuation'

export default function App() {
  const api = useWatchlist()
  const { theme, toggleTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const views = useMemo(
    () => api.watchlist.positions.map(buildPositionView),
    [api.watchlist.positions],
  )

  return (
    <div className="min-h-dvh">
      <BoardHeader
        watchlist={api.watchlist}
        theme={theme}
        isEdited={api.isEdited}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="mx-auto flex max-w-[120rem] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <BandLegend positions={api.watchlist.positions} />

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

        <HedgeStrip hedges={api.watchlist.hedges} />
        <BoardFooter watchlist={api.watchlist} />
      </main>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} api={api} />
      <Toaster position="bottom-right" theme={theme === 'dark' ? 'dark' : 'light'} />
    </div>
  )
}
