import type { Plugin } from 'vite'
import { publicResearchError, researchTicker } from './ticker-research.ts'

export function tickerResearch(): Plugin {
  return {
    name: 'ticker-research',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ? new URL(req.url, 'http://localhost') : null
        if (!url || !isResearchPath(url.pathname, server.config.base)) {
          next()
          return
        }

        const ticker = (url.searchParams.get('ticker') ?? '').trim().toUpperCase()
        researchTicker(ticker)
          .then((result) => {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify(result))
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : '自动研究失败'
            res.statusCode = message === 'missing_alpaca_credentials' ? 503 : 502
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify({ error: publicResearchError(message) }))
          })
      })
    },
  }
}

function isResearchPath(pathname: string, base: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const prefixed = `${base.replace(/\/+$/, '')}/research.json`
  return normalized === '/research.json' || normalized === prefixed
}
