import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { viteApiDevPlugin } from './scripts/vite-api-dev-plugin.js'

function pwaRootAssetsPlugin() {
  const root = resolve(__dirname)
  const files = [
    { url: '/manifest.json', file: 'manifest.json', type: 'application/manifest+json' },
    { url: '/sw.js', file: 'sw.js', type: 'application/javascript; charset=utf-8' },
  ]
  return {
    name: 'pwa-root-assets',
    configureServer(server) {
      for (const { url, file, type } of files) {
        server.middlewares.use((req, res, next) => {
          if (req.url !== url && req.url !== `${url}?import`) return next()
          const path = resolve(root, file)
          if (!existsSync(path)) return next()
          res.setHeader('Content-Type', type)
          res.end(readFileSync(path))
        })
      }
    },
    closeBundle() {
      for (const { file } of files) {
        const src = resolve(root, file)
        if (existsSync(src)) {
          copyFileSync(src, resolve(root, 'dist', file))
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), viteApiDevPlugin(mode), pwaRootAssetsPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'server/**/*.test.js', 'api/**/*.test.js'],
  },
}))
