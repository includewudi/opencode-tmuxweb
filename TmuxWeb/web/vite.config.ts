import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const certFile = path.join(__dirname, '../server/cert.pem')
const keyFile = path.join(__dirname, '../server/key.pem')
const hasCerts = fs.existsSync(certFile) && fs.existsSync(keyFile)

const backendTarget = hasCerts ? 'https://127.0.0.1:8215' : 'http://127.0.0.1:8215'
const wsTarget = hasCerts ? 'wss://127.0.0.1:8215' : 'ws://127.0.0.1:8215'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5215,
    https: hasCerts ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) } : undefined,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: wsTarget,
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    port: 5215,
    https: hasCerts ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) } : undefined,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: wsTarget,
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  }
})
