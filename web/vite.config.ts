import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** GitHub Pages 서브패스 배포 시 manifest start_url·scope·아이콘 URL이 루트(`/`)로 깨지지 않도록 */
function pwaBasePrefix(): string {
  const raw = process.env.VITE_BASE_PATH
  if (!raw || raw === '/') return '/'
  const path = raw.replace(/^\/+/, '').replace(/\/+$/, '')
  return path ? `/${path}/` : '/'
}

const pwaPathPrefix = pwaBasePrefix()
const pwaStartUrl =
  pwaPathPrefix === '/' ? '/calendar' : `${pwaPathPrefix}calendar`

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  server: {
    /** OAuth redirect_to 와 Supabase Redirect URLs 가 항상 맞도록 포트 고정 */
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@hyunbinseo/holidays-kr')) {
            return 'holidays-kr'
          }
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // iOS PWA에서 prompt+배너는 waiting SW가 풀리지 않아 매 실행마다 뜨는 경우가 많아 autoUpdate 사용
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'MJ가계부',
        short_name: 'MJ가계부',
        description: 'MJ가계부 — 심플한 가계부 앱',
        start_url: pwaStartUrl,
        scope: pwaPathPrefix,
        display: 'standalone',
        display_override: ['standalone', 'browser'],
        background_color: '#f2f0eb',
        theme_color: '#f2f0eb',
        lang: 'ko',
        dir: 'ltr',
        orientation: 'any',
        categories: ['finance', 'productivity'],
        icons: [
          {
            src: `${pwaPathPrefix}pwa-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${pwaPathPrefix}pwa-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${pwaPathPrefix}pwa-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // index.html 을 precache 하면 배포 후 옛 HTML + 새 JS 조합으로 하얀 화면이 날 수 있음
        globPatterns: ['**/*.{js,css,ico,svg,png,webp,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
})
