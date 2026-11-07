import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import type { Plugin } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// Dev only: version the stylesheet URL by the newest source file time so a reload
// never reuses a cached copy of /src/index.css (Tailwind output depends on every source file).
function newestSourceTime(dir: string): number {
  let newest = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) newest = Math.max(newest, newestSourceTime(full))
    else newest = Math.max(newest, Math.floor(fs.statSync(full).mtimeMs))
  }
  return newest
}

function cssCacheBust(): Plugin {
  return {
    name: 'css-cache-bust',
    apply: 'serve',
    transformIndexHtml(html) {
      const version = newestSourceTime(path.resolve(__dirname, 'src'))
      return html.replace('href="/src/index.css"', `href="/src/index.css?v=${version}"`)
    },
  }
}

export default defineConfig({
  plugins: [react(), nodePolyfills(), cssCacheBust()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      '@tanstack/react-query',
      'wagmi',
      'wagmi/chains',
      'wagmi/connectors',
      'viem',
      'viem/chains',
      'connectkit',
      'framer-motion',
      'lucide-react',
      'sonner',
      'clsx',
      'tailwind-merge',
      '@circle-fin/app-kit',
      '@circle-fin/adapter-viem-v2',
      'vite-plugin-node-polyfills/shims/buffer',
      'vite-plugin-node-polyfills/shims/global',
      'vite-plugin-node-polyfills/shims/process',
    ],
  },
  server: {
    allowedHosts: true,
    cors: true,
  },
})
