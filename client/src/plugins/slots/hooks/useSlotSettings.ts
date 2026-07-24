import { useCallback, useEffect, useState } from 'react';

import { useApp } from '@/core/api/AppContext';

import { SLOTS_SETTINGS_KEY } from '../types/slots';
import {
  resolveSlotColumnCount,
  SLOTS_COLUMN_COUNT_STORAGE_KEY,
  type SlotColumnCount,
} from '../utils/slotColumnCount';

export function useSlotSettings() {
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [columnCount, setColumnCount] = useState<SlotColumnCount>(1);
  const [initialColumnCount, setInitialColumnCount] = useState<SlotColumnCount>(1);
  const [tags, setTags] = useState<string[]>([]);
  const [initialTags, setInitialTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(SLOTS_SETTINGS_KEY)
      .then((settings: { columnCount?: unknown; viewMode?: unknown; tags?: unknown[] }) => {
        if (cancelled) {
          return;
        }
        const loaded = resolveSlotColumnCount(settings);
        setColumnCount(loaded);
        setInitialColumnCount(loaded);
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
      await updateSettings(SLOTS_SETTINGS_KEY, { columnCount, tags });
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SLOTS_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
      }
      setInitialColumnCount(columnCount);
      setInitialTags(tags);
    } catch {
      /* settings save failed; user can retry */
    } finally {
      setIsSaving(false);
    }
  }, [columnCount, tags, updateSettings]);

  const tagsDirty =
    tags.length !== initialTags.length || tags.some((tag, idx) => tag !== initialTags[idx]);

  return {
    columnCount,
    setColumnCount,
    tags,
    setTags,
    isDirty: columnCount !== initialColumnCount || tagsDirty,
    isLoading,
    isSaving,
    save,
  };
}
