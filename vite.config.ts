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
          // ── Plugin Provider chunks ─────────────────────────────────────────────
          // Loaded lazily at authentication via providerLoader; kept separate from
          // UI component chunks so navigating to a plugin page only loads its UI.
          if (id.includes('/plugins/contacts/context/ContactProvider')) return 'plugin-contacts-provider';
          if (id.includes('/plugins/notes/context/NoteProvider')) return 'plugin-notes-provider';
          if (id.includes('/plugins/tasks/context/TaskProvider')) return 'plugin-tasks-provider';
          if (id.includes('/plugins/estimates/context/EstimateProvider')) return 'plugin-estimates-provider';
          if (id.includes('/plugins/invoices/context/InvoicesProvider')) return 'plugin-invoices-provider';
          if (id.includes('/plugins/files/context/FilesProvider')) return 'plugin-files-provider';
          if (id.includes('/plugins/matches/context/MatchProvider')) return 'plugin-matches-provider';
          if (id.includes('/plugins/slots/context/SlotsProvider')) return 'plugin-slots-provider';
          if (id.includes('/plugins/cups/context/CupsProvider')) return 'plugin-cups-provider';
          if (id.includes('/plugins/ingest/context/IngestProvider')) return 'plugin-ingest-provider';
          if (id.includes('/plugins/mail/context/MailProvider')) return 'plugin-mail-provider';
          if (id.includes('/plugins/pulses/context/PulseProvider')) return 'plugin-pulses-provider';

          // ── Plugin UI chunks ──────────────────────────────────────────────────
          // Each plugin's List/Form/View components in a separate cacheable chunk.
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

          // ── Heavy vendor chunks ───────────────────────────────────────────────
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
