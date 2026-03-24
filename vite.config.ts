import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
        onProxyReq: (proxyReq, req, res) => {
          // Forward cookies
          if (req.headers.cookie) {
            proxyReq.setHeader('Cookie', req.headers.cookie);
          }
        },
        onProxyRes: (proxyRes, req, res) => {
          // Disable caching for API responses in development
          proxyRes.headers['Cache-Control'] =
            'no-store, no-cache, must-revalidate, proxy-revalidate';
          proxyRes.headers['Pragma'] = 'no-cache';
          proxyRes.headers['Expires'] = '0';

          // Forward Set-Cookie headers — strip Domain/Secure so the session sticks to the current host
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
          proxy.on('error', (err, _req, res) => {
            console.error('Vite proxy error:', err);
          });
        },
      },
    },
  },
  // Disable build cache in development to ensure fresh builds
  build: {
    rollupOptions: {
      output: {
        // Ensure unique file names to prevent browser caching
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
  // Clear Vite cache on startup in development
  clearScreen: false,
});
