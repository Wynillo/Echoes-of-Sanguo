import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

function copyBaseTcg() {
  const src = resolve('node_modules/@wynillo/echoes-mod-base/dist/base.tcg');
  const dest = resolve('public/base.tcg');
  let copied = false;

  function copy() {
    if (copied) return;
    if (!existsSync(src)) {
      throw new Error(`base.tcg not found: ${src}\nEnsure @wynillo/echoes-mod-base is installed.`);
    }
    copyFileSync(src, dest);
    console.log('[copy-base-tcg] Copied base.tcg → public/base.tcg');
    copied = true;
  }

  return {
    name: 'copy-base-tcg',
    buildStart() {
      copy();
    },
    configureServer() {
      copy();
    },
  };
}

const commitHash = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'unknown'; }
})();

export default defineConfig({
  define: {
    __ENGINE_BUILD__: JSON.stringify(commitHash),
  },
  plugins: [
    react(),
    copyBaseTcg(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,woff,woff2}'],
        globIgnores: ['**/*.{mp3,png,tcg}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/audio\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'eos-audio',
              expiration: { maxEntries: 25 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(png|jpg|jpeg|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'eos-images',
              expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  root: '.',
  base: './',
  optimizeDeps: {
    include: ['@wynillo/tcg-format'],
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/gsap')) {
            return 'vendor-gsap';
          }
          if (id.includes('node_modules/jszip')) {
            return 'vendor-jszip';
          }
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
  }
})
