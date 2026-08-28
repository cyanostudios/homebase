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
  'inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] font-normal text-slate-400 dark:text-slate-500 mb-0.5';

export const DETAIL_FIELD_LABEL_ICON_CLASS = 'h-3 w-3 shrink-0';

/** Primary field values in detail panels — weight 800. */
export const DETAIL_FIELD_VALUE_CLASS = 'text-base font-extrabold text-foreground';

/** Monospace values in Information rows (ID, dates, etc.). */
export const DETAIL_INFO_VALUE_CLASS = 'font-mono font-extrabold text-foreground';

/** Non-monospace values in Information rows. */
export const DETAIL_INFO_VALUE_TEXT_CLASS = 'font-extrabold text-foreground';

export const DETAIL_PROP_ROW_CLASS =
  'flex items-center justify-between gap-3 py-3 border-b border-border/50 last:border-0';

export const DETAIL_NOTE_CALLOUT_CLASS = 'rounded-md bg-amber-50/70 p-3.5 dark:bg-amber-950/20';

export const DETAIL_EMPTY_STATE_CLASS =
  'text-center border border-dashed border-border rounded-lg p-8 bg-muted/30 mt-3';

export const DETAIL_INFO_ROW_CLASS =
  'flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-xs';

export const DETAIL_SURFACE_ROW_CLASS =
  'flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/70 dark:bg-muted/25';

/** Gray link label — normal state (muted-foreground is too dark in this theme). */
export const LINK_BUTTON_TEXT_IDLE_CLASS = 'text-slate-400 dark:text-slate-500';

/** Black/dark link label — selected or hover emphasis. */
export const LINK_BUTTON_TEXT_ACTIVE_CLASS = 'text-foreground';

/** Link-style controls — text weight 800 (icons unchanged). */
export const LINK_BUTTON_FONT_CLASS = 'font-extrabold';

/** ExternalLink + label control for related entities / quick-info. */
export const DETAIL_ENTITY_LINK_TRIGGER_CLASS = `h-9 shrink-0 gap-1.5 rounded-md px-3 text-xs ${LINK_BUTTON_FONT_CLASS} underline decoration-border transition-colors ${LINK_BUTTON_TEXT_IDLE_CLASS} hover:text-foreground hover:decoration-foreground`;

/** Ghost row buttons in Quick actions / Export sidebars — gray text, no fill. */
export const DETAIL_QUICK_ACTION_ROW_CLASS = `h-9 justify-start rounded-md px-3 text-xs ${LINK_BUTTON_FONT_CLASS} transition-colors ${LINK_BUTTON_TEXT_IDLE_CLASS} hover:bg-muted/40 hover:text-foreground`;

/** Ghost row buttons in Quick actions — selected (black text). */
export const DETAIL_QUICK_ACTION_ROW_ACTIVE_CLASS = `h-9 justify-start rounded-md px-3 text-xs ${LINK_BUTTON_FONT_CLASS} ${LINK_BUTTON_TEXT_ACTIVE_CLASS} transition-colors hover:text-foreground`;

/**
 * Compact list filter chips — pill shape (matches round buttons).
 * Idle: muted text + ghost hover fill. Selected: soft primary (blue).
 */
export const LIST_FILTER_CHIP_CLASS = `h-9 shrink-0 gap-1.5 rounded-full px-3 text-xs ${LINK_BUTTON_FONT_CLASS} transition-colors ${LINK_BUTTON_TEXT_IDLE_CLASS} hover:text-foreground`;

export const LIST_FILTER_CHIP_ACTIVE_CLASS = `h-9 shrink-0 gap-1.5 rounded-full px-3 text-xs ${LINK_BUTTON_FONT_CLASS} bg-primary/10 text-primary transition-colors hover:bg-primary/10 hover:text-primary`;

/**
 * Filter chip row — phone/pad: single-row horizontal scroll; lg+: wrap.
 */
export const LIST_FILTER_CHIP_ROW_CLASS =
  '-mx-1 flex min-w-0 w-full flex-nowrap items-center gap-1.5 overflow-x-auto px-1 no-scrollbar lg:mx-0 lg:flex-wrap lg:gap-2 lg:overflow-visible lg:px-0';

/** Chip row slot — full width on phone/pad (scroll row), shares row with sort from lg. */
export const LIST_FILTER_CHIP_SLOT_CLASS = 'min-w-0 w-full lg:flex-1';

/** Filter chips + sort — stacked on phone/pad (sort on its own row); inline from lg, vertically centered. */
export const LIST_FILTER_AND_SORT_ROW_CLASS =
  'flex min-w-0 w-full flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-3';

/** Sort cluster — own row on phone/pad, right-aligned; vertically centered beside chips from lg. */
export const LIST_FILTER_SORT_CLUSTER_CLASS =
  'flex shrink-0 items-center gap-1 self-end lg:self-auto';

/** Dashboard plugin widget card — same surface/hover language as select-style filter chips. */
export const DASHBOARD_WIDGET_CARD_CLASS =
  'relative flex min-h-[160px] cursor-pointer flex-col rounded-xl border-0 bg-white p-4 shadow-sm transition-shadow hover:bg-primary/10 hover:shadow-md dark:bg-slate-950';

/** Icon chip backgrounds for dashboard widget headers, cycled by plugin index. */
export const DASHBOARD_WIDGET_ICON_CHIP_CLASSES = [
  'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
] as const;
