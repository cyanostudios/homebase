/**
 * Legacy invoices URL segments. Kept so old bookmarks map to the list page
 * instead of being treated as invoice slugs.
 */
export const INVOICES_LEGACY_SUBPAGES = ['recurring', 'payments', 'reports'] as const;

export type InvoicesLegacySubpage = (typeof INVOICES_LEGACY_SUBPAGES)[number];

export const INVOICES_LEGACY_SUBPAGE_SET = new Set<string>(INVOICES_LEGACY_SUBPAGES);

/** @deprecated Use INVOICES_LEGACY_SUBPAGE_SET */
export const INVOICES_SUBPAGES = INVOICES_LEGACY_SUBPAGES;
/** @deprecated */
export type InvoicesSubpage = InvoicesLegacySubpage;
/** @deprecated */
export const INVOICES_SUBPAGE_SET = INVOICES_LEGACY_SUBPAGE_SET;

export function isInvoicesSubRoute(
  pluginName: string | undefined,
  subSegment: string | undefined,
): boolean {
  return (
    pluginName === 'invoices' && Boolean(subSegment && INVOICES_LEGACY_SUBPAGE_SET.has(subSegment))
  );
}
