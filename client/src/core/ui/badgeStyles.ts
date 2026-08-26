/** Standard plugin/list badge chip — 12px, weight 800. */
export const BADGE_CHIP_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

/** Compact pill badge text — 10px, weight 800. */
export const BADGE_PILL_TEXT_CLASS = 'text-[10px] font-extrabold';

/** Compact pill badge shell (status dots, yes/no pills). */
export const BADGE_PILL_CLASS = `inline-flex items-center rounded-full px-2 py-0.5 ${BADGE_PILL_TEXT_CLASS}`;

/** Meta badge on QuickContext link tiles (linked section) — 10px original size, weight 800. */
export const LINKED_TILE_META_BADGE_CLASS =
  'inline-flex h-4 max-w-full shrink items-center truncate rounded-md border-0 px-1.5 py-0 leading-none !text-[10px] !font-extrabold';

/** Badge chip in linked-section preview dialogs — 10px original size, weight 800. */
export const LINKED_SECTION_BADGE_CLASS =
  'inline-flex items-center rounded-md border-0 px-2 py-0.5 !text-[10px] !font-extrabold leading-none';
