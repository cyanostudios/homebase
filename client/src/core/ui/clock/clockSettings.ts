export interface ClockSettings {
  timeFormat: '12h' | '24h';
  dateFormat: 'sv-SE' | 'en-US' | 'ISO' | 'compact';
  showSeconds: boolean;
  showDate: boolean;
  showClock: boolean;
  timezone: string;
}

export const DEFAULT_CLOCK_SETTINGS: ClockSettings = {
  timeFormat: '24h',
  dateFormat: 'sv-SE',
  showSeconds: true,
  showDate: true,
  showClock: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

const STORAGE_KEY = 'homebase-clock-settings';

export function loadClockSettings(): ClockSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CLOCK_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('Failed to load clock settings:', error);
  }
  return DEFAULT_CLOCK_SETTINGS;
}

export function saveClockSettings(settings: ClockSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save clock settings:', error);
  }
}

// Common timezones for easy selection
export const COMMON_TIMEZONES = [
  { value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'UTC', label: 'UTC' },
];
