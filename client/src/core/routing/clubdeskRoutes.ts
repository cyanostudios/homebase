/** Named clubdesk sub-route URL segments (not guide item slugs). */
export const CLUBDESK_SUBPAGES = ['price-list', 'info'] as const;

export type ClubdeskSubpage = (typeof CLUBDESK_SUBPAGES)[number];

export const CLUBDESK_SUBPAGE_SET = new Set<string>(CLUBDESK_SUBPAGES);

export function isClubdeskSubRoute(
  pluginName: string | undefined,
  subSegment: string | undefined,
): boolean {
  return pluginName === 'clubdesk' && Boolean(subSegment && CLUBDESK_SUBPAGE_SET.has(subSegment));
}

/**
 * Edit from the price-list index sets `deepLinkPathSyncedRef` to the item URL
 * before `navigate()`. If `priceLists` updates first (ensureFull is already
 * resolved after preview hydrate), the deep-link effect re-runs on the index
 * path and must not clobber that pending item URL — otherwise navigate looks
 * like a fresh deep link and `openPriceListForView` bounces edit back to view.
 */
export function shouldKeepPendingPriceListItemPath(
  currentPathname: string,
  pendingPath: string | null,
): boolean {
  const current = currentPathname.replace(/\/+$/, '') || '/';
  if (current !== '/clubdesk/price-list') {
    return false;
  }
  return Boolean(pendingPath && pendingPath.startsWith('/clubdesk/price-list/'));
}

/**
 * Where to send the user after closing a clubdesk panel.
 *
 * Returns a path only when the URL is still an item deep-link
 * (`/clubdesk/:guideSlug` or `/clubdesk/price-list/:slug`).
 * Returns `null` when the URL already left that item — sidebar navigation to
 * Price list / Info / another plugin, or a list index — so close must not
 * overwrite the in-flight destination (same class of bug as garments).
 */
export function resolveClubdeskPanelClosePath(
  pathname: string,
): '/clubdesk' | '/clubdesk/price-list' | null {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts[0] !== 'clubdesk') {
    return null;
  }

  // /clubdesk/price-list/:slug → price-list index; /clubdesk/price-list → stay
  if (parts[1] === 'price-list') {
    return parts[2] ? '/clubdesk/price-list' : null;
  }

  // Named subpages without an item slug (e.g. /clubdesk/info)
  if (!parts[1] || CLUBDESK_SUBPAGE_SET.has(parts[1])) {
    return null;
  }

  // /clubdesk/:guideSlug
  return '/clubdesk';
}
