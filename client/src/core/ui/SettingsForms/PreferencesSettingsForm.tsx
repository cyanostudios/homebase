// client/src/core/ui/SettingsForms/PreferencesSettingsForm.tsx
// Preferences settings form – actions are in panel footer

import { Moon, Sun } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { useTheme } from '@/hooks/useTheme';
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

const languages = [
  { value: 'en', label: 'English' },
  { value: 'sv', label: 'Svenska' },
];

export function PreferencesSettingsForm({ onCancel }: PreferencesSettingsFormProps) {
  const { getSettings, updateSettings } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { registerSaveHandler, setIsSaving } = useSettingsContext();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    timezone: 'Europe/Stockholm',
    language: 'en',
    pomodoroClockEnabled: true,
    timeTrackingEnabled: true,
  });

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await getSettings('preferences');
      setFormData({
        timezone: settings?.timezone || 'Europe/Stockholm',
        language: settings?.language || 'en',
        pomodoroClockEnabled: settings?.pomodoroClockEnabled !== false,
        timeTrackingEnabled: settings?.timeTrackingEnabled !== false,
      });
    } catch (error) {
      console.error('Failed to load preferences settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings('preferences', {
        timezone: formData.timezone,
        language: formData.language,
        pomodoroClockEnabled: formData.pomodoroClockEnabled,
        timeTrackingEnabled: formData.timeTrackingEnabled,
      });
      onCancel();
    } catch (error) {
      console.error('Failed to save preferences settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    formData.timezone,
    formData.language,
    formData.pomodoroClockEnabled,
    formData.timeTrackingEnabled,
    onCancel,
    updateSettings,
    setIsSaving,
  ]);

  useEffect(() => {
    registerSaveHandler(handleSave);
    return () => registerSaveHandler(null);
  }, [registerSaveHandler, handleSave]);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Preferences">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="preferences-theme"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Theme
                </Label>
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-muted-foreground" />
                  <Switch
                    id="preferences-theme"
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                    aria-label="Toggle dark mode"
                  />
                  <Moon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {theme === 'dark' ? 'Dark' : 'Light'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="preferences-time-tracking"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Time tracking
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="preferences-time-tracking"
                    checked={formData.timeTrackingEnabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, timeTrackingEnabled: checked })
                    }
                    aria-label="Show Time tracking in top bar"
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.timeTrackingEnabled ? 'On' : 'Off'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="preferences-pomodoro-clock"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Pomodoro
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="preferences-pomodoro-clock"
                    checked={formData.pomodoroClockEnabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, pomodoroClockEnabled: checked })
                    }
                    aria-label="Show Pomodoro clock in top bar"
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.pomodoroClockEnabled ? 'On' : 'Off'}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="preferences-timezone" className="mb-1">
                Timezone
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
                Language
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
      </Card>
    </div>
  );
}
