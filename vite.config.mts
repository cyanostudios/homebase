import path from 'path';
import { fileURLToPath } from 'url';

import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const analyze = process.env.ANALYZE === '1' || process.env.ANALYZE === 'true';

export default defineConfig({
  root: './client',
  plugins: [
    react(),
    ...(analyze
      ? [
          visualizer({
            filename: path.resolve(__dirname, 'bundle-stats.html'),
            open: false,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }),
        ]
      : []),
  ],
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
        manualChunks(id) {
          // Plugin chunks — each plugin gets its own cacheable chunk
          if (id.includes('/plugins/contacts/')) return 'plugin-contacts';
          if (id.includes('/plugins/notes/')) return 'plugin-notes';
          if (id.includes('/plugins/tasks/')) return 'plugin-tasks';
          if (id.includes('/plugins/estimates/')) return 'plugin-estimates';
          if (id.includes('/plugins/invoices/')) return 'plugin-invoices';
          if (id.includes('/plugins/files/')) return 'plugin-files';
          if (id.includes('/plugins/matches/')) return 'plugin-matches';
          if (id.includes('/plugins/slots/')) return 'plugin-slots';
          if (id.includes('/plugins/cups/')) return 'plugin-cups';
          if (id.includes('/plugins/ingest/')) return 'plugin-ingest';
          if (id.includes('/plugins/mail/')) return 'plugin-mail';
          if (id.includes('/plugins/pulses/')) return 'plugin-pulses';
          if (id.includes('/plugins/settings/')) return 'plugin-settings';
          // Heavy vendor chunks — isolated for better caching and lazy-load targeting
          if (id.includes('@tiptap') || id.includes('tippy')) return 'vendor-tiptap';
          if (id.includes('recharts')) return 'vendor-recharts';
          if (id.includes('jspdf') || id.includes('html2pdf')) return 'vendor-pdf';
          if (id.includes('date-fns')) return 'vendor-datefns';
        },
      },
    },
  },
  clearScreen: false,
});
