import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

// Copy static files to dist
function copyStaticFiles() {
  return {
    name: 'copy-static-files',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist')
      const iconsDir = resolve(distDir, 'icons')

      // Create icons directory
      if (!existsSync(iconsDir)) {
        mkdirSync(iconsDir, { recursive: true })
      }

      // Copy manifest.json
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(distDir, 'manifest.json')
      )

      // Copy icons if they exist
      const iconSizes = ['16', '48', '128']
      for (const size of iconSizes) {
        const iconSrc = resolve(__dirname, `icons/icon-${size}.png`)
        if (existsSync(iconSrc)) {
          copyFileSync(iconSrc, resolve(iconsDir, `icon-${size}.png`))
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), copyStaticFiles()],
  resolve: {
    alias: {
      // Resolve convex API from extension's re-exports
      '@/convex': resolve(__dirname, 'convex'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background.ts'),
        offscreen: resolve(__dirname, 'offscreen.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    // Chrome extensions can't use dynamic imports from different origins
    target: 'esnext',
    minify: false, // Easier debugging during development
  },
  // Define env vars that will be inlined
  define: {
    'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(process.env.VITE_CLERK_PUBLISHABLE_KEY || ''),
    'import.meta.env.VITE_CONVEX_URL': JSON.stringify(process.env.VITE_CONVEX_URL || ''),
    'import.meta.env.VITE_SYNC_HOST': JSON.stringify(process.env.VITE_SYNC_HOST || 'http://localhost:3000'),
  },
})
