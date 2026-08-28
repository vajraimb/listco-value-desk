import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clearStoredWatchlist,
  loadStoredWatchlist,
  saveStoredWatchlist,
} from '@/lib/storage'
import { applyResearch, fetchTickerResearch, isResearchableTicker } from '@/lib/research'
import {
  SEED_WATCHLIST,
  blankPosition,
  hydrateFromSeed,
  serializeWatchlist,
} from '@/lib/watchlist'
import type { HedgeItem, Position, Watchlist } from '@/lib/types'

const SEED_JSON = serializeWatchlist(SEED_WATCHLIST)

export interface WatchlistApi {
  watchlist: Watchlist
  /** True once the board differs from the checked-in data/watchlist.json. */
  isEdited: boolean
  researchingIds: string[]
  researchErrors: Record<string, string>
  patchMeta: (patch: Partial<Omit<Watchlist, 'positions' | 'hedges'>>) => void
  patchPosition: (id: string, patch: Partial<Position>) => void
  researchPosition: (id: string) => void
  addPosition: () => string
  removePosition: (id: string) => void
  movePosition: (id: string, direction: -1 | 1) => void
  patchHedge: (id: string, patch: Partial<HedgeItem>) => void
  replaceAll: (next: Watchlist) => void
  resetToSeed: () => void
}

export function useWatchlist(): WatchlistApi {
  const [draft, setDraft] = useState<Watchlist>(
    () => loadStoredWatchlist() ?? SEED_WATCHLIST,
  )
  // Shell rows (ticker filled, DCF empty) pick up research from the seed, so a
  // later watchlist.json still reaches a browser that already added the ticker.
  const watchlist = useMemo(() => hydrateFromSeed(draft, SEED_WATCHLIST), [draft])
  // Nothing is written back until the desk actually edits or imports, so a
  // later change to the checked-in seed still reaches untouched browsers.
  const persist = useRef(loadStoredWatchlist() !== null)
  const [researchingIds, setResearchingIds] = useState<string[]>([])
  const [researchErrors, setResearchErrors] = useState<Record<string, string>>({})
  const researchTimers = useRef(new Map<string, number>())
  const researchSeq = useRef(new Map<string, number>())

  useEffect(() => {
    if (persist.current) saveStoredWatchlist(watchlist)
  }, [watchlist])

  useEffect(
    () => () => {
      for (const handle of researchTimers.current.values()) window.clearTimeout(handle)
    },
    [],
  )

  const commit = useCallback((updater: (current: Watchlist) => Watchlist) => {
    persist.current = true
    setDraft((current) => updater(hydrateFromSeed(current, SEED_WATCHLIST)))
  }, [])

  const runResearch = useCallback(
    async (id: string, ticker: string) => {
      const symbol = ticker.trim().toUpperCase()
      if (!isResearchableTicker(symbol)) return
      const token = (researchSeq.current.get(id) ?? 0) + 1
      researchSeq.current.set(id, token)
      setResearchingIds((current) => (current.includes(id) ? current : [...current, id]))
      setResearchErrors((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      try {
        const result = await fetchTickerResearch(symbol)
        if (researchSeq.current.get(id) !== token) return
        commit((current) => ({
          ...current,
          positions: current.positions.map((position) =>
            position.id === id ? applyResearch(position, result) : position,
          ),
        }))
      } catch (caught: unknown) {
        if (researchSeq.current.get(id) !== token) return
        setResearchErrors((current) => ({
          ...current,
          [id]: caught instanceof Error ? caught.message : '自动研究失败',
        }))
      } finally {
        if (researchSeq.current.get(id) === token) {
          setResearchingIds((current) => current.filter((item) => item !== id))
        }
      }
    },
    [commit],
  )

  const scheduleResearch = useCallback(
    (id: string, ticker: string) => {
      const previous = researchTimers.current.get(id)
      if (previous) window.clearTimeout(previous)
      if (!isResearchableTicker(ticker)) return
      const handle = window.setTimeout(() => {
        void runResearch(id, ticker)
      }, 700)
      researchTimers.current.set(id, handle)
    },
    [runResearch],
  )

  const patchMeta = useCallback<WatchlistApi['patchMeta']>(
    (patch) => commit((current) => ({ ...current, ...patch })),
    [commit],
  )

  const patchPosition = useCallback<WatchlistApi['patchPosition']>(
    (id, patch) => {
      commit((current) => ({
        ...current,
        positions: current.positions.map((position) =>
          position.id === id ? { ...position, ...patch } : position,
        ),
      }))
      if (patch.ticker !== undefined) scheduleResearch(id, patch.ticker)
    },
    [commit, scheduleResearch],
  )

  const researchPosition = useCallback<WatchlistApi['researchPosition']>(
    (id) => {
      const position = watchlist.positions.find((item) => item.id === id)
      if (position) void runResearch(id, position.ticker)
    },
    [runResearch, watchlist.positions],
  )

  const addPosition = useCallback<WatchlistApi['addPosition']>(() => {
    const position = blankPosition()
    commit((current) => ({ ...current, positions: [...current.positions, position] }))
    return position.id
  }, [commit])

  const removePosition = useCallback<WatchlistApi['removePosition']>(
    (id) =>
      commit((current) => ({
        ...current,
        positions: current.positions.filter((position) => position.id !== id),
      })),
    [commit],
  )

  const movePosition = useCallback<WatchlistApi['movePosition']>(
    (id, direction) =>
      commit((current) => {
        const index = current.positions.findIndex((position) => position.id === id)
        const target = index + direction
        if (index === -1 || target < 0 || target >= current.positions.length) return current
        const positions = [...current.positions]
        const [moved] = positions.splice(index, 1)
        positions.splice(target, 0, moved)
        return { ...current, positions }
      }),
    [commit],
  )

  const patchHedge = useCallback<WatchlistApi['patchHedge']>(
    (id, patch) =>
      commit((current) => ({
        ...current,
        hedges: {
          ...current.hedges,
          items: current.hedges.items.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        },
      })),
    [commit],
  )

  const replaceAll = useCallback<WatchlistApi['replaceAll']>(
    (next) => commit(() => next),
    [commit],
  )

  const resetToSeed = useCallback(() => {
    clearStoredWatchlist()
    persist.current = false
    setDraft(SEED_WATCHLIST)
  }, [])

  const isEdited = useMemo(() => serializeWatchlist(watchlist) !== SEED_JSON, [watchlist])

  return {
    watchlist,
    isEdited,
    researchingIds,
    researchErrors,
    patchMeta,
    patchPosition,
    researchPosition,
    addPosition,
    removePosition,
    movePosition,
    patchHedge,
    replaceAll,
    resetToSeed,
  }
}
