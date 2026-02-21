// client/src/core/ui/SettingsForms/PreferencesSettingsForm.tsx
// Preferences settings form – actions are in panel footer

import { Moon, Sun } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { useTheme } from '@/hooks/useTheme';
import i18n from '@/i18n';
import { useSettingsContext } from '@/plugins/settings/context/SettingsContext';

interface PreferencesSettingsFormProps {
  onCancel: () => void;
}

const timezones = [
  { value: 'Europe/Stockholm', label: 'Europe/Stockholm (CET)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
];

type PreferencesFormData = {
  timezone: string;
  language: string;
  pomodoroClockEnabled: boolean;
  timeTrackingEnabled: boolean;
};

const defaultFormData: PreferencesFormData = {
  timezone: 'Europe/Stockholm',
  language: 'en',
  pomodoroClockEnabled: true,
  timeTrackingEnabled: true,
};

export function PreferencesSettingsForm({ onCancel }: PreferencesSettingsFormProps) {
  const { t } = useTranslation();
  const { getSettings, updateSettings } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { registerSaveHandler, setIsSaving, setHasChanges } = useSettingsContext();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<PreferencesFormData>(defaultFormData);
  const [initialFormData, setInitialFormData] = useState<PreferencesFormData>(defaultFormData);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await getSettings('preferences');
      const loaded: PreferencesFormData = {
        timezone: settings?.timezone || 'Europe/Stockholm',
        language: settings?.language || 'en',
        pomodoroClockEnabled: settings?.pomodoroClockEnabled !== false,
        timeTrackingEnabled: settings?.timeTrackingEnabled !== false,
      };
      setFormData(loaded);
      setInitialFormData(loaded);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load preferences settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isDirty =
    formData.timezone !== initialFormData.timezone ||
    formData.language !== initialFormData.language ||
    formData.pomodoroClockEnabled !== initialFormData.pomodoroClockEnabled ||
    formData.timeTrackingEnabled !== initialFormData.timeTrackingEnabled;

  useEffect(() => {
    setHasChanges(isDirty);
    return () => setHasChanges(false);
  }, [isDirty, setHasChanges]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings('preferences', {
        timezone: formData.timezone,
        language: formData.language,
        pomodoroClockEnabled: formData.pomodoroClockEnabled,
        timeTrackingEnabled: formData.timeTrackingEnabled,
      });
      i18n.changeLanguage(formData.language);
      setInitialFormData({ ...formData });
      setHasChanges(false);
      onCancel();
    } catch (error) {
      console.error('Failed to save preferences settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [formData, onCancel, updateSettings, setIsSaving, setHasChanges]);

  useEffect(() => {
    registerSaveHandler(handleSave);
    return () => registerSaveHandler(null);
  }, [registerSaveHandler, handleSave]);

  const languages = [
    { value: 'en', label: t('preferences.languageEnglish') },
    { value: 'sv', label: t('preferences.languageSvenska') },
  ];

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <DetailSection title={t('preferences.title')} className="pt-0">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="preferences-theme"
              className="text-xs font-medium text-muted-foreground"
            >
              {t('preferences.theme')}
            </Label>
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-muted-foreground" />
              <Switch
                id="preferences-theme"
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
                aria-label={t('preferences.toggleDarkMode')}
              />
              <Moon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {theme === 'dark' ? t('preferences.dark') : t('preferences.light')}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="preferences-time-tracking"
              className="text-xs font-medium text-muted-foreground"
            >
              {t('preferences.timeTracking')}
            </Label>
            <div className="flex items-center gap-2">
              <Switch
                id="preferences-time-tracking"
                checked={formData.timeTrackingEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, timeTrackingEnabled: checked })
                }
                aria-label={t('preferences.showTimeTracking')}
              />
              <span className="text-sm text-muted-foreground">
                {formData.timeTrackingEnabled ? t('common.on') : t('common.off')}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="preferences-pomodoro-clock"
              className="text-xs font-medium text-muted-foreground"
            >
              {t('preferences.pomodoro')}
            </Label>
            <div className="flex items-center gap-2">
              <Switch
                id="preferences-pomodoro-clock"
                checked={formData.pomodoroClockEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, pomodoroClockEnabled: checked })
                }
                aria-label={t('preferences.showPomodoro')}
              />
              <span className="text-sm text-muted-foreground">
                {formData.pomodoroClockEnabled ? t('common.on') : t('common.off')}
              </span>
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="preferences-timezone" className="mb-1">
            {t('preferences.timezone')}
          </Label>
          <NativeSelect
            id="preferences-timezone"
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
          >
            {timezones.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="preferences-language" className="mb-1">
            {t('preferences.language')}
          </Label>
          <NativeSelect
            id="preferences-language"
            value={formData.language}
            onChange={(e) => setFormData({ ...formData, language: e.target.value })}
          >
            {languages.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
    </DetailSection>
  );
}
