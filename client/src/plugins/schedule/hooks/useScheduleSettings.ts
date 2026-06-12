import { useCallback, useEffect, useState } from 'react';

import { useApp } from '@/core/api/AppContext';

import {
  DEFAULT_SCHEDULE_GRID_SETTINGS,
  normalizeScheduleGridSettings,
  SCHEDULE_SETTINGS_KEY,
  type ScheduleGridSettings,
} from '../types/schedule';

export function useScheduleSettings() {
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [gridSettings, setGridSettings] = useState<ScheduleGridSettings>(
    DEFAULT_SCHEDULE_GRID_SETTINGS,
  );
  const [initialGridSettings, setInitialGridSettings] = useState<ScheduleGridSettings>(
    DEFAULT_SCHEDULE_GRID_SETTINGS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getSettings(SCHEDULE_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loaded = normalizeScheduleGridSettings(settings);
        setGridSettings(loaded);
        setInitialGridSettings(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setGridSettings(DEFAULT_SCHEDULE_GRID_SETTINGS);
          setInitialGridSettings(DEFAULT_SCHEDULE_GRID_SETTINGS);
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

  const isDirty =
    gridSettings.startHour !== initialGridSettings.startHour ||
    gridSettings.endHour !== initialGridSettings.endHour;

  const save = useCallback(async () => {
    const normalized = normalizeScheduleGridSettings(gridSettings);
    setIsSaving(true);
    try {
      await updateSettings(SCHEDULE_SETTINGS_KEY, normalized);
      setGridSettings(normalized);
      setInitialGridSettings(normalized);
      return true;
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [gridSettings, updateSettings]);

  return {
    gridSettings,
    setGridSettings,
    initialGridSettings,
    isLoading,
    isSaving,
    isDirty,
    save,
  };
}
