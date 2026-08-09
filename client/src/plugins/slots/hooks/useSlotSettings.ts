import { useCallback, useEffect, useState } from 'react';

import { useApp } from '@/core/api/AppContext';

import { SLOTS_SETTINGS_KEY } from '../types/slots';
import {
  resolveSlotColumnCount,
  SLOTS_COLUMN_COUNT_STORAGE_KEY,
  type SlotColumnCount,
} from '../utils/slotColumnCount';
import {
  persistSlotListViewModeSession,
  resolveSlotListViewMode,
  SLOTS_LIST_VIEW_MODE_STORAGE_KEY,
  type SlotListViewMode,
} from '../utils/slotListViewMode';

export function useSlotSettings() {
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [columnCount, setColumnCount] = useState<SlotColumnCount>(1);
  const [initialColumnCount, setInitialColumnCount] = useState<SlotColumnCount>(1);
  const [listViewMode, setListViewMode] = useState<SlotListViewMode>('cards');
  const [initialListViewMode, setInitialListViewMode] = useState<SlotListViewMode>('cards');
  const [tags, setTags] = useState<string[]>([]);
  const [initialTags, setInitialTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(SLOTS_SETTINGS_KEY)
      .then(
        (settings: {
          columnCount?: unknown;
          viewMode?: unknown;
          listViewMode?: unknown;
          tags?: unknown[];
        }) => {
          if (cancelled) {
            return;
          }
          const loaded = resolveSlotColumnCount(settings);
          setColumnCount(loaded);
          setInitialColumnCount(loaded);
          const loadedView = resolveSlotListViewMode(settings);
          setListViewMode(loadedView);
          setInitialListViewMode(loadedView);
          const loadedTags = Array.isArray(settings?.tags)
            ? settings.tags
                .filter((tag): tag is string => typeof tag === 'string')
                .map((tag) => tag.trim())
                .filter(Boolean)
            : [];
          setTags(loadedTags);
          setInitialTags(loadedTags);
        },
      )
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
      await updateSettings(SLOTS_SETTINGS_KEY, { columnCount, listViewMode, tags });
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SLOTS_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
        window.sessionStorage.setItem(SLOTS_LIST_VIEW_MODE_STORAGE_KEY, listViewMode);
      }
      persistSlotListViewModeSession(listViewMode);
      setInitialColumnCount(columnCount);
      setInitialListViewMode(listViewMode);
      setInitialTags(tags);
    } catch {
      /* settings save failed; user can retry */
    } finally {
      setIsSaving(false);
    }
  }, [columnCount, listViewMode, tags, updateSettings]);

  const tagsDirty =
    tags.length !== initialTags.length || tags.some((tag, idx) => tag !== initialTags[idx]);

  return {
    columnCount,
    setColumnCount,
    listViewMode,
    setListViewMode,
    tags,
    setTags,
    isDirty:
      columnCount !== initialColumnCount || listViewMode !== initialListViewMode || tagsDirty,
    isLoading,
    isSaving,
    save,
  };
}
