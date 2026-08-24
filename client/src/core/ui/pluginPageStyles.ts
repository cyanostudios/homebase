/**
 * Shared desktop page chrome for plugin lists, settings, history, and detail headers.
 * Keep list and detail title rows visually aligned (inset, gap, title scale).
 */

/** Outer page padding (phone + pad/desktop). */
export const PLUGIN_PAGE_SHELL_CLASS = 'min-h-full bg-background px-4 pt-2 pb-4 md:px-6 md:py-4';

/** In-page title row: title/subtitle left, actions right. Phone-hidden for lists/settings. */
export const PLUGIN_PAGE_HEADER_CLASS = 'hidden items-start justify-between gap-4 md:flex';

export const PLUGIN_PAGE_TITLE_CLASS = 'truncate text-xl font-semibold tracking-tight';

export const PLUGIN_PAGE_SUBTITLE_CLASS = 'text-sm text-muted-foreground';

/** Detail panel desktop header — same inset/gap/alignment as list page header. */
export const DETAIL_PANEL_HEADER_DESKTOP_CLASS =
  'flex flex-shrink-0 items-start justify-between gap-4 px-6 py-4';

/** Detail panel desktop scroll body — same horizontal inset as list page. */
export const DETAIL_PANEL_BODY_DESKTOP_CLASS = 'px-6 pb-4 pt-4';

/** Phone floating chrome (bottom bar + detail Edit/Close) — translucent over content. */
export const MOBILE_FLOATING_CHROME_CLASS =
  'rounded-xl bg-background/30 shadow-sm backdrop-blur-md';
