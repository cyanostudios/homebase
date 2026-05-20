const LOCALE = 'sv-SE';

function toDate(value: Date | string): Date | null {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date only (sv-SE). Empty string when invalid/missing. */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return '';
  }
  try {
    const d = toDate(date);
    return d ? d.toLocaleDateString(LOCALE) : '';
  } catch {
    return '';
  }
}

/** Date + time, medium date + short time. `—` when missing/invalid. */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) {
    return '—';
  }
  try {
    const d = toDate(date);
    return d ? d.toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  } catch {
    return '—';
  }
}

/** Short date + short time. `—` when missing/invalid. */
export function formatDateTimeShort(date: Date | string | null | undefined): string {
  if (!date) {
    return '—';
  }
  try {
    const d = toDate(date);
    return d ? d.toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' }) : '—';
  } catch {
    return '—';
  }
}

/** Short date only. `—` when missing/invalid. */
export function formatDateOnly(date: Date | string | null | undefined): string {
  if (!date) {
    return '—';
  }
  try {
    const d = toDate(date);
    return d ? d.toLocaleDateString(LOCALE, { dateStyle: 'short' }) : '—';
  } catch {
    return '—';
  }
}
