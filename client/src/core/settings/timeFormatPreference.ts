/** Platform wall-clock preference: Preferences is the single source of truth. */

export type TimeFormat = '12h' | '24h';

export const DEFAULT_TIME_FORMAT: TimeFormat = '24h';

const CLOCK_SETTINGS_KEY = 'homebase-clock-settings';

let current: TimeFormat = DEFAULT_TIME_FORMAT;
const listeners = new Set<() => void>();

export function getTimeFormat(): TimeFormat {
  return current;
}

export function isHour12(): boolean {
  return current === '12h';
}

export function parseTimeFormat(value: unknown): TimeFormat | null {
  return value === '12h' || value === '24h' ? value : null;
}

export function setTimeFormat(format: TimeFormat): void {
  if (format !== '12h' && format !== '24h') {
    return;
  }
  if (current === format) {
    return;
  }
  current = format;
  listeners.forEach((listener) => listener());
}

export function subscribeTimeFormat(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** One-time migration source: legacy clock-widget localStorage. */
export function migrateTimeFormatFromClockLocalStorage(): TimeFormat | null {
  try {
    const raw = localStorage.getItem(CLOCK_SETTINGS_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { timeFormat?: unknown };
    return parseTimeFormat(parsed?.timeFormat);
  } catch {
    return null;
  }
}
