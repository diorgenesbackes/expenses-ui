import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Certificates and API addresses are local process configuration, never browser secrets.
export default defineConfig({
  plugins: [react()],
  server: {
    https:
      process.env.EXPENSES_TLS_CERT && process.env.EXPENSES_TLS_KEY
        ? {
            cert: readFileSync(process.env.EXPENSES_TLS_CERT),
            key: readFileSync(process.env.EXPENSES_TLS_KEY),
          }
        : undefined,
    proxy: {
      '/api': {
        target: process.env.EXPENSES_API_URL ?? 'https://localhost:7285',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
