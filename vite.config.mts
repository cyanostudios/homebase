import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: './client',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  server: {
    port: 3001,
    /** Do not fall back to another port — proxy targets API on :3002; if 3001 is busy, fail loudly. */
    strictPort: true,
    hmr: {
      overlay: true,
      port: 3001,
    },
    watch: {
      usePolling: true,
      interval: 100,
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
        secure: false,
        ws: true,
        cookiePathRewrite: '/',
        // Preserve cookies and session
        onProxyReq: (proxyReq, req, _res) => {
          if (req.headers.cookie) {
            proxyReq.setHeader('Cookie', req.headers.cookie);
          }
        },
        onProxyRes: (proxyRes, _req, _res) => {
          proxyRes.headers['Cache-Control'] =
            'no-store, no-cache, must-revalidate, proxy-revalidate';
          proxyRes.headers['Pragma'] = 'no-cache';
          proxyRes.headers['Expires'] = '0';

          if (proxyRes.headers['set-cookie']) {
            proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(
              (cookie: string) => {
                return cookie
                  .replace(/;\s*Domain=[^;]*/gi, '')
                  .replace(/^Domain=[^;]+;\s*/gi, '')
                  .replace(/Secure;?/gi, '')
                  .replace(/SameSite=None/gi, 'SameSite=Lax');
              },
            );
          }
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('Vite proxy error:', err);
          });
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
  clearScreen: false,
});
