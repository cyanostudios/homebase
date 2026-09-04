/** Standard plugin/list badge chip — 12px, weight 800. */
export const BADGE_CHIP_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

/** Compact pill badge text — 10px, weight 800. */
export const BADGE_PILL_TEXT_CLASS = 'text-[10px] font-extrabold';

/** Compact pill badge shell (status dots, yes/no pills). */
export const BADGE_PILL_CLASS = `inline-flex items-center rounded-full px-2 py-0.5 ${BADGE_PILL_TEXT_CLASS}`;

/** Meta badge on QuickContext link tiles (linked section) — 10px original size, weight 800. */
export const LINKED_TILE_META_BADGE_CLASS =
  'inline-flex h-4 max-w-full shrink items-center truncate rounded-md border-0 px-1.5 py-0 leading-none !text-[10px] !font-extrabold';

/** Badge chip in linked-section preview dialogs — 10px original size, weight 800. */
export const LINKED_SECTION_BADGE_CLASS =
  'inline-flex items-center rounded-md border-0 px-2 py-0.5 !text-[10px] !font-extrabold leading-none';

/**
 * Quick-context status badge fills (Requests palette): solid bg + extrabold chip.
 * Prefer these over washed select-trigger colors (50% opacity fills, font-medium).
 */
export const QC_STATUS_BADGE_COLORS = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  muted: 'bg-muted text-muted-foreground',
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
