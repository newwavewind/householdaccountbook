import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/householdaccountbook/',
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
          if (id.includes('node_modules/date-holidays')) return 'date-holidays'
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.svg'],
      manifest: {
        name: '가계부',
        short_name: '가계부',
        description: '심플한 가계부 앱',
        start_url: '/',
        display: 'standalone',
        background_color: '#f2f0eb',
        theme_color: '#f2f0eb',
        lang: 'ko',
        orientation: 'any',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
      },
    }),
  ],
})
