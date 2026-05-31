import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

const BASE = '/';

// ── gamedata.json content hash — used as revision in the SW precache manifest.
// When the extraction script regenerates gamedata.json, this hash changes → the
// SW fetches a fresh copy on the user's next visit.
function gamedataRevision(): string {
  try {
    return createHash('md5')
      .update(readFileSync('./public/gamedata.json'))
      .digest('hex')
      .slice(0, 8);
  } catch {
    return 'dev'; // fallback during CI before public/ is populated
  }
}

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      // ── Manifest ─────────────────────────────────────────────────────────────
      manifest: {
        name: 'Stardew Companion',
        short_name: 'SDV Guide',
        description: 'Stardew Valley companion — characters, items, farm planner, schedules and more',
        theme_color: '#2d1b0e',
        background_color: '#1a3d1f',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png',             sizes: '64x64',   type: 'image/png' },
          { src: 'pwa-192x192.png',            sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png',            sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png',  sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      // ── Workbox (GenerateSW strategy) ────────────────────────────────────────
      workbox: {
        // Only precache the core app shell — sprites are runtime-cached on demand.
        globPatterns: ['**/*.{js,css,html}', 'fonts/*.woff2', 'pwa-*.png', 'maskable-*.png', 'favicon.ico'],

        // gamedata.json lives in /public/ so Vite doesn't hash its name.
        // We supply an explicit revision so the SW re-fetches it whenever the
        // extraction script regenerates the file.
        additionalManifestEntries: [
          { url: 'gamedata.json', revision: gamedataRevision() },
        ],

        // ── Runtime caching ──────────────────────────────────────────────────
        runtimeCaching: [
          {
            // Sync API — always network, never cache.
            urlPattern: /\/(auth|rooms|join)\//,
            handler: 'NetworkOnly',
          },
          {
            // Sprites: portraits, buildings, trees, sprite sheets, crops.png.
            // CacheFirst — these are static game assets that never change between
            // releases. Cached on first use, served instantly thereafter.
            urlPattern: /\/sprites\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sprites-v1',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fallback for any other same-origin GET — StaleWhileRevalidate.
            urlPattern: ({ sameOrigin }) => sameOrigin,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'misc-v1',
              expiration: { maxEntries: 50 },
            },
          },
        ],

        // Don't navigate-fallback to index.html for API routes.
        navigateFallbackDenylist: [/^\/(auth|rooms|join|ws|health)/],
      },
    }),
  ],

  base: BASE,

  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'app.js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name ?? '';
          if (name.endsWith('.css')) return 'app.css';
          if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(name)) return 'images/[name][extname]';
          return '[name][extname]';
        },
      },
    },
  },
});
