export interface PomodoroSettings {
  workDuration: number; // minutes
  shortBreakDuration: number; // minutes
  longBreakDuration: number; // minutes
  sessionsUntilLongBreak: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  autoStartSessions: boolean;
  compactMode: boolean;}

export const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsUntilLongBreak: 4,
  soundEnabled: true,
  notificationsEnabled: false,
  autoStartSessions: false,
  compactMode: false,};

const STORAGE_KEY = 'homebase-pomodoro-settings';

export function loadSettings(): PomodoroSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('Failed to load Pomodoro settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: PomodoroSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save Pomodoro settings:', error);
  }
}
