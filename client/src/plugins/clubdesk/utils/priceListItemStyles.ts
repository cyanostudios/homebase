/**
 * Compact price-list item edit chrome — same tokens as invoice line items.
 */

export {
  LINE_ITEM_COMPACT_INPUT_CLASS,
  LINE_ITEM_COMPACT_LABEL_CLASS,
  LINE_ITEM_COMPACT_SELECT_CLASS,
  LINE_ITEM_EDIT_ROW_CLASS,
  LINE_ITEM_EDIT_SCROLL_CLASS,
  LINE_ITEM_EDIT_TRACK_CLASS,
  LINE_ITEM_FIELD_CLASS,
  LINE_ITEM_SECONDARY_TEXT_CLASS,
} from '@/plugins/invoices/utils/invoiceLineItemStyles';

/** Left fields (50%) | description (50%) | actions — price+category share one row in the left stack. */
export const PRICE_LIST_ITEM_EDIT_GRID_CLASS =
  'grid w-full min-w-[28rem] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-x-2.5';

export const PRICE_LIST_ITEM_EDIT_TRACK_CLASS = 'min-w-[28rem] space-y-2';

export const PRICE_LIST_ITEM_STACK_CLASS = 'flex min-w-0 flex-col gap-1.5';

/** Price | category on one row. */
export const PRICE_LIST_ITEM_PRICE_CATEGORY_ROW_CLASS = 'grid min-w-0 grid-cols-2 gap-x-2';

/** Unlink icon/label — amber like Contacts time-log / invoice credit-note actions (secondary shell). */
export const PRICE_LIST_UNLINK_CONTENT_CLASS = 'text-amber-700 dark:text-amber-400';
