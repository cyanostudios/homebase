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
