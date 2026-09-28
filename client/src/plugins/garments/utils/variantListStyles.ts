import { FORM_COMPACT_INPUT_CLASS } from '@/core/ui/formFieldStyles';

/** Compact variant list row — read (quick context / detail view). */
export const VARIANT_LIST_ROW_CLASS =
  'flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1.5';

/** Compact variant edit row shell (form). */
export const VARIANT_EDIT_ROW_CLASS =
  'flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1.5';

export const VARIANT_WARNING_DOT_CLASS = 'h-1.5 w-1.5 shrink-0 rounded-full bg-red-500';

export const VARIANT_WARNING_DOT_PLACEHOLDER_CLASS = 'h-1.5 w-1.5 shrink-0 rounded-full invisible';

export const VARIANT_COMPACT_LABEL_CLASS =
  'text-[10px] font-normal leading-none text-slate-400 dark:text-slate-500';

/** Filled compact control for variant edit rows. */
export const VARIANT_COMPACT_INPUT_CLASS = `mt-0.5 ${FORM_COMPACT_INPUT_CLASS}`;

/** Edit row: SKU grows; other columns stay content-sized. */
export const VARIANT_EDIT_GRID_CLASS =
  'grid min-w-0 flex-1 grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-[minmax(0,1.25fr)_5.5rem_5.5rem_4rem_3.5rem_auto] sm:items-end';

/**
 * Wide person matrix — horizontal scroll inside the card on phone, without trapping
 * vertical page scroll. overflow-x:auto would otherwise compute overflow-y to auto and,
 * with touch-action:pan-x, swallow vertical swipes that start on the table.
 * Bleeds to card horizontal padding on phone; contained from md.
 */
export const MATRIX_TABLE_SCROLL_CLASS =
  '-mx-4 min-w-0 max-w-[calc(100%+2rem)] overflow-x-auto overflow-y-hidden overscroll-x-contain touch-manipulation rounded-none border-x-0 border-y border-border md:mx-0 md:max-w-full md:rounded-md md:border';
