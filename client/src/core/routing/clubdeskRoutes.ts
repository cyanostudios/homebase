/** Named clubdesk sub-route URL segments (not guide item slugs). */
export const CLUBDESK_SUBPAGES = ['price-list'] as const;

export type ClubdeskSubpage = (typeof CLUBDESK_SUBPAGES)[number];

export const CLUBDESK_SUBPAGE_SET = new Set<string>(CLUBDESK_SUBPAGES);

export function isClubdeskSubRoute(
  pluginName: string | undefined,
  subSegment: string | undefined,
): boolean {
  return pluginName === 'clubdesk' && Boolean(subSegment && CLUBDESK_SUBPAGE_SET.has(subSegment));
}
