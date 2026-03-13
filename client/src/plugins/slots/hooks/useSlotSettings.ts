import { useCallback, useEffect, useState } from 'react';

import { useApp } from '@/core/api/AppContext';

import type { SlotsViewMode } from '../types/slots';
import { SLOTS_SETTINGS_KEY } from '../types/slots';

export function useSlotSettings() {
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [viewMode, setViewMode] = useState<SlotsViewMode>('list');
  const [initialViewMode, setInitialViewMode] = useState<SlotsViewMode>('list');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(SLOTS_SETTINGS_KEY)
      .then((settings: { viewMode?: SlotsViewMode }) => {
        if (cancelled) {
          return;
        }
        const loaded = settings?.viewMode === 'grid' ? 'grid' : 'list';
        setViewMode(loaded);
        setInitialViewMode(loaded);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings(SLOTS_SETTINGS_KEY, { viewMode });
      setInitialViewMode(viewMode);
    } catch (error) {
      console.error('Failed to save slots settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [viewMode, updateSettings]);

  return {
    viewMode,
    setViewMode,
    isDirty: viewMode !== initialViewMode,
    isLoading,
    isSaving,
    save,
  };
}
