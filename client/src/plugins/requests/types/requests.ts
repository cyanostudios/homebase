export type RequestStatus = 'not started' | 'in progress' | 'completed' | 'cancelled';
export type RequestPriority = 'Low' | 'Medium' | 'High';
type RequestSource = 'internal' | 'external';

/** Built-in default types — used as fallback when no custom types are configured in settings. */
export const DEFAULT_REQUEST_TYPES: string[] = [
  'general',
  'pitch_booking',
  'person_registration',
  'other',
];

/** @deprecated Use `requestTypes` from context (dynamic). Kept for backend/public form constants. */
export const REQUEST_TYPES: string[] = DEFAULT_REQUEST_TYPES;

export const REQUEST_STATUSES: RequestStatus[] = [
  'not started',
  'in progress',
  'completed',
  'cancelled',
];

/** Open requests shown on team overview; completed/cancelled are hidden there. */
export function isOpenRequestStatus(status: RequestStatus | string): boolean {
  return status === 'not started' || status === 'in progress';
}

export const REQUEST_PRIORITIES: RequestPriority[] = ['Low', 'Medium', 'High'];

export interface Request {
  id: string;
  title: string;
  description: string | null;
  requestType: string;
  status: RequestStatus;
  priority: RequestPriority;
  teamId: number | null;
  submitterName: string | null;
  submitterEmail: string | null;
  contactId: string | null;
  assignedToIds: string[];
  internalNotes: string | null;
  source: RequestSource;
  /** ISO timestamptz — default created + 7 days. */
  responseDueAt: string | null;
  /** Snapshot plugin target at submit (e.g. garments). */
  pluginTarget: string | null;
  /** Snapshot target list/entity id (never shown on public form). */
  pluginTargetId: string | null;
  /** Validated intake payload from public submit. */
  extraData: Record<string, string> | null;
  /** When staff successfully routed to plugin target. */
  pluginRoutedAt: string | null;
  /** Created entity id after routing (e.g. garment person id). */
  pluginRoutedEntityId: string | null;
  /** When any staff member first opened/viewed the request. */
  firstViewedAt: string | null;
  created_at: string;
  updated_at: string;
}

/** True when no staff member has opened the request yet. */
export function isRequestUnopened(request: Pick<Request, 'firstViewedAt'>): boolean {
  return !request.firstViewedAt;
}

export interface RequestValidationError {
  field: string;
  message: string;
}

export interface PublicTeam {
  id: number;
  name: string;
  age_group: string | null;
  gender: string | null;
}

/** Built-in type keys that have i18n translations under `requests.type.*`. */
export const BUILTIN_REQUEST_TYPE_KEYS: string[] = DEFAULT_REQUEST_TYPES;

/**
 * Returns a display label for a request type.
 * Built-in types are translated; custom types return their raw value.
 */
export function formatRequestStatusForDisplay(
  status: RequestStatus,
  t: (key: string) => string,
): string {
  return t(`requests.status.${status.replace(/ /g, '_')}`);
}

export function getTypeLabel(type: string, t: (key: string) => string): string {
  if (BUILTIN_REQUEST_TYPE_KEYS.includes(type)) {
    return t(`requests.type.${type}`);
  }
  return type;
}

export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  'not started': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'in progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const REQUEST_PRIORITY_COLORS: Record<RequestPriority, string> = {
  Low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  High: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const REQUEST_SOURCE_COLORS: Record<RequestSource, string> = {
  internal: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  external: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

export function parseRequestDate(iso: string | undefined): Date | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatSubmittedDate(iso: string | undefined): string | null {
  const date = parseRequestDate(iso);
  if (!date) {
    return null;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Grid card avatar background by how many days since submission. */
export function getRequestAgeAvatarColor(days: number): string {
  if (days === 0) {
    return 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-800 dark:from-emerald-900/60 dark:to-emerald-950 dark:text-emerald-200';
  }
  if (days <= 7) {
    return 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 dark:from-slate-800 dark:to-slate-900 dark:text-slate-200';
  }
  if (days <= 30) {
    return 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-900 dark:from-amber-900/60 dark:to-amber-950 dark:text-amber-200';
  }
  return 'bg-gradient-to-br from-red-100 to-red-200 text-red-800 dark:from-red-900/60 dark:to-red-950 dark:text-red-200';
}

export function getDaysSinceSubmission(iso: string | undefined): number | null {
  const date = parseRequestDate(iso);
  if (!date) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const submitted = new Date(date);
  submitted.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDaysSinceSubmission(
  iso: string | undefined,
  t: (key: string, opts?: { count?: number }) => string,
): string | null {
  const days = getDaysSinceSubmission(iso);
  if (days === null) {
    return null;
  }
  if (days === 0) {
    return t('requests.daysAgoToday');
  }
  if (days === 1) {
    return t('requests.daysAgoSingular');
  }
  return t('requests.daysAgo', { count: days });
}

export function formatSubmittedDateWithAge(
  iso: string | undefined,
  t: (key: string, opts?: { count?: number }) => string,
): string | null {
  const dateStr = formatSubmittedDate(iso);
  if (!dateStr) {
    return null;
  }
  const ageStr = formatDaysSinceSubmission(iso, t);
  if (!ageStr) {
    return dateStr;
  }
  return `${dateStr} (${ageStr})`;
}

/**
 * Whole calendar days until response due (negative = overdue).
 * Uses local midnight comparison so "1 day left" means tomorrow's calendar day.
 */
export function getDaysUntilResponseDue(iso: string | null | undefined): number | null {
  const date = parseRequestDate(iso ?? undefined);
  if (!date) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export type ResponseDueUrgency = 'green' | 'yellow' | 'red';

/**
 * Urgency colors for svarsdatum:
 * - green: 7+ days left
 * - yellow: 2–6 days left (inkl. när den är nere på 3)
 * - red: ≤1 day left or overdue
 */
export function getResponseDueUrgency(daysLeft: number | null): ResponseDueUrgency {
  if (daysLeft === null) {
    return 'green';
  }
  if (daysLeft >= 7) {
    return 'green';
  }
  if (daysLeft >= 2) {
    return 'yellow';
  }
  return 'red';
}

export const RESPONSE_DUE_URGENCY_COLORS: Record<ResponseDueUrgency, string> = {
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  yellow: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

/** Build ISO due date = submission date + N calendar days (SLA window). */
export function responseDueAtFromDays(days: number, createdAt: string | null | undefined): string {
  const safeDays = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 7;
  const base = parseRequestDate(createdAt ?? undefined) ?? new Date();
  const due = new Date(base);
  due.setHours(12, 0, 0, 0);
  due.setDate(due.getDate() + safeDays);
  return due.toISOString();
}

/**
 * Configured SLA length in whole calendar days: responseDueAt − created_at.
 * This is what the user edits (e.g. submitted 14d ago + SLA 21 → 7 days left → green).
 */
export function getResponseDueSlaDays(
  createdAt: string | null | undefined,
  responseDueAt: string | null | undefined,
): number | null {
  const created = parseRequestDate(createdAt ?? undefined);
  const due = parseRequestDate(responseDueAt ?? undefined);
  if (!created || !due) {
    return null;
  }
  const start = new Date(created);
  start.setHours(0, 0, 0, 0);
  const end = new Date(due);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}
