import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clearStoredWatchlist,
  loadStoredWatchlist,
  saveStoredWatchlist,
} from '@/lib/storage'
import { SEED_WATCHLIST, blankPosition, serializeWatchlist } from '@/lib/watchlist'
import type { HedgeItem, Position, Watchlist } from '@/lib/types'

const SEED_JSON = serializeWatchlist(SEED_WATCHLIST)

export interface WatchlistApi {
  watchlist: Watchlist
  /** True once the board differs from the checked-in data/watchlist.json. */
  isEdited: boolean
  patchMeta: (patch: Partial<Omit<Watchlist, 'positions' | 'hedges'>>) => void
  patchPosition: (id: string, patch: Partial<Position>) => void
  addPosition: () => string
  removePosition: (id: string) => void
  movePosition: (id: string, direction: -1 | 1) => void
  patchHedge: (id: string, patch: Partial<HedgeItem>) => void
  replaceAll: (next: Watchlist) => void
  resetToSeed: () => void
}

export function useWatchlist(): WatchlistApi {
  const [watchlist, setWatchlist] = useState<Watchlist>(
    () => loadStoredWatchlist() ?? SEED_WATCHLIST,
  )
  // Nothing is written back until the desk actually edits or imports, so a
  // later change to the checked-in seed still reaches untouched browsers.
  const persist = useRef(loadStoredWatchlist() !== null)

  useEffect(() => {
    if (persist.current) saveStoredWatchlist(watchlist)
  }, [watchlist])

  const commit = useCallback((updater: (current: Watchlist) => Watchlist) => {
    persist.current = true
    setWatchlist(updater)
  }, [])

  const patchMeta = useCallback<WatchlistApi['patchMeta']>(
    (patch) => commit((current) => ({ ...current, ...patch })),
    [commit],
  )

  const patchPosition = useCallback<WatchlistApi['patchPosition']>(
    (id, patch) =>
      commit((current) => ({
        ...current,
        positions: current.positions.map((position) =>
          position.id === id ? { ...position, ...patch } : position,
        ),
      })),
    [commit],
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
    setWatchlist(SEED_WATCHLIST)
  }, [])

  const isEdited = useMemo(() => serializeWatchlist(watchlist) !== SEED_JSON, [watchlist])

  return {
    watchlist,
    isEdited,
    patchMeta,
    patchPosition,
    addPosition,
    removePosition,
    movePosition,
    patchHedge,
    replaceAll,
    resetToSeed,
  }
}
