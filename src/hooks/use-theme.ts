import { useCallback, useEffect, useState } from 'react'
import { loadStoredTheme, saveStoredTheme } from '@/lib/storage'
import type { Theme } from '@/lib/storage'

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() => loadStoredTheme() ?? 'paper')

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.dataset.theme = theme
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'paper' ? 'dark' : 'paper'
      saveStoredTheme(next)
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
