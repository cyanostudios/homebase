import { useCallback, useEffect, useState } from 'react';

import { useApp } from '@/core/api/AppContext';

import {
  DEFAULT_SCHEDULE_APP_SETTINGS,
  DEFAULT_SCHEDULE_ID,
  normalizeScheduleAppSettings,
  normalizeScheduleGridSettings,
  SCHEDULE_SETTINGS_KEY,
  type ScheduleAppSettings,
  type ScheduleGridSettings,
} from '../types/schedule';

export function useScheduleSettings() {
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [settings, setSettings] = useState<ScheduleAppSettings>(DEFAULT_SCHEDULE_APP_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<ScheduleAppSettings>(
    DEFAULT_SCHEDULE_APP_SETTINGS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getSettings(SCHEDULE_SETTINGS_KEY)
      .then((raw) => {
        if (cancelled) {
          return;
        }
        const loaded = normalizeScheduleAppSettings(raw);
        setSettings(loaded);
        setInitialSettings(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setSettings(DEFAULT_SCHEDULE_APP_SETTINGS);
          setInitialSettings(DEFAULT_SCHEDULE_APP_SETTINGS);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const getGridSettingsForSchedule = useCallback(
    (scheduleId: string): ScheduleGridSettings => {
      const override = settings.gridHours?.[scheduleId];
      if (override) {
        return normalizeScheduleGridSettings(override);
      }
      return {
        startHour: settings.startHour,
        endHour: settings.endHour,
      };
    },
    [settings],
  );

  const gridSettings = getGridSettingsForSchedule(DEFAULT_SCHEDULE_ID);

  const setGridSettings = useCallback((next: ScheduleGridSettings) => {
    setSettings((prev) => ({ ...prev, ...normalizeScheduleGridSettings(next) }));
  }, []);

  const isLockedForSchedule = useCallback(
    (scheduleId: string) => Boolean(settings.locks?.[scheduleId]),
    [settings.locks],
  );

  const isLocked = isLockedForSchedule(DEFAULT_SCHEDULE_ID);

  const isDirty =
    settings.startHour !== initialSettings.startHour ||
    settings.endHour !== initialSettings.endHour;

  const persistSettings = useCallback(
    async (next: ScheduleAppSettings) => {
      const normalized = normalizeScheduleAppSettings(next);
      await updateSettings(SCHEDULE_SETTINGS_KEY, normalized);
      setSettings(normalized);
      setInitialSettings(normalized);
      return true;
    },
    [updateSettings],
  );

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      await persistSettings(settings);
      return true;
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [persistSettings, settings]);

  const setGridSettingsForSchedule = useCallback(
    async (scheduleId: string, next: ScheduleGridSettings) => {
      const normalized = normalizeScheduleAppSettings({
        ...settings,
        gridHours: {
          ...settings.gridHours,
          [scheduleId]: normalizeScheduleGridSettings(next),
        },
      });
      setIsSaving(true);
      try {
        await persistSettings(normalized);
        return true;
      } catch {
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [persistSettings, settings],
  );

  const setLockedForSchedule = useCallback(
    async (scheduleId: string, locked: boolean) => {
      const next = normalizeScheduleAppSettings({
        ...settings,
        locks: { ...settings.locks, [scheduleId]: locked },
      });
      setIsTogglingLock(true);
      try {
        await persistSettings(next);
        return true;
      } catch {
        return false;
      } finally {
        setIsTogglingLock(false);
      }
    },
    [persistSettings, settings],
  );

  const setLocked = useCallback(
    async (locked: boolean) => setLockedForSchedule(DEFAULT_SCHEDULE_ID, locked),
    [setLockedForSchedule],
  );

  return {
    settings,
    gridSettings,
    getGridSettingsForSchedule,
    setGridSettings,
    setGridSettingsForSchedule,
    initialSettings,
    isLocked,
    isLockedForSchedule,
    isLoading,
    isSaving,
    isTogglingLock,
    isDirty,
    save,
    setLocked,
    setLockedForSchedule,
  };
}
