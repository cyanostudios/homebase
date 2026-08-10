import { isHour12 } from '@/core/settings/timeFormatPreference';

const LOCALE = 'sv-SE';

function toDate(value: Date | string): Date | null {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

function withHourCycle(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  return { ...options, hour12: isHour12() };
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

/** Date + time, medium date + short time. `—` when missing/invalid. Respects Preferences timeFormat. */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) {
    return '—';
  }
  try {
    const d = toDate(date);
    return d
      ? d.toLocaleString(LOCALE, withHourCycle({ dateStyle: 'medium', timeStyle: 'short' }))
      : '—';
  } catch {
    return '—';
  }
}

/** Short date + short time. `—` when missing/invalid. Respects Preferences timeFormat. */
export function formatDateTimeShort(date: Date | string | null | undefined): string {
  if (!date) {
    return '—';
  }
  try {
    const d = toDate(date);
    return d
      ? d.toLocaleString(LOCALE, withHourCycle({ dateStyle: 'short', timeStyle: 'short' }))
      : '—';
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

/** Time only (hour + minute). `—` when missing/invalid. Respects Preferences timeFormat. */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) {
    return '—';
  }
  try {
    const d = toDate(date);
    return d
      ? d.toLocaleTimeString(LOCALE, withHourCycle({ hour: '2-digit', minute: '2-digit' }))
      : '—';
  } catch {
    return '—';
  }
}
