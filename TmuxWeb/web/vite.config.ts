import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const certFile = path.join(__dirname, '../server/cert.pem')
const keyFile = path.join(__dirname, '../server/key.pem')
const hasCerts = fs.existsSync(certFile) && fs.existsSync(keyFile)

// 从 config.json 读取统一配置（config_private.json 可覆盖）
function loadConfig() {
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, '../server/config.json'), 'utf-8'))
  const privPath = path.join(__dirname, '../server/config_private.json')
  if (fs.existsSync(privPath)) {
    const priv = JSON.parse(fs.readFileSync(privPath, 'utf-8'))
    Object.assign(base, priv)
  }
  return base
}
const cfg = loadConfig()
const backendPort = cfg.port ?? 8215
const frontendPort = cfg.frontendPort ?? 5215

const backendTarget = hasCerts ? `https://127.0.0.1:${backendPort}` : `http://127.0.0.1:${backendPort}`
const wsTarget = hasCerts ? `wss://127.0.0.1:${backendPort}` : `ws://127.0.0.1:${backendPort}`

export default defineConfig({
  plugins: [react()],

  server: {
    port: frontendPort,
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
    port: frontendPort,
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
