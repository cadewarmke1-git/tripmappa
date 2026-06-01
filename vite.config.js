import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteApiDevPlugin } from './scripts/vite-api-dev-plugin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), viteApiDevPlugin(mode)],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'server/**/*.test.js', 'api/**/*.test.js'],
  },
}))
