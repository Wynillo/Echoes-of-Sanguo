import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function copyBaseTcg() {
  return {
    name: 'copy-base-tcg',
    buildStart() {
      const src = resolve('node_modules/@wynillo/echoes-mod-base/dist/base.tcg');
      const dest = resolve('public/base.tcg');
      if (existsSync(src)) {
        copyFileSync(src, dest);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyBaseTcg()],
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
