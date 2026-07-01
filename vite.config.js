import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const BUILD_TS = Date.now()
const BUILD_TS_SEC = Math.floor(BUILD_TS / 1000)

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'inject-build-ts',
      transformIndexHtml: {
        enforce: 'post',
        transform(html) {
          return html.replace('</head>', `<meta name="build-ts" content="${BUILD_TS}"></head>`)
        }
      },
      closeBundle() {
        const swPath = resolve(__dirname, 'dist/sw.js')
        if (existsSync(swPath)) {
          const content = readFileSync(swPath, 'utf-8')
          if (!content.includes('BUILD_TS:')) {
            writeFileSync(swPath, content + `\n/* BUILD_TS: ${BUILD_TS_SEC} */`)
          }
        }
      }
    },
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'P2P Help',
        short_name: 'P2P',
        description: 'P2P互助平台',
        theme_color: '#1a1a2e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true
      }
    })
  ],
  define: {
    __BUILD_TS__: JSON.stringify(String(BUILD_TS))
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info']
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
          'supabase-vendor': ['@supabase/supabase-js']
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: false
  },
  server: {
    host: true,
    port: 5174,
    proxy: {
      '/api': {
        target: 'https://p2p-help.uaegoucai.workers.dev',
        changeOrigin: true,
        secure: true
      }
    }
  }
})
