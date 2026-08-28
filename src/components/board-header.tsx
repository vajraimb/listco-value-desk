import { Moon, Settings2, SunMedium } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { QuotesStatus } from '@/hooks/use-live-quotes'
import type { Theme } from '@/lib/storage'
import type { Watchlist } from '@/lib/types'

interface BoardHeaderProps {
  watchlist: Watchlist
  theme: Theme
  isEdited: boolean
  quotesStatus: QuotesStatus
  onToggleTheme: () => void
  onOpenSettings: () => void
}

const QUOTE_LABEL: Record<QuotesStatus, string> = {
  loading: 'Alpaca 拉取中',
  live: 'Alpaca 美股',
  stale: '内置基准价',
}

export function BoardHeader({
  watchlist,
  theme,
  isEdited,
  quotesStatus,
  onToggleTheme,
  onOpenSettings,
}: BoardHeaderProps) {
  const tickers = watchlist.positions.map((position) => position.ticker || '—').join(' / ')

  return (
    <header className="sticky top-0 z-30 border-b border-rule-strong bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-[120rem] flex-col gap-2 px-4 py-2.5 xl:flex-row xl:items-center xl:gap-5 xl:px-6">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h1 className="text-[0.9375rem] font-semibold tracking-[0.16em]">{watchlist.title}</h1>
          <span className="text-rule-strong">·</span>
          <span className="num text-[0.75rem] text-muted-foreground">{tickers || '空看板'}</span>
          <span className="text-rule-strong">·</span>
          <span className="text-[0.75rem] text-muted-foreground">
            基准日 <span className="num">{watchlist.asOf || '未填'}</span>
            {watchlist.priceAnchor && `（行情锚 ${watchlist.priceAnchor}）`}
          </span>
          <span className="rounded-[2px] bg-muted px-1.5 py-px text-[0.625rem] text-muted-foreground">
            {QUOTE_LABEL[quotesStatus]}
          </span>
          {isEdited && (
            <span className="rounded-[2px] bg-muted px-1.5 py-px text-[0.625rem] text-muted-foreground">
              本地已改
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
          <span
            className="rounded-[2px] px-2 py-1 text-[0.6875rem] font-medium"
            style={{
              background: 'var(--band-overshoot-tint)',
              color: 'var(--band-overshoot)',
            }}
          >
            {watchlist.disclaimer}
          </span>
          <span className="num text-[0.6875rem] text-muted-foreground">
            技能 {watchlist.skill}
          </span>
          <span className="num hidden text-[0.6875rem] text-muted-foreground sm:inline">
            {watchlist.currency}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleTheme}
            className="h-7 gap-1.5 px-2 text-[0.75rem]"
            aria-label="切换主题"
          >
            {theme === 'paper' ? <Moon className="size-3.5" /> : <SunMedium className="size-3.5" />}
            {theme === 'paper' ? '暗色' : '纸面'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            className="h-7 gap-1.5 px-2.5 text-[0.75rem]"
          >
            <Settings2 className="size-3.5" />
            设置
          </Button>
        </div>
      </div>
    </header>
  )
}
