/**
 * Invoice line-item + form control tokens.
 * Filled field chrome lives in `@/core/ui/formFieldStyles` — re-exported here for
 * existing invoice imports.
 */

import {
  FORM_COMPACT_INPUT_CLASS,
  FORM_COMPACT_SELECT_CLASS,
  FORM_FIELD_FILLED_CHROME,
  FORM_INPUT_CLASS,
  FORM_PROP_CONTROL_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/core/ui/formFieldStyles';

/** @deprecated Prefer FORM_FIELD_FILLED_CHROME from `@/core/ui/formFieldStyles`. */
export const INVOICE_FIELD_FILLED_CHROME = FORM_FIELD_FILLED_CHROME;

/** @deprecated Prefer FORM_INPUT_CLASS from `@/core/ui/formFieldStyles`. */
export const INVOICE_FORM_INPUT_CLASS = FORM_INPUT_CLASS;

/** @deprecated Prefer FORM_PROP_CONTROL_CLASS from `@/core/ui/formFieldStyles`. */
export const INVOICE_FORM_PROP_CONTROL_CLASS = FORM_PROP_CONTROL_CLASS;

/** @deprecated Prefer FORM_TEXTAREA_CLASS from `@/core/ui/formFieldStyles`. */
export const INVOICE_FORM_TEXTAREA_CLASS = FORM_TEXTAREA_CLASS;

export const LINE_ITEM_LIST_ROW_CLASS =
  'flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-border/50 px-2 py-1';

/** Compact line-item edit row shell (form). */
export const LINE_ITEM_EDIT_ROW_CLASS =
  'flex items-start gap-2 rounded-md border border-border/60 px-2.5 py-2';

export const LINE_ITEM_COMPACT_LABEL_CLASS =
  'block text-[10px] font-normal leading-none text-slate-400 dark:text-slate-500';

/** Shared control height/padding — spacing to label comes from the field stack. */
export const LINE_ITEM_COMPACT_INPUT_CLASS = FORM_COMPACT_INPUT_CLASS;

export const LINE_ITEM_COMPACT_SELECT_CLASS = FORM_COMPACT_SELECT_CLASS;

/** Label + control stack — keeps every column aligned. */
export const LINE_ITEM_FIELD_CLASS = 'flex min-w-0 flex-col gap-1';

/**
 * Wide line-item rows — scroll inside the card when the viewport narrows
 * (same idea as garments `MATRIX_TABLE_SCROLL_CLASS`).
 */
export const LINE_ITEM_EDIT_SCROLL_CLASS =
  '-mx-3 min-w-0 max-w-[calc(100%+1.5rem)] overflow-x-auto overscroll-x-contain touch-pan-x md:mx-0 md:max-w-full';

/** Keep columns readable; horizontal scroll kicks in below this width. */
export const LINE_ITEM_EDIT_TRACK_CLASS = 'min-w-[48rem] space-y-2';

/**
 * Edit row: description grows; qty+unit / price / disc / vat / total stay even tracks.
 * Track min-width + scroll wrapper handle narrow viewports.
 */
export const LINE_ITEM_EDIT_GRID_CLASS =
  'grid w-full min-w-[48rem] grid-cols-[minmax(12rem,1.5fr)_8.25rem_5.75rem_4.25rem_4.25rem_7.5rem_auto] items-start gap-x-2.5';

/** Icon-only row actions — denser than RoundIconLabelButton `xs`. */
export const LINE_ITEM_ACTION_BUTTON_CLASS = 'h-5 min-w-5 [&_svg]:size-3';

export const LINE_ITEM_PRIMARY_TEXT_CLASS = 'truncate text-xs font-semibold text-foreground';

export const LINE_ITEM_SECONDARY_TEXT_CLASS = 'text-[10px] text-muted-foreground';

export const LINE_ITEM_VALUE_CLASS = 'text-xs tabular-nums text-foreground';

export const LINE_ITEM_MUTED_VALUE_CLASS = 'text-xs tabular-nums text-muted-foreground';
