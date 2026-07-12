/** Named invoices sub-route URL segments (not invoice item IDs). */
export const INVOICES_SUBPAGES = ['recurring', 'payments', 'reports'] as const;

export type InvoicesSubpage = (typeof INVOICES_SUBPAGES)[number];

export const INVOICES_SUBPAGE_SET = new Set<string>(INVOICES_SUBPAGES);

export function isInvoicesSubRoute(
  pluginName: string | undefined,
  subSegment: string | undefined,
): boolean {
  return pluginName === 'invoices' && Boolean(subSegment && INVOICES_SUBPAGE_SET.has(subSegment));
}
