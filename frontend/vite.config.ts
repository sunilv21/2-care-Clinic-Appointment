import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    port: 5173,
    proxy: {
      // clinic backend (app/main.py) — default port 8080
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/outbound': { target: 'http://localhost:8080', changeOrigin: true },
      '/tools': { target: 'http://localhost:8080', changeOrigin: true },
      '/webhooks': { target: 'http://localhost:8080', changeOrigin: true },
      '/health': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
