/**
 * Shared desktop page chrome for plugin lists, settings, history, and detail headers.
 * Keep list and detail title rows visually aligned (inset, gap, title scale).
 */

/**
 * Outer list page shell — ContactList reference (top/side/bottom inset).
 * Use overflow-x-clip (not hidden): hidden forces overflow-y to auto and breaks sticky quick context.
 */
export const PLUGIN_PAGE_LIST_SHELL_CLASS =
  'min-h-full overflow-x-clip bg-background px-4 pt-2 pb-4 md:px-6 md:pt-6 md:pb-5';

/** Vertical gap between list sections. Flex + gap skips `display:none` md-only headers on phone. */
export const PLUGIN_PAGE_SECTION_GAP_CLASS = 'flex min-w-0 flex-col gap-3 md:gap-6';

/** In-page title row: title left, actions right (matches ContactList header row). */
export const PLUGIN_PAGE_HEADER_CLASS = 'hidden items-start justify-between gap-6 md:flex';

/** Page / panel title — matches list headers (e.g. Contacts). */
export const PLUGIN_PAGE_TITLE_CLASS =
  'truncate text-2xl font-extrabold tracking-tight text-foreground';

/** Title row: heading inline with adjacent header controls. */
export const PLUGIN_PAGE_TITLE_ROW_CLASS = 'flex min-w-0 flex-1 flex-wrap items-center gap-2.5';

/** Trailing header actions (search, add, edit, close). */
export const PLUGIN_PAGE_HEADER_ACTIONS_CLASS = 'flex shrink-0 items-center gap-2 pt-0.5';

/** Cards | table split pill (`ListColumnLayoutToggle`, settings default list view). */
export const LIST_LAYOUT_TOGGLE_SHELL_CLASS =
  'inline-flex h-11 shrink-0 overflow-hidden rounded-full bg-white shadow-sm dark:bg-slate-950';

export const LIST_LAYOUT_TOGGLE_DIVIDER_CLASS = 'w-px self-stretch bg-border/40';

/** Slightly smaller title on phone detail headers. */
export const PLUGIN_PAGE_TITLE_MOBILE_CLASS = 'text-xl';

/** Primary name/title field in edit forms — same scale as list title. */
export const DETAIL_FORM_TITLE_INPUT_CLASS =
  'h-auto min-h-11 border-0 bg-transparent px-0 text-2xl font-extrabold tracking-tight shadow-none focus-visible:ring-0 focus-visible:ring-offset-0';

export const PLUGIN_PAGE_SUBTITLE_CLASS = 'text-sm text-muted-foreground';

/**
 * Detail panel scrollport — whole page scrolls (header + body + footer), like list view.
 * Horizontal inset lives on children so the scrollbar sits on the outer edge.
 */
export const DETAIL_PANEL_SHELL_CLASS =
  'flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden pt-6 pb-5';

/** Horizontal inset matching list `md:px-6` — apply to header, body, footer (not the scrollport). */
export const DETAIL_PANEL_INSET_CLASS = 'px-6';

/** Title + actions row inside detail panel. */
export const DETAIL_PANEL_HEADER_ROW_CLASS = 'flex shrink-0 items-start justify-between gap-6';

/** Detail body inside the shell scrollport — pad with DETAIL_PANEL_INSET_CLASS. */
export const DETAIL_PANEL_BODY_CLASS = '[&_.shadow-none]:border-none';

/** Phone floating chrome (bottom bar + detail Edit/Close) — translucent over content. */
export const MOBILE_FLOATING_CHROME_CLASS =
  'rounded-xl bg-background/30 shadow-sm backdrop-blur-md';
