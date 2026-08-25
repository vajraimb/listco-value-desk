import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { NumericField, TextField } from '@/components/settings/fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fmtMultiple } from '@/lib/format'
import { TAM_VERDICTS } from '@/lib/types'
import { bandMeta, classify } from '@/lib/valuation'
import { makeId, positionIssues } from '@/lib/watchlist'
import type { Position, TamRow, TamVerdict, TriggerRow } from '@/lib/types'

interface PositionEditorProps {
  position: Position
  index: number
  total: number
  expanded: boolean
  onToggle: () => void
  onPatch: (patch: Partial<Position>) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}

export function PositionEditor({
  position,
  index,
  total,
  expanded,
  onToggle,
  onPatch,
  onMove,
  onRemove,
}: PositionEditorProps) {
  const band = classify(position.spot, position)
  const meta = bandMeta(band)
  const issues = positionIssues(position)

  const patchTam = (id: string, patch: Partial<TamRow>) =>
    onPatch({ tam: position.tam.map((row) => (row.id === id ? { ...row, ...patch } : row)) })

  const patchTrigger = (id: string, patch: Partial<TriggerRow>) =>
    onPatch({
      triggers: position.triggers.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    })

  return (
    <div data-band={band} className="rounded-[3px] border border-rule bg-card">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <span className="num w-4 text-[0.6875rem] text-muted-foreground">{index + 1}</span>
          <span className="num text-[0.8125rem] font-semibold">{position.ticker || '未命名'}</span>
          <span className="truncate text-[0.6875rem] text-muted-foreground">{position.name}</span>
          <span
            className="ml-auto shrink-0 rounded-[2px] px-1.5 py-px text-[0.625rem]"
            style={{ background: 'var(--band-tint)', color: 'var(--band)' }}
          >
            {meta.label} {fmtMultiple(position.multiple)}
          </span>
        </button>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="上移"
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="下移"
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label="移除标的"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-rule p-3">
          {issues.length > 0 && (
            <p
              className="rounded-[2px] px-2 py-1 text-[0.6875rem]"
              style={{
                background: 'var(--band-overshoot-tint)',
                color: 'var(--band-overshoot)',
              }}
            >
              {issues.join(' · ')}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <TextField
              label="代码"
              value={position.ticker}
              placeholder="FN"
              onChange={(value) => onPatch({ ticker: value.toUpperCase() })}
            />
            <TextField
              label="公司"
              value={position.name}
              placeholder="Fabrinet"
              onChange={(name) => onPatch({ name })}
            />
            <TextField
              label="交易所"
              value={position.exchange}
              placeholder="NYSE"
              onChange={(exchange) => onPatch({ exchange })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <NumericField
              label="现价"
              value={position.spot}
              onChange={(spot) => onPatch({ spot: spot ?? 0 })}
            />
            <NumericField
              label="成本"
              hint="可留空"
              value={position.cost}
              onChange={(cost) => onPatch({ cost })}
            />
            <NumericField
              label="bear"
              value={position.bear}
              onChange={(bear) => onPatch({ bear: bear ?? 0 })}
            />
            <NumericField
              label="base"
              value={position.base}
              onChange={(base) => onPatch({ base: base ?? 0 })}
            />
            <NumericField
              label="bull"
              value={position.bull}
              onChange={(bull) => onPatch({ bull: bull ?? 0 })}
            />
          </div>
          <p className="text-[0.625rem] text-muted-foreground">
            带位由现价与三条边界重算：当前 <span style={{ color: 'var(--band)' }}>{meta.label}</span>
            （{meta.rule}）。颜色不可手填。
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <NumericField
              label="倍数"
              hint="市值/基准"
              value={position.multiple}
              onChange={(multiple) => onPatch({ multiple })}
            />
            <NumericField
              label="TV / EV"
              hint="%"
              percent
              value={position.tvEv}
              onChange={(tvEv) => onPatch({ tvEv })}
            />
            <NumericField
              label="隐含收入"
              hint="十亿美元"
              value={position.impliedRev}
              onChange={(impliedRev) => onPatch({ impliedRev })}
            />
            <TextField
              label="目标年"
              value={position.horizonYear}
              placeholder="2030E"
              onChange={(horizonYear) => onPatch({ horizonYear })}
            />
            <NumericField
              label="CAGR"
              hint="%"
              percent
              value={position.cagr}
              onChange={(cagr) => onPatch({ cagr })}
            />
            <NumericField
              label="毛利率"
              hint="%"
              percent
              value={position.grossMargin}
              onChange={(grossMargin) => onPatch({ grossMargin })}
            />
          </div>

          <div className="space-y-2 border-t border-rule pt-2.5">
            <div className="flex items-center justify-between">
              <span className="label-caps">TAM 判定</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[0.6875rem]"
                onClick={() =>
                  onPatch({
                    tam: [
                      ...position.tam,
                      {
                        id: makeId(`${position.id}-tam`),
                        label: '',
                        share: null,
                        verdict: '紧' as TamVerdict,
                      },
                    ],
                  })
                }
              >
                <Plus className="size-3" />
                口径
              </Button>
            </div>
            {position.tam.map((row) => (
              <div key={row.id} className="flex items-end gap-2">
                <div className="flex-1">
                  <TextField
                    label="口径"
                    value={row.label}
                    placeholder="制造 SAM"
                    onChange={(label) => patchTam(row.id, { label })}
                  />
                </div>
                <div className="w-20">
                  <NumericField
                    label="份额"
                    hint="%"
                    percent
                    value={row.share}
                    onChange={(share) => patchTam(row.id, { share })}
                  />
                </div>
                <div className="w-24">
                  <Select
                    value={row.verdict}
                    onValueChange={(value: unknown) =>
                      patchTam(row.id, { verdict: value as TamVerdict })
                    }
                  >
                    <SelectTrigger size="sm" className="h-8 w-full text-[0.8125rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAM_VERDICTS.map((verdict) => (
                        <SelectItem key={verdict} value={verdict}>
                          {verdict}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="删除口径"
                  onClick={() =>
                    onPatch({ tam: position.tam.filter((item) => item.id !== row.id) })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-rule pt-2.5">
            <div className="flex items-center justify-between">
              <span className="label-caps">证伪触发</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[0.6875rem]"
                onClick={() =>
                  onPatch({
                    triggers: [
                      ...position.triggers,
                      { id: makeId(`${position.id}-trg`), text: '' },
                    ],
                  })
                }
              >
                <Plus className="size-3" />
                触发
              </Button>
            </div>
            {position.triggers.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <Input
                  value={row.text}
                  placeholder="连续两季 GM < 11.5%"
                  onChange={(event) => patchTrigger(row.id, { text: event.target.value })}
                  className="h-8 text-[0.8125rem]"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="删除触发"
                  onClick={() =>
                    onPatch({
                      triggers: position.triggers.filter((item) => item.id !== row.id),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
