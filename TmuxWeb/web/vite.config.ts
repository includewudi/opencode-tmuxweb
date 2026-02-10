import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5215,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8215',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:8215',
        ws: true,
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 5215,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8215',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:8215',
        ws: true,
        changeOrigin: true
      }
    }
  }
})
