/** Desktop left sidebar widths (px). Phone/pad use overlay Sheet — not these. */
export const LEFT_SIDEBAR_EXPANDED_WIDTH_PX = 252;
export const LEFT_SIDEBAR_COLLAPSED_WIDTH_PX = 72;

export const LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY = 'homebase.leftSidebar.collapsed';

export function readLeftSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeLeftSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}
