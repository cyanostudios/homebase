import path from 'path';
import { fileURLToPath } from 'url';

import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const analyze = process.env.ANALYZE === '1' || process.env.ANALYZE === 'true';

/**
 * Chunk DAG (must stay acyclic for ES-module init — TDZ / white screen otherwise):
 *
 *   vendor-react / vendor-radix / vendor-lucide / vendor-date / vendor-misc / …
 *        ↑
 *   vendor-shared   (leaf UI only — NEVER imports app-context, app-shell, or plugin-*)
 *        ↑
 *   app-context     (AppContext + hooks that only wrap it)
 *        ↑
 *   app-shell       (layout, nav, registry, dashboard, widgets that need app)
 *        ↑
 *   plugin-*        (may import vendor-shared + app-context; must not be imported by vendor-shared)
 *
 * node_modules must never land in plugin-* (shared deps would force vendor→plugin edges).
 */
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
          // Vite runtime helpers must not live in app-shell/plugin chunks (creates fake cycles).
          if (id.includes('vite/preload-helper') || id.includes('\0vite/')) {
            return 'vendor-shared';
          }

          // --- node_modules: never assign to plugin-* ---
          if (id.includes('/node_modules/')) {
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router') ||
              id.includes('/@remix-run/') ||
              id.includes('/react-i18next/') ||
              id.includes('/i18next/') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('/@radix-ui/')) return 'vendor-radix';
            if (id.includes('/lucide-react/')) return 'vendor-lucide';
            if (id.includes('/date-fns/') || id.includes('/react-day-picker/')) {
              return 'vendor-date';
            }
            if (id.includes('@tiptap') || id.includes('tippy')) return 'vendor-tiptap';
            if (id.includes('jspdf')) return 'vendor-pdf';
            // Leave other node_modules unassigned so Rollup can share them without
            // forcing a vendor-misc ↔ vendor-react cycle.
            return undefined;
          }

          // --- app-context: AppContext + thin wrappers (plugins may import these) ---
          if (id.includes('/core/api/AppContext')) return 'app-context';
          if (id.includes('/hooks/useEnabledPlugins')) return 'app-context';

          // --- app-shell: layout / nav / registry / AppContext consumers ---
          if (
            id.includes('/core/pluginRegistry') ||
            id.includes('/core/app/') ||
            id.includes('/core/navigation/') ||
            id.includes('/core/handlers/') ||
            id.includes('/core/rendering/') ||
            id.includes('/core/actions/')
          ) {
            return 'app-shell';
          }
          if (
            id.includes('/core/ui/BulkEmailDialog.') ||
            id.includes('/core/ui/BulkMessageDialog.')
          ) {
            return 'bulk-dialogs';
          }
          if (id.includes('/core/ui/')) {
            if (
              id.includes('/core/ui/dashboard/') ||
              id.includes('/core/ui/Dashboard.') ||
              id.includes('/core/ui/MainLayout.') ||
              id.includes('/core/ui/TopBar.') ||
              id.includes('/core/ui/topbar/') ||
              id.includes('/core/ui/AppRightSidebar.') ||
              id.includes('/core/ui/Sidebar.') ||
              id.includes('/core/ui/sidebar/') ||
              id.includes('/core/ui/LoginComponent.') ||
              id.includes('/core/ui/ResetPasswordPage.') ||
              id.includes('/core/ui/rightSidebar/')
            ) {
              return 'app-shell';
            }
            // Settings forms only used by settings plugin — own chunk (not app-shell).
            if (id.includes('/core/ui/SettingsForms/')) return 'settings-forms';
            return 'vendor-shared';
          }
          // Widget registration + TimeTrackingWidget need AppContext / shell chrome.
          // TimeTrackingActivityContext stays under core/widgets/ → vendor-shared (leaf).
          if (
            id.includes('/core/widgets/time-tracking/TimeTrackingWidget') ||
            id.includes('/core/widgets/time-tracking/index') ||
            id.includes('/core/widgets/index')
          ) {
            return 'app-shell';
          }

          // --- vendor-shared: leaf UI / utils (no AppContext, no plugins, no shell) ---
          if (id.includes('/components/ui/') || id.includes('/lib/utils')) return 'vendor-shared';
          if (id.includes('/hooks/') && !id.includes('/plugins/')) return 'vendor-shared';
          if (
            id.includes('/core/hooks/') ||
            id.includes('/core/types/') ||
            id.includes('/core/utils/')
          ) {
            return 'vendor-shared';
          }
          if (id.includes('/core/api/')) return 'vendor-shared';
          if (
            id.includes('/core/widgets/') ||
            id.includes('/core/list/') ||
            id.includes('/core/settings/') ||
            id.includes('/core/routing/')
          ) {
            return 'vendor-shared';
          }

          // --- plugins: isolate full Providers for post-auth lazy load only.
          // Do NOT force entire /plugins/<name>/ trees into one chunk — that creates
          // cross-plugin circular chunks (e.g. garments ↔ teams) and ES-module TDZ.
          if (id.includes('/plugins/contacts/context/ContactProvider')) {
            return 'plugin-contacts-provider';
          }
          if (id.includes('/plugins/notes/context/NoteProvider')) return 'plugin-notes-provider';
          if (id.includes('/plugins/tasks/context/TaskProvider')) return 'plugin-tasks-provider';
          if (id.includes('/plugins/estimates/context/EstimateProvider')) {
            return 'plugin-estimates-provider';
          }
          if (id.includes('/plugins/invoices/context/InvoicesProvider')) {
            return 'plugin-invoices-provider';
          }
          if (id.includes('/plugins/files/context/FilesProvider')) return 'plugin-files-provider';
          if (id.includes('/plugins/matches/context/MatchProvider')) {
            return 'plugin-matches-provider';
          }
          if (id.includes('/plugins/slots/context/SlotsProvider')) return 'plugin-slots-provider';
          if (id.includes('/plugins/cups/context/CupsProvider')) return 'plugin-cups-provider';
          if (id.includes('/plugins/ingest/context/IngestProvider')) {
            return 'plugin-ingest-provider';
          }
          if (id.includes('/plugins/mail/context/MailProvider')) return 'plugin-mail-provider';
          if (id.includes('/plugins/pulses/context/PulseProvider')) {
            return 'plugin-pulses-provider';
          }

          // Heavy cross-plugin UI: keep on dedicated async chunks (importers use lazy()).
          if (/\/plugins\/contacts\/components\/ContactLinkedItemsSection\.[tj]sx?$/.test(id)) {
            return 'plugin-contacts-linked';
          }
          if (id.includes('/plugins/contacts/components/ContactDetailHeaderMenus')) {
            return 'plugin-contacts-detail-menus';
          }
          if (id.includes('/plugins/matches/components/MatchQuickInfoDialog')) {
            return 'plugin-matches-quick-info';
          }
        },
      },
    },
  },
  clearScreen: false,
});
