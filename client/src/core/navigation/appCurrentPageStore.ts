// Synced current nav page for providers that wrap AppContent (e.g. Analytics, Orders, Shipping)
// so they can defer bootstrap until the relevant page without prop-drilling every plugin Provider.
import type { NavPage } from '@/core/ui/Sidebar';

const STORAGE_KEY = 'homebase:currentPage';

function readStoredPage(): NavPage {
  if (typeof window === 'undefined') {
    return 'contacts';
  }
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return (saved as NavPage) || 'contacts';
}

let currentPage: NavPage = readStoredPage();
const listeners = new Set<() => void>();

export function getAppCurrentPage(): NavPage {
  return currentPage;
}

export function setAppCurrentPage(page: NavPage) {
  if (currentPage === page) {
    return;
  }
  currentPage = page;
  listeners.forEach((l) => l());
}

export function subscribeAppCurrentPage(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

/** True when analytics summary should be loaded (Dashboard widget + Analytics page). */
export function isAnalyticsBootstrapPage(page: NavPage): boolean {
  return page === 'analytics' || page === 'dashboard';
}

/** Mail history/settings: Mail page only (no dashboard widget). */
export function isMailBootstrapPage(page: NavPage): boolean {
  return page === 'mail';
}

/** Inspection projects: Inspection page only. */
export function isInspectionBootstrapPage(page: NavPage): boolean {
  return page === 'inspection';
}

/** Estimates list: Estimates page + Dashboard widget. */
export function isEstimatesBootstrapPage(page: NavPage): boolean {
  return page === 'estimates' || page === 'dashboard';
}

/** Invoices list: Invoices page + Dashboard widget. */
export function isInvoicesBootstrapPage(page: NavPage): boolean {
  return page === 'invoices' || page === 'dashboard';
}

/** Orders list: Orders page only (not needed for product stock; server applies inventory). */
export function isOrdersBootstrapPage(page: NavPage): boolean {
  return page === 'orders';
}

/** PostNord settings/senders/services: Orders (booking) + Frakt settings page. */
export function isShippingBootstrapPage(page: NavPage): boolean {
  return page === 'orders' || page === 'shipping';
}

/** Notes + tasks lists (AppContext): Notes/Tasks pages + Contacts (mentions / ContactView). */
export function isNotesTasksBootstrapPage(page: NavPage): boolean {
  return page === 'notes' || page === 'tasks' || page === 'contacts';
}

/** Plugin names (as in `user.plugins`) that imply e-commerce catalog/channel data may be needed. */
export const ECOMMERCE_CATALOG_PLUGINS = [
  'products',
  'channels',
  'woocommerce-products',
  'cdon-products',
  'fyndiq-products',
] as const;

export function hasEcommerceCatalogPlugins(
  user: { plugins?: string[] } | null | undefined,
): boolean {
  const plugins = user?.plugins;
  if (!plugins?.length) {
    return false;
  }
  return ECOMMERCE_CATALOG_PLUGINS.some((p) => plugins.includes(p));
}

/**
 * First-load bootstrap for product list, product settings, channels summary, Woo/CDON/Fyndiq settings.
 * Matches E-Commerce nav: Products, Channels (incl. submenu WooCommerce / CDON / Fyndiq).
 */
export function isEcommerceCatalogBootstrapPage(page: NavPage): boolean {
  return (
    page === 'products' ||
    page === 'channels' ||
    page === 'woocommerce-products' ||
    page === 'cdon-products' ||
    page === 'fyndiq-products'
  );
}
