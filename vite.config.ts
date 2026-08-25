import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // HOST=0.0.0.0 plus VITE_ALLOWED_HOSTS lets a tunnel or a phone on the
    // same network reach the dev server; the default stays loopback only.
    host: process.env.HOST ?? '127.0.0.1',
    port: 43117,
    strictPort: true,
    allowedHosts: process.env.VITE_ALLOWED_HOSTS?.split(',').filter(Boolean),
  },
})
