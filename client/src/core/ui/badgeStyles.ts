/**
 * Status badges — read-only inline label (icon + extrabold text in semantic color).
 * No chip chrome: no fill, border, fixed height, or padding.
 */

/** Standard status label (QC meta, lists, selects). */
export const BADGE_CHIP_CLASS =
  'inline-flex items-center gap-1 border-0 bg-transparent p-0 h-auto text-xs font-extrabold tracking-wide leading-none [&_svg]:block [&_svg]:size-3.5 [&_svg]:shrink-0';

/** Compact status label (dense tables). */
export const BADGE_CHIP_COMPACT_CLASS =
  'inline-flex items-center gap-0.5 border-0 bg-transparent p-0 h-auto text-[10px] font-extrabold tracking-wide leading-none [&_svg]:block [&_svg]:size-3 [&_svg]:shrink-0';

/** Compact badge text — 10px, extrabold. */
export const BADGE_PILL_TEXT_CLASS = 'text-[10px] font-extrabold tracking-wide';

/** Compact badge shell (yes/no, dense meta). */
export const BADGE_PILL_CLASS = `inline-flex items-center gap-1 border-0 bg-transparent p-0 h-auto ${BADGE_PILL_TEXT_CLASS} leading-none [&_svg]:size-3 [&_svg]:shrink-0`;

/** Meta badge on QuickContext link tiles. */
export const LINKED_TILE_META_BADGE_CLASS =
  'inline-flex max-w-full shrink items-center gap-1 truncate border-0 bg-transparent p-0 h-auto leading-none !text-[10px] !font-extrabold tracking-wide [&_svg]:size-3 [&_svg]:shrink-0';

/** Badge in linked-section preview dialogs. */
export const LINKED_SECTION_BADGE_CLASS =
  'inline-flex items-center gap-1 border-0 bg-transparent p-0 h-auto !text-[10px] !font-extrabold tracking-wide leading-none [&_svg]:size-3 [&_svg]:shrink-0';

/**
 * Color tokens — text (+ icon via currentColor) only.
 * Pair with BADGE_CHIP_*.
 */
export const QC_STATUS_BADGE_COLORS = {
  neutral: 'text-slate-700 dark:text-slate-300',
  info: 'text-blue-700 dark:text-blue-300',
  success: 'text-emerald-800 dark:text-emerald-300',
  danger: 'text-red-700 dark:text-red-300',
  warning: 'text-amber-800 dark:text-amber-300',
  muted: 'text-muted-foreground',
  purple: 'text-violet-700 dark:text-violet-300',
  orange: 'text-orange-800 dark:text-orange-200',
} as const;

export const QC_TASK_STATUS_BADGE_COLORS: Record<string, string> = {
  'not started': QC_STATUS_BADGE_COLORS.neutral,
  'in progress': QC_STATUS_BADGE_COLORS.info,
  completed: QC_STATUS_BADGE_COLORS.success,
  cancelled: QC_STATUS_BADGE_COLORS.danger,
};

export const QC_INVOICE_STATUS_BADGE_COLORS: Record<string, string> = {
  draft: QC_STATUS_BADGE_COLORS.neutral,
  sent: QC_STATUS_BADGE_COLORS.info,
  partially_paid: QC_STATUS_BADGE_COLORS.warning,
  paid: QC_STATUS_BADGE_COLORS.success,
  overdue: QC_STATUS_BADGE_COLORS.danger,
  canceled: QC_STATUS_BADGE_COLORS.danger,
};

export const QC_TEAM_STATUS_BADGE_COLORS: Record<string, string> = {
  active: QC_STATUS_BADGE_COLORS.success,
  dormant: QC_STATUS_BADGE_COLORS.warning,
  break: QC_STATUS_BADGE_COLORS.neutral,
};

export const QC_PRIORITY_BADGE_COLORS: Record<string, string> = {
  Low: QC_STATUS_BADGE_COLORS.neutral,
  Medium: 'text-orange-500 dark:text-orange-400',
  High: QC_STATUS_BADGE_COLORS.danger,
};

/**
 * Calendar / SLA due badges (Tasks due + Requests response-due).
 */
export const DUE_DATE_BADGE_COLORS = {
  overdue: QC_STATUS_BADGE_COLORS.danger,
  today: QC_STATUS_BADGE_COLORS.orange,
  soon: QC_STATUS_BADGE_COLORS.warning,
  later: QC_STATUS_BADGE_COLORS.success,
  muted: QC_STATUS_BADGE_COLORS.muted,
} as const;

/** Meta-row text tones matching DUE_DATE_BADGE_COLORS (list cards without badge shell). */
export const DUE_DATE_TEXT_COLORS = {
  overdue: 'text-destructive font-extrabold',
  today: 'text-orange-600 dark:text-orange-400 font-extrabold',
  soon: 'text-amber-600 dark:text-amber-400 font-extrabold',
  later: 'text-emerald-700 dark:text-emerald-300 font-extrabold',
  muted: 'text-muted-foreground',
} as const;

/** Status/priority Select trigger chrome — same in Tasks + Requests. */
export const BADGE_SELECT_TRIGGER_CLASS =
  // Keep SelectValue as flex (do not use line-clamp-* — it resets display to block and
  // leaves content stuck to the top of the tall trigger).
  'h-9 rounded-full border-border/50 bg-transparent px-2.5 py-0 text-xs leading-none shadow-none transition-colors hover:bg-accent/50 focus:ring-offset-0 [&>span]:!flex [&>span]:min-w-0 [&>span]:flex-1 [&>span]:items-center [&>span]:gap-1 [&>span]:overflow-hidden [&>span]:whitespace-nowrap [&>span]:leading-none [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:self-center';

/** SelectItem when showing StatusOutlineBadge (icon + label). */
export const BADGE_SELECT_ITEM_CLASS =
  'rounded-md py-2 text-xs leading-none focus:bg-accent data-[highlighted]:bg-accent [&>span:last-child]:inline-flex [&>span:last-child]:items-center [&>span:last-child]:leading-none';
