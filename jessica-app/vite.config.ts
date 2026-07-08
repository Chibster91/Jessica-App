import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  base: '/Jessica-App/',
  server: {
    host: true,
  },
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png'],
    manifest: {
      name: 'FoodVault',
      short_name: 'FoodVault',
      description: 'Personal nutrition and health tracker',
      theme_color: '#171921',
      background_color: '#171921',
      display: 'standalone',
      start_url: '/Jessica-App/',
      scope: '/Jessica-App/',
      icons: [
        {
          src: 'pwa-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'pwa-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: 'pwa-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
  }), cloudflare()],
})