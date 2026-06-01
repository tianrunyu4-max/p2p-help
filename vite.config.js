import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',   // Capacitor 需要相对路径
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'https://p2p-help.uaegoucai.workers.dev',
        changeOrigin: true
      }
    }
  }
})
