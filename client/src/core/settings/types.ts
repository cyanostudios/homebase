// client/src/core/settings/types.ts
// Types for settings system

export type SettingsCategory = 'profile' | 'preferences' | 'plugin';

export interface ProfileSettings {
  name?: string;
  title?: string;
  email?: string;
}

export interface PreferencesSettings {
  timezone?: string;
  language?: string;
}

export interface PluginSettings {
  [key: string]: any;
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
