import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import apiPlugin from './vite-plugin-api.js'

export default defineConfig({
  plugins: [react(), apiPlugin()],
  base: './',
  root: 'src/renderer',
  publicDir: '../../public',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src'),
    },
  },
})
