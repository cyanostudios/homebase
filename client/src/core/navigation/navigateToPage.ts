import type { NavPage } from '@/core/ui/Sidebar';

type NavigateFn = (page: NavPage) => void;

let navigateImpl: NavigateFn | null = null;

/** Registered from `App` so plugins can navigate without prop-drilling. */
export function registerAppNavigate(fn: NavigateFn | null) {
  navigateImpl = fn;
}

export function navigateToPage(page: NavPage) {
  if (!navigateImpl) {
    console.warn('[navigateToPage] App navigate not registered yet');
    return;
  }
  navigateImpl(page);
}
