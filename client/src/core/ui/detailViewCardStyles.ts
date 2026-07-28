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
 * (facit: RequestView → team “Open team”).
 */
export const DETAIL_ENTITY_LINK_TRIGGER_CLASS =
  'h-7 shrink-0 gap-1.5 px-2 text-xs text-plugin hover:bg-accent';

/** Ghost row buttons in Quick actions / Export sidebars */
export const DETAIL_QUICK_ACTION_ROW_CLASS =
  'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted/50 transition-colors';
