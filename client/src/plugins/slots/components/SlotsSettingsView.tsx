// Slots settings as full-page content matching Core Settings layout.

import { Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { TableColumnsSettingsSection } from '@/core/ui/TableColumnsSettingsSection';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';

import { useSlotSettings } from '../hooks/useSlotSettings';
import { SLOTS_SETTINGS_KEY } from '../utils/slotColumnCount';
import {
  isSlotTableColumnId,
  normalizeSlotTableColumns,
  reorderSlotTableColumns,
  setSlotTableColumnHidden,
  slotTableColumnsEqual,
  type SlotTableColumnId,
  type SlotTableColumnsPref,
} from '../utils/slotTableColumns';

const COLUMN_LABEL_KEYS: Record<SlotTableColumnId, string> = {
  name: 'slots.nameLabel',
  category: 'slots.categoryLabel',
  location: 'slots.locationLabel',
  slot_time: 'slots.timeLabel',
  visible: 'common.visible',
  booked_count: 'slots.publicBookings',
  created_at: 'common.created',
  updated_at: 'common.updated',
};

export type SlotsSettingsCategory = 'columns' | 'categories';

interface SlotsSettingsViewProps {
  selectedCategory?: SlotsSettingsCategory;
  onSelectedCategoryChange?: (category: SlotsSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
}

export function SlotsSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: SlotsSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const {
    tags,
    setTags,
    isDirty: tagsDirty,
    isLoading: tagsLoading,
    isSaving: tagsSaving,
    save: saveTags,
  } = useSlotSettings();
  const [internalSelectedCategory, setInternalSelectedCategory] =
    useState<SlotsSettingsCategory>('columns');
  const [newTag, setNewTag] = useState('');
  const activeCategory = selectedCategory ?? internalSelectedCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalSelectedCategory;

  const [tableColumns, setTableColumns] = useState<SlotTableColumnsPref>(() =>
    normalizeSlotTableColumns(null),
  );
  const [initialTableColumns, setInitialTableColumns] = useState<SlotTableColumnsPref>(() =>
    normalizeSlotTableColumns(null),
  );
  const [columnsLoading, setColumnsLoading] = useState(true);
  const [columnsSaving, setColumnsSaving] = useState(false);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'columns',
        label: t('slots.settingsCategories.columns'),
        description: t('slots.settingsCategories.columnsDescription'),
        icon: SETTINGS_CATEGORY_ICONS.columns,
      },
      {
        id: 'categories',
        label: t('slots.settingsCategories.categories'),
        description: t('slots.settingsCategories.categoriesDescription'),
        icon: SETTINGS_CATEGORY_ICONS.categories,
      },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(SLOTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loaded = normalizeSlotTableColumns(settings?.tableColumns);
        setTableColumns(loaded);
        setInitialTableColumns(loaded);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setColumnsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const columnsDirty = !slotTableColumnsEqual(tableColumns, initialTableColumns);
  const isDirty =
    (activeCategory === 'columns' && columnsDirty) ||
    (activeCategory === 'categories' && tagsDirty);
  const isSaving = activeCategory === 'columns' ? columnsSaving : tagsSaving;
  const isLoading = tagsLoading || columnsLoading;

  const handleSaveColumns = useCallback(async () => {
    setColumnsSaving(true);
    try {
      const next = normalizeSlotTableColumns(tableColumns);
      await updateSettings(SLOTS_SETTINGS_KEY, { tableColumns: next });
      setTableColumns(next);
      setInitialTableColumns(next);
    } catch (error) {
      console.error('Failed to save slots table columns:', error);
    } finally {
      setColumnsSaving(false);
    }
  }, [tableColumns, updateSettings]);

  const handleSave = useCallback(async () => {
    if (activeCategory === 'columns') {
      await handleSaveColumns();
      return;
    }
    if (activeCategory === 'categories') {
      await saveTags();
    }
  }, [activeCategory, handleSaveColumns, saveTags]);

  const addTag = useCallback(() => {
    const next = newTag.trim();
    if (!next) {
      return;
    }
    const exists = tags.some((tag) => tag.toLowerCase() === next.toLowerCase());
    if (exists) {
      setNewTag('');
      return;
    }
    setTags((prev) => [...prev, next]);
    setNewTag('');
  }, [newTag, tags, setTags]);

  const removeTag = useCallback(
    (tag: string) => {
      setTags((prev) => prev.filter((item) => item !== tag));
    },
    [setTags],
  );

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <PluginSettingsPageShell
      title={t('slots.settingsSlots')}
      subtitle={t('slots.settingsSubtitle')}
      categories={categories}
      activeCategory={activeCategory}
      onCategoryChange={(id) => setActiveCategory(id as SlotsSettingsCategory)}
      onClose={onClose}
      onSave={isDirty ? () => void handleSave() : undefined}
      isSaving={isSaving}
      saveAction={
        isDirty ? (
          <SettingsHeaderSaveButton onClick={() => void handleSave()} isSaving={isSaving} />
        ) : null
      }
    >
      {activeCategory === 'columns' && (
        <TableColumnsSettingsSection
          title={t('slots.settingsCategories.columns')}
          hint={t('slots.settingsCategories.columnsHint')}
          pref={tableColumns}
          requiredColumnId="name"
          labelFor={(id) => t(COLUMN_LABEL_KEYS[id])}
          isColumnId={isSlotTableColumnId}
          reorder={reorderSlotTableColumns}
          setHidden={setSlotTableColumnHidden}
          onChange={setTableColumns}
        />
      )}

      {activeCategory === 'categories' && (
        <DetailSection title="Categories" className="pt-0">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Categories can be assigned to slots in Slot form.
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a category (e.g. VIP, Stand A)"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <RoundIconLabelButton
                type="button"
                icon={Plus}
                label="Add"
                variant="secondary"
                size="xs"
                alwaysExpanded
                onClick={addTag}
                disabled={!newTag.trim()}
              />
            </div>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1">
                    <span>{tag}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 min-w-5 p-0 rounded hover:bg-muted"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove category ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </DetailSection>
      )}
    </PluginSettingsPageShell>
  );
}
