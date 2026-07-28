/**
 * Detail view panel tokens (aligned with Contacts `ContactView`).
 * Use with `<Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>` on gray detail backgrounds.
 */
export const DETAIL_VIEW_CARD_CLASS = 'rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950';

/** List card hover — same as filter chips / ListFilterStatCard. */
export const DETAIL_LIST_ITEM_HOVER_CLASS = 'hover:bg-primary/10';

/** List card title — turns primary on card hover (matches filter text hover). */
export const DETAIL_LIST_ITEM_TITLE_CLASS =
  'text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary';

export const DETAIL_FIELD_LABEL_CLASS =
  'inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-slate-400 dark:text-slate-500 mb-0.5';

export const DETAIL_FIELD_LABEL_ICON_CLASS = 'h-3 w-3 shrink-0';

export const DETAIL_FIELD_VALUE_CLASS = 'text-[14px] font-medium text-foreground';

export const DETAIL_PROP_ROW_CLASS =
  'flex flex-col gap-2 py-3 border-b border-border/50 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-0';

export const DETAIL_NOTE_CALLOUT_CLASS = 'rounded-md bg-amber-50/70 p-3.5 dark:bg-amber-950/20';

export const DETAIL_EMPTY_STATE_CLASS =
  'text-center border border-dashed border-border rounded-lg p-8 bg-muted/30 mt-3';

export const DETAIL_INFO_ROW_CLASS =
  'flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-xs';

export const DETAIL_SURFACE_ROW_CLASS =
  'flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/70 dark:bg-muted/25';

/**
 * ExternalLink + label control for related entities / quick-info
 * (same visual language as list Select all / bulk actions).
 */
export const DETAIL_ENTITY_LINK_TRIGGER_CLASS =
  'h-9 shrink-0 gap-1.5 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary';

/** Ghost row buttons in Quick actions / Export sidebars */
export const DETAIL_QUICK_ACTION_ROW_CLASS =
  'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted/50 transition-colors';

/**
 * Compact list filter chips (e.g. Teams boys/girls, Requests types) —
 * same underline language as Select all / bulk actions.
 */
export const LIST_FILTER_CHIP_CLASS =
  'h-9 gap-1.5 rounded-md bg-white px-3 text-xs font-medium text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary dark:bg-slate-950';

export const LIST_FILTER_CHIP_ACTIVE_CLASS =
  'h-9 gap-1.5 rounded-md bg-primary/10 px-3 text-xs font-medium text-primary underline decoration-primary hover:bg-primary/10 hover:text-primary hover:decoration-primary';

/**
 * Large select-style chips (e.g. Teams detail tabs: Overview / Schedule) —
 * same underline language as the small chips, larger padding/type.
 */
export const LIST_FILTER_CHIP_LG_CLASS =
  'h-auto gap-1.5 rounded-md bg-white px-3 py-2 text-xs font-medium text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary sm:gap-2 sm:px-5 sm:py-3 sm:text-sm dark:bg-slate-950';

export const LIST_FILTER_CHIP_LG_ACTIVE_CLASS =
  'h-auto gap-1.5 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary underline decoration-primary hover:bg-primary/10 hover:text-primary hover:decoration-primary sm:gap-2 sm:px-5 sm:py-3 sm:text-sm';

/** Dashboard plugin widget card — same surface/hover language as select-style filter chips. */
export const DASHBOARD_WIDGET_CARD_CLASS =
  'relative flex min-h-[160px] cursor-pointer flex-col rounded-md border-0 bg-white p-4 shadow-none transition-colors hover:bg-primary/10 dark:bg-slate-950';
