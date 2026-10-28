import { Tag } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';
import {
  countItemsWithTag,
  itemMatchesSelectedTags,
  toggleTagFilter,
} from '@/core/list/listTagFilter';
import { ListChipRowClear } from '@/core/ui/ListChipRowClear';
import {
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_COMPANION_SIZE_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListTagsChipsToggle } from '@/core/ui/ListTagsChipsToggle';
import { ListTagsEmptyRow } from '@/core/ui/ListTagsEmptyRow';
import { PLUGIN_PAGE_COMPANION_TOOLBAR_CONTROL_CLASS } from '@/core/ui/pluginPageStyles';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { cn } from '@/lib/utils';

type TaggedItem = { tags?: readonly string[] | null };

type UsePluginListTagsOptions<T extends TaggedItem> = {
  settingsKey: string;
  storageKey: string;
  items: readonly T[];
  /** Hide the control entirely (e.g. garments list mode). */
  enabled?: boolean;
  isCompanion?: boolean;
  onOpenSettings: () => void;
};

function readCatalog(settings: { tags?: unknown } | null | undefined): string[] {
  return Array.isArray(settings?.tags)
    ? settings.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    : [];
}

/**
 * Contacts-style tag catalog filter for a plugin list.
 * Toggle is shown when enabled. Chips appear once the settings catalog has tags;
 * an empty catalog shows a Settings CTA.
 */
export function usePluginListTags<T extends TaggedItem>({
  settingsKey,
  storageKey,
  items,
  enabled = true,
  isCompanion = false,
  onOpenSettings,
}: UsePluginListTagsOptions<T>) {
  const { t } = useTranslation();
  const { getSettings, settingsVersion } = useApp();
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { filtersVisible: tagsVisible, setFiltersVisible: setTagsVisible } =
    usePersistedFiltersVisible(storageKey);

  useEffect(() => {
    let cancelled = false;
    getSettings(settingsKey)
      .then((settings) => {
        if (!cancelled) {
          setAvailableTags(readCatalog(settings));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableTags([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsKey, settingsVersion]);

  useEffect(() => {
    setSelectedTags((prev) => {
      const next = prev.filter((tag) => availableTags.includes(tag));
      return next.length === prev.length ? prev : next;
    });
  }, [availableTags]);

  const showControl = enabled && (!isCompanion || availableTags.length > 0);

  const matches = (item: T) => itemMatchesSelectedTags(item, selectedTags);

  const toggleClassName = isCompanion
    ? PLUGIN_PAGE_COMPANION_TOOLBAR_CONTROL_CLASS
    : 'h-11 rounded-full';

  const toggle = showControl ? (
    <ListTagsChipsToggle
      visible={tagsVisible}
      onVisibleChange={setTagsVisible}
      hasActiveSelection={selectedTags.length > 0}
      className={toggleClassName}
    />
  ) : null;

  const mobileToggle = showControl ? (
    <ListTagsChipsToggle
      visible={tagsVisible}
      onVisibleChange={setTagsVisible}
      hasActiveSelection={selectedTags.length > 0}
      className="h-7 rounded-md"
    />
  ) : null;

  const row = useMemo(() => {
    if (!showControl || !tagsVisible) {
      return null;
    }
    if (availableTags.length === 0) {
      return <ListTagsEmptyRow onOpenSettings={onOpenSettings} />;
    }
    return (
      <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
        {availableTags.map((tag) => {
          const active = selectedTags.includes(tag);
          const count = countItemsWithTag(items, tag);
          return (
            <Button
              key={tag}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTags((prev) => toggleTagFilter(prev, tag))}
              className={cn(
                active ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
                isCompanion && LIST_FILTER_CHIP_COMPANION_SIZE_CLASS,
              )}
            >
              <Tag className="h-3.5 w-3.5" />
              <span>
                {tag} <span className="tabular-nums font-semibold">({count})</span>
              </span>
            </Button>
          );
        })}
        <ListChipRowClear
          visible={selectedTags.length > 0}
          ariaLabel={t('common.clearTags')}
          onClear={() => setSelectedTags([])}
        />
      </div>
    );
  }, [
    availableTags,
    isCompanion,
    items,
    onOpenSettings,
    selectedTags,
    showControl,
    t,
    tagsVisible,
  ]);

  return { availableTags, selectedTags, tagsVisible, matches, toggle, mobileToggle, row };
}
