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
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
        ws: true,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        // Preserve cookies and session
        onProxyReq: (proxyReq, req, res) => {
          // Forward cookies
          if (req.headers.cookie) {
            proxyReq.setHeader('Cookie', req.headers.cookie);
          }
        },
        onProxyRes: (proxyRes, req, res) => {
          // Forward Set-Cookie headers
          if (proxyRes.headers['set-cookie']) {
            proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map((cookie: string) => {
              return cookie
                .replace(/Domain=[^;]+;?/gi, 'Domain=localhost;')
                .replace(/Secure;?/gi, '')
                .replace(/SameSite=None/gi, 'SameSite=Lax');
            });
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
