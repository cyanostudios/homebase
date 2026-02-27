import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
        ws: true,
        // Keep cookie handling as close to upstream as possible.
        // Rewriting cookie domain/flags in dev has previously caused session split.
        onProxyRes: (proxyRes, req, _res) => {
          // DEBUG: Log /api/auth/me responses (for troubleshooting logout on reload)
          if (req.url?.includes('/api/auth/me')) {
            console.log('[PROXY] /api/auth/me', proxyRes.statusCode, 'hasSetCookie:', !!proxyRes.headers['set-cookie']);
          }
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            console.error('Vite proxy error:', err);
          });
        },
      }
    }
  }
})
