/** Named garments sub-route URL segments (not list item slugs). */
export const GARMENTS_SUBPAGES = ['inventory'] as const;

export type GarmentsSubpage = (typeof GARMENTS_SUBPAGES)[number];

export const GARMENTS_SUBPAGE_SET = new Set<string>(GARMENTS_SUBPAGES);

export function isGarmentsSubRoute(
  pluginName: string | undefined,
  subSegment: string | undefined,
): boolean {
  return pluginName === 'garments' && Boolean(subSegment && GARMENTS_SUBPAGE_SET.has(subSegment));
}

/**
 * Where to send the user after closing a garments panel.
 *
 * Returns a path only when the URL is still a list item (`/garments/:slug`).
 * Returns `null` when the URL already left that item — sidebar navigation to
 * Inventory or another plugin, the lists/inventory index, or a named sub-route —
 * so close must not overwrite the in-flight destination.
 */
export function resolveGarmentPanelClosePath(
  pathname: string,
  options: { returnToInventory: boolean },
): '/garments' | '/garments/inventory' | null {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts[0] !== 'garments') {
    return null;
  }
  const sub = parts[1];
  if (!sub || GARMENTS_SUBPAGE_SET.has(sub)) {
    return null;
  }
  return options.returnToInventory ? '/garments/inventory' : '/garments';
}
