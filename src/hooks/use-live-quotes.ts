import { useEffect, useState } from 'react'
import { fetchLiveQuotes, uniqueTickers, type QuoteSnapshot } from '@/lib/quotes'

export type QuotesStatus = 'loading' | 'live' | 'stale'

export function useLiveQuotes(tickers: string[]): {
  snapshot: QuoteSnapshot | null
  status: QuotesStatus
  error: string | null
} {
  const symbols = uniqueTickers(tickers).join(',')
  const [snapshot, setSnapshot] = useState<QuoteSnapshot | null>(null)
  const [status, setStatus] = useState<QuotesStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const requested = symbols === '' ? [] : symbols.split(',')

    fetchLiveQuotes(requested, { signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) return
        setSnapshot(next)
        setStatus('live')
        setError(null)
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setStatus((current) => (current === 'live' ? 'live' : 'stale'))
        setError(caught instanceof Error ? caught.message : 'Alpaca 美股行情拉取失败')
      })

    return () => controller.abort()
  }, [symbols])

  return { snapshot, status, error }
}
