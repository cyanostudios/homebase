export interface TimeTrackingSettings {
  compactMode: boolean;
}

export const DEFAULT_SETTINGS: TimeTrackingSettings = {
  compactMode: false,
};

const STORAGE_KEY = 'homebase-time-tracking-settings';

export function loadSettings(): TimeTrackingSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('Failed to load Time tracking settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: TimeTrackingSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save Time tracking settings:', error);
  }
}
