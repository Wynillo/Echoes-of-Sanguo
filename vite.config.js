import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

function copyBaseTcg() {
  const src = resolve('node_modules/@wynillo/echoes-mod-base/dist/base.tcg');
  const dest = resolve('public/base.tcg');
  let copied = false;

  function copy() {
    if (copied) return;
    // Skip if destination already exists (e.g., during tests)
    if (existsSync(dest)) {
      console.log('[copy-base-tcg] public/base.tcg already exists, skipping copy');
      copied = true;
      return;
    }
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

function resolveGitHubPackageCommit(pkgName) {
  try {
    const pkgJsonPath = resolve(`node_modules/${pkgName}/package.json`);
    if (!existsSync(pkgJsonPath)) return '';
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    const resolved = pkg._resolved || '';
    const match = resolved.match(/#([a-f0-9]+)$/);
    return match ? match[1].slice(0, 7) : '';
  } catch {
    return '';
  }
}

const tcgFormatBuild = resolveGitHubPackageCommit('@wynillo/tcg-format');
const modBaseBuild = resolveGitHubPackageCommit('@wynillo/echoes-mod-base');

export default defineConfig({
  define: {
    __ENGINE_BUILD__: JSON.stringify(commitHash),
    __TCG_FORMAT_BUILD__: JSON.stringify(tcgFormatBuild),
    __MOD_BASE_BUILD__: JSON.stringify(modBaseBuild),
  },
  server: {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=86400; includeSubDomains',
    },
  },
  preview: {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=86400; includeSubDomains',
    },
  },
  plugins: [
    react(),
    copyBaseTcg(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        start_url: '/',
        scope: '/',
      },
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
    // SECURITY: Limit inline asset size to prevent bundle bloat attacks
    assetsInlineLimit: 4096, // 4KB - small assets only
    // SECURITY: Warn on chunks exceeding 600KB to catch optimization issues early
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
