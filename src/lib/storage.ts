import { normalizeWatchlist } from './watchlist'
import type { Watchlist } from './types'

export const STORAGE_KEY = 'listco-value-desk.watchlist.v1'
export const THEME_KEY = 'listco-value-desk.theme.v1'

export type Theme = 'paper' | 'dark'

export function loadStoredWatchlist(): Watchlist | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return normalizeWatchlist(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveStoredWatchlist(watchlist: Watchlist): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist))
  } catch {
    // A full or blocked storage quota must not take the board down.
  }
}

export function clearStoredWatchlist(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function loadStoredTheme(): Theme | null {
  try {
    const raw = window.localStorage.getItem(THEME_KEY)
    return raw === 'paper' || raw === 'dark' ? raw : null
  } catch {
    return null
  }
}

export function saveStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore
  }
}
