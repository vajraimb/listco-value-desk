import { useRef, useState } from 'react'
import { ClipboardCopy, Download, FileJson, Plus, RotateCcw, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { TextField } from '@/components/settings/fields'
import { PositionEditor } from '@/components/settings/position-editor'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { parseWatchlistJson, serializeWatchlist } from '@/lib/watchlist'
import type { WatchlistApi } from '@/hooks/use-watchlist'

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  api: WatchlistApi
}

export function SettingsSheet({ open, onOpenChange, api }: SettingsSheetProps) {
  const { watchlist } = api
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [importText, setImportText] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const json = serializeWatchlist(watchlist)

  const applyImport = (text: string, source: string) => {
    try {
      api.replaceAll(parseWatchlistJson(text))
      setImportText('')
      toast.success(`已导入 ${source}`)
    } catch (error) {
      toast.error(`导入失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const download = () => {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'watchlist.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success('已导出 watchlist.json')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      toast.success('JSON 已复制到剪贴板')
    } catch {
      toast.error('浏览器拒绝了剪贴板访问，请手动复制下面的文本')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-3xl!">
        <SheetHeader className="border-b border-rule px-4 py-3">
          <SheetTitle className="text-[0.9375rem] tracking-[0.08em]">看板设置</SheetTitle>
          <SheetDescription className="text-[0.6875rem]">
            改动即时写入 localStorage。导出 JSON 覆盖仓库里的 data/watchlist.json，即可把这份看板签入。
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="positions" className="min-h-0 flex-1 gap-0">
          <TabsList variant="line" className="w-full justify-start gap-2 border-b border-rule px-4 py-2">
            <TabsTrigger value="positions" className="flex-none px-2">
              标的
            </TabsTrigger>
            <TabsTrigger value="board" className="flex-none px-2">
              看板
            </TabsTrigger>
            <TabsTrigger value="hedges" className="flex-none px-2">
              降风险
            </TabsTrigger>
            <TabsTrigger value="data" className="flex-none px-2">
              数据
            </TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="min-h-0 overflow-y-auto p-4">
            <div className="space-y-2">
              {watchlist.positions.map((position, index) => (
                <PositionEditor
                  key={position.id}
                  position={position}
                  index={index}
                  total={watchlist.positions.length}
                  expanded={expandedId === position.id}
                  researching={api.researchingIds.includes(position.id)}
                  researchError={api.researchErrors[position.id]}
                  onToggle={() =>
                    setExpandedId((current) => (current === position.id ? null : position.id))
                  }
                  onPatch={(patch) => api.patchPosition(position.id, patch)}
                  onResearch={() => api.researchPosition(position.id)}
                  onMove={(direction) => api.movePosition(position.id, direction)}
                  onRemove={() => api.removePosition(position.id)}
                />
              ))}
              {watchlist.positions.length === 0 && (
                <p className="rounded-[3px] border border-dashed border-rule-strong px-3 py-6 text-center text-[0.75rem] text-muted-foreground">
                  看板是空的。加一个标的，填上美股代码，现价和 DCF 边界会自动跑出来。
                </p>
              )}
              <Button
                variant="outline"
                className="w-full gap-1.5"
                onClick={() => setExpandedId(api.addPosition())}
              >
                <Plus className="size-3.5" />
                新增标的
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="board" className="min-h-0 overflow-y-auto p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField
                label="看板标题"
                value={watchlist.title}
                onChange={(title) => api.patchMeta({ title })}
              />
              <TextField
                label="版本"
                value={watchlist.version}
                onChange={(version) => api.patchMeta({ version })}
              />
              <TextField
                label="基准日"
                value={watchlist.asOf}
                placeholder="2026-08-25"
                onChange={(asOf) => api.patchMeta({ asOf })}
              />
              <TextField
                label="行情锚"
                value={watchlist.priceAnchor}
                placeholder="2026-08-24 美股收盘"
                onChange={(priceAnchor) => api.patchMeta({ priceAnchor })}
              />
              <TextField
                label="计价货币"
                value={watchlist.currency}
                onChange={(currency) => api.patchMeta({ currency })}
              />
              <TextField
                label="技能"
                value={watchlist.skill}
                onChange={(skill) => api.patchMeta({ skill })}
              />
              <div className="sm:col-span-2">
                <TextField
                  label="风险声明"
                  hint="常驻显示"
                  value={watchlist.disclaimer}
                  onChange={(disclaimer) => api.patchMeta({ disclaimer })}
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  label="研究备注"
                  value={watchlist.researchNote}
                  onChange={(researchNote) => api.patchMeta({ researchNote })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hedges" className="min-h-0 overflow-y-auto p-4">
            <div className="space-y-3">
              {watchlist.hedges.items.map((item) => (
                <div key={item.id} className="space-y-2 rounded-[3px] border border-rule p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <TextField
                      label="工具"
                      value={item.title}
                      onChange={(title) => api.patchHedge(item.id, { title })}
                    />
                    <TextField
                      label="副标题"
                      value={item.subtitle}
                      onChange={(subtitle) => api.patchHedge(item.id, { subtitle })}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="label-caps">说明 · 一行一条</span>
                    <Textarea
                      value={item.lines.join('\n')}
                      rows={4}
                      onChange={(event) =>
                        api.patchHedge(item.id, {
                          lines: event.target.value.split('\n'),
                        })
                      }
                      className="text-[0.8125rem]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="data" className="min-h-0 overflow-y-auto p-4">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="gap-1.5" onClick={download}>
                  <Download className="size-3.5" />
                  导出 JSON
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={copy}>
                  <ClipboardCopy className="size-3.5" />
                  复制 JSON
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload className="size-3.5" />
                  从文件导入
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    applyImport(await file.text(), file.name)
                  }}
                />
                <Button
                  variant={confirmReset ? 'destructive' : 'ghost'}
                  className="gap-1.5"
                  onClick={() => {
                    if (!confirmReset) {
                      setConfirmReset(true)
                      return
                    }
                    api.resetToSeed()
                    setConfirmReset(false)
                    toast.success('已恢复到仓库内置基准')
                  }}
                  onBlur={() => setConfirmReset(false)}
                >
                  <RotateCcw className="size-3.5" />
                  {confirmReset ? '再点一次确认恢复' : '恢复内置基准'}
                </Button>
              </div>

              <div className="space-y-1">
                <span className="label-caps">粘贴 JSON 导入</span>
                <Textarea
                  value={importText}
                  rows={6}
                  placeholder='{ "positions": [ ... ] }'
                  onChange={(event) => setImportText(event.target.value)}
                  className="num text-[0.75rem]"
                />
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={importText.trim() === ''}
                  onClick={() => applyImport(importText, '粘贴的 JSON')}
                >
                  <FileJson className="size-3.5" />
                  导入
                </Button>
              </div>

              <div className="space-y-1">
                <span className="label-caps">当前看板 JSON</span>
                <Textarea
                  readOnly
                  value={json}
                  rows={14}
                  className="num text-[0.6875rem]"
                  onFocus={(event) => event.target.select()}
                />
                <p className="text-[0.625rem] text-muted-foreground">
                  想让改动跟着仓库走：导出后覆盖 data/watchlist.json 并提交。localStorage 里的本地
                  改动优先于内置文件，恢复内置基准会清掉本地副本。
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
