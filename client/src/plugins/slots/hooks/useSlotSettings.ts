import { useCallback, useEffect, useState } from 'react';

import { useApp } from '@/core/api/AppContext';

import type { SlotsViewMode } from '../types/slots';
import { SLOTS_SETTINGS_KEY } from '../types/slots';

export function useSlotSettings() {
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [viewMode, setViewMode] = useState<SlotsViewMode>('list');
  const [initialViewMode, setInitialViewMode] = useState<SlotsViewMode>('list');
  const [tags, setTags] = useState<string[]>([]);
  const [initialTags, setInitialTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(SLOTS_SETTINGS_KEY)
      .then((settings: { viewMode?: SlotsViewMode; tags?: unknown[] }) => {
        if (cancelled) {
          return;
        }
        const loaded = settings?.viewMode === 'grid' ? 'grid' : 'list';
        setViewMode(loaded);
        setInitialViewMode(loaded);
        const loadedTags = Array.isArray(settings?.tags)
          ? settings.tags
              .filter((tag): tag is string => typeof tag === 'string')
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [];
        setTags(loadedTags);
        setInitialTags(loadedTags);
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
      await updateSettings(SLOTS_SETTINGS_KEY, { viewMode, tags });
      setInitialViewMode(viewMode);
      setInitialTags(tags);
    } catch {
      /* settings save failed; user can retry */
    } finally {
      setIsSaving(false);
    }
  }, [viewMode, tags, updateSettings]);

  const tagsDirty =
    tags.length !== initialTags.length || tags.some((tag, idx) => tag !== initialTags[idx]);

  return {
    viewMode,
    setViewMode,
    tags,
    setTags,
    isDirty: viewMode !== initialViewMode || tagsDirty,
    isLoading,
    isSaving,
    save,
  };
}
