// Synced current nav page for providers that wrap AppContent (e.g. Analytics) so they can
// defer bootstrap until Dashboard or Analytics without prop-drilling every plugin Provider.
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
