// client/src/core/settings/types.ts
// Types for settings system

export type SettingsCategory = 'profile' | 'preferences' | 'activity-log' | 'team';

export interface ProfileSettings {
  name?: string;
  title?: string;
  email?: string;
}

export type TimeFormatPreference = '12h' | '24h';

export interface PreferencesSettings {
  timezone?: string;
  language?: string;
  /** Wall-clock display: platform source of truth for plugins (default 24h). */
  timeFormat?: TimeFormatPreference;
}

export interface UserSettings {
  profile?: ProfileSettings;
  preferences?: PreferencesSettings;
  [key: string]: any;
}

export interface SettingsCategoryConfig {
  id: string;
  label: string;
  category: SettingsCategory;
  icon?: string;
}
