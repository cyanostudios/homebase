export interface ClockSettings {
  dateFormat: 'sv-SE' | 'en-US' | 'ISO' | 'compact';
  showSeconds: boolean;
  showDate: boolean;
  showClock: boolean;
  timezone: string;
}

export const DEFAULT_CLOCK_SETTINGS: ClockSettings = {
  dateFormat: 'sv-SE',
  showSeconds: true,
  showDate: true,
  showClock: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

const STORAGE_KEY = 'homebase-clock-settings';

function stripLegacyTimeFormat(parsed: Record<string, unknown>): ClockSettings {
  const { timeFormat: _legacy, ...rest } = parsed;
  return { ...DEFAULT_CLOCK_SETTINGS, ...rest } as ClockSettings;
}

export function loadClockSettings(): ClockSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return stripLegacyTimeFormat(JSON.parse(stored) as Record<string, unknown>);
    }
  } catch (error) {
    console.warn('Failed to load clock settings:', error);
  }
  return DEFAULT_CLOCK_SETTINGS;
}

export function saveClockSettings(settings: ClockSettings): void {
  try {
    // Never persist timeFormat — Preferences owns wall-clock format.
    const { timeFormat: _legacy, ...rest } = settings as ClockSettings & {
      timeFormat?: unknown;
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch (error) {
    console.warn('Failed to save clock settings:', error);
  }
}

export const COMMON_TIMEZONES = [
  { value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'UTC', label: 'UTC' },
];
