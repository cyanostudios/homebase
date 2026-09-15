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
} from '@/plugins/invoices/utils/invoiceLineItemStyles';

/** Left stack (title/price/category) | description | actions */
export const PRICE_LIST_ITEM_EDIT_GRID_CLASS =
  'grid w-full min-w-[32rem] grid-cols-[minmax(10rem,14rem)_minmax(12rem,1fr)_auto] items-start gap-x-2.5';

export const PRICE_LIST_ITEM_EDIT_TRACK_CLASS = 'min-w-[32rem] space-y-2';

export const PRICE_LIST_ITEM_STACK_CLASS = 'flex min-w-0 flex-col gap-1.5';
