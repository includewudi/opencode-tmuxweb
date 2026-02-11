import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
let backendPort = 8215, frontendPort = 5215
try {
  const config = JSON.parse(readFileSync(resolve(__dirname, '../../TmuxWeb/server/config.json'), 'utf8'))
  backendPort = config.port || 8215
  frontendPort = config.frontendPort || 5215
} catch { /* use defaults */ }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: frontendPort,
    proxy: {
      '/api': `http://localhost:${backendPort}`,
      '/ws': {
        target: `ws://localhost:${backendPort}`,
        ws: true,
      },
    },
  },
})

