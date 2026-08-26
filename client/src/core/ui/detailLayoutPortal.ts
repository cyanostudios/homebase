/**
 * Pure helpers for DetailLayout ↔ app right-rail portal decisions.
 * Kept free of React so Jest (node) can unit-test without RTL.
 */

export interface DetailSidebarPortalInput {
  isDesktopLayout: boolean;
  isRightSidebarOpen: boolean;
  hasSidebar: boolean;
}

/** True when plugin `sidebar` should leave the detail grid (portal or wait for slot). */
export function shouldPreferDetailSidebarPortal(input: DetailSidebarPortalInput): boolean {
  return Boolean(input.isDesktopLayout && input.isRightSidebarOpen && input.hasSidebar);
}

/** True when content can be portaled into the live slot element. */
export function shouldPortalDetailSidebar(
  preferPortal: boolean,
  portalTarget: Element | null | undefined,
): boolean {
  return Boolean(preferPortal && portalTarget);
}

/**
 * Grid template when the plugin sidebar is out of the detail grid.
 * Ignores plugin `gridClassName` so an empty third column is not reserved.
 */
export function resolveDetailLayoutGridClass(options: {
  preferPortal: boolean;
  hasLeft: boolean;
  gridClassName?: string;
  defaultGridColsClass: string;
}): string {
  if (options.preferPortal) {
    return options.hasLeft ? 'grid-cols-1 lg:grid-cols-[1fr_1fr]' : 'grid-cols-1';
  }
  return options.gridClassName ?? options.defaultGridColsClass;
}
