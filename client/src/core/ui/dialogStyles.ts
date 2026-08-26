/** Shared title styling for modal / popup dialog headers. */
export const DIALOG_TITLE_CLASS = 'text-xl font-extrabold text-foreground';

/** Muted line under the title (same horizontal inset as body fields). */
export const DIALOG_SUBTITLE_CLASS = 'mt-1 text-xs text-muted-foreground';

/** Header area for custom modals. */
export const DIALOG_HEADER_CLASS = 'shrink-0 px-5 pt-5 pb-4 sm:px-6';

/** Body area — horizontal padding matches header and footer. */
export const DIALOG_BODY_CLASS = 'px-5 pb-4 sm:px-6';

/** Scrollable body with standard vertical spacing between fields. */
export const DIALOG_BODY_SCROLL_CLASS =
  'flex min-h-0 flex-col gap-4 overflow-auto px-5 pb-4 sm:px-6';

/** Footer bar for custom modals (action buttons). */
export const DIALOG_FOOTER_CLASS = 'flex shrink-0 items-center justify-end gap-3 px-5 py-5 sm:px-6';

/** Footer with primary actions on the right and a secondary action on the left. */
export const DIALOG_FOOTER_SPLIT_CLASS =
  'flex shrink-0 flex-col-reverse gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6';
