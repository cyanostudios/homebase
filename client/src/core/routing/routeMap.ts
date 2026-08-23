import type { NavPage } from '@/core/navigation/navTypes';
import { CLUBDESK_SUBPAGE_SET } from '@/core/routing/clubdeskRoutes';
import { GARMENTS_SUBPAGE_SET } from '@/core/routing/garmentsRoutes';
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
  garments: '/garments',
  'garments-lists': '/garments',
  'garments-inventory': '/garments/inventory',
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
  clubdesk: '/clubdesk',
  'clubdesk-guides': '/clubdesk',
  'clubdesk-price-list': '/clubdesk/price-list',
  'clubdesk-info': '/clubdesk/info',
  mail: '/mail',
  pulses: '/pulses',
  'ai-providers': '/ai-providers',
  settings: '/settings',
};

/**
 * Derives the active NavPage from a URL pathname.
 * Handles invoices / clubdesk / garments sub-routes and tolerates trailing slashes.
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

  if (plugin === 'clubdesk') {
    if (sub && CLUBDESK_SUBPAGE_SET.has(sub)) {
      return `clubdesk-${sub}` as NavPage;
    }
    // Bare /clubdesk and /clubdesk/:guideSlug both belong to the Guides tab.
    return 'clubdesk-guides';
  }

  if (plugin === 'garments') {
    if (sub && GARMENTS_SUBPAGE_SET.has(sub)) {
      return `garments-${sub}` as NavPage;
    }
    // Bare /garments and /garments/:listSlug both belong to the Lists tab.
    return 'garments-lists';
  }

  return plugin || 'dashboard';
}
