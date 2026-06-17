import path from "path"
import { createRequire } from "node:module"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import wasm from 'vite-plugin-wasm';
import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const require = createRequire(import.meta.url)
const nodePolyfillsRoot = path.dirname(path.dirname(require.resolve('vite-plugin-node-polyfills')))

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
    'process.env': {},
    global: 'globalThis',
  },
  plugins: [
    TanStackRouterVite(),
       nodePolyfills({
      // To add only specific polyfills, add them here.
      // If no specific polyfills are needed, you can leave this empty.
      include: ['buffer', 'process'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
    wasm(),
    react(),
    viteCommonjs(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'vite-plugin-node-polyfills/shims/buffer': path.resolve(nodePolyfillsRoot, 'shims/buffer/dist/index.js'),
      'vite-plugin-node-polyfills/shims/process': path.resolve(nodePolyfillsRoot, 'shims/process/dist/index.js'),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    exclude: [
      "@midnight-ntwrk/onchain-runtime-v2",
      "@midnight-ntwrk/ledger-v7",
    ],
  },
  build: {
    target: 'esnext',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: [],
    },
  },
  server: {
    port: 5174,
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/prove': {
        target: 'http://127.0.0.1:6300',
        changeOrigin: true,
      },
      '/check': {
        target: 'http://127.0.0.1:6300',
        changeOrigin: true,
      },
    },
  },
}))
