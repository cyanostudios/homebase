import type { NavPage } from '@/core/navigation/navTypes';
import { INVOICES_SUBPAGE_SET } from '@/core/routing/invoicesRoutes';

/**
 * Maps every NavPage value to its canonical URL path.
 * The invoices sub-pages use named segments to avoid collision with item IDs
 * (e.g. /invoices/recurring vs /invoices/42).
 */
export const navPageToPath: Record<NavPage, string> = {
  dashboard: '/',
  contacts: '/contacts',
  notes: '/notes',
  tasks: '/tasks',
  requests: '/requests',
  teams: '/teams',
  schedule: '/schedule',
  matches: '/matches',
  slots: '/slots',
  cups: '/cups',
  estimates: '/estimates',
  invoices: '/invoices',
  'invoices-recurring': '/invoices/recurring',
  'invoices-payments': '/invoices/payments',
  'invoices-reports': '/invoices/reports',
  files: '/files',
  ingest: '/ingest',
  guides: '/guides',
  instructions: '/instructions',
  mail: '/mail',
  pulses: '/pulses',
  'ai-providers': '/ai-providers',
  settings: '/settings',
};

/**
 * Derives the active NavPage from a URL pathname.
 * Handles invoices sub-routes and tolerates trailing slashes.
 */
export function pathToNavPage(pathname: string): NavPage {
  const clean = pathname.replace(/\/+$/, '') || '/';

  if (clean === '/' || clean === '/dashboard') {
    return 'dashboard';
  }
  if (clean === '/settings') {
    return 'settings';
  }
  const parts = clean.split('/').filter(Boolean);
  const plugin = parts[0] as NavPage;
  const sub = parts[1];

  if (plugin === 'invoices' && sub && INVOICES_SUBPAGE_SET.has(sub)) {
    return `invoices-${sub}` as NavPage;
  }

  return plugin || 'dashboard';
}
