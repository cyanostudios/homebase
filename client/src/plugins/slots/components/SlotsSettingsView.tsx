// Slots settings as full-page content matching Core Settings layout.

import { Plus, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { cn } from '@/lib/utils';

import { useSlotSettings } from '../hooks/useSlotSettings';
import type { SlotColumnCount } from '../utils/slotColumnCount';
import type { SlotListViewMode } from '../utils/slotListViewMode';

const COLUMN_OPTIONS: SlotColumnCount[] = [1, 2, 3];
const VIEW_MODE_OPTIONS: SlotListViewMode[] = ['cards', 'table'];

type SlotsSettingsCategory = 'view' | 'categories';

interface SlotsSettingsViewProps {
  selectedCategory?: SlotsSettingsCategory;
  onSelectedCategoryChange?: (category: SlotsSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  inlineTrailing?: React.ReactNode;
}

export function SlotsSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  inlineTrailing,
}: SlotsSettingsViewProps = {}) {
  const { t } = useTranslation();
  const {
    columnCount,
    setColumnCount,
    listViewMode,
    setListViewMode,
    tags,
    setTags,
    isDirty,
    isLoading,
    isSaving,
    save,
  } = useSlotSettings();
  const [internalSelectedCategory, setInternalSelectedCategory] =
    useState<SlotsSettingsCategory>('view');
  const [newTag, setNewTag] = useState('');
  const activeCategory = selectedCategory ?? internalSelectedCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalSelectedCategory;

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'view',
        label: t('slots.settingsCategories.view'),
        description: t('slots.settingsCategories.viewDescription'),
        icon: SETTINGS_CATEGORY_ICONS.view,
        dotClassName: 'bg-blue-500',
      },
      {
        id: 'categories',
        label: t('slots.settingsCategories.categories'),
        description: t('slots.settingsCategories.categoriesDescription'),
        icon: SETTINGS_CATEGORY_ICONS.categories,
        dotClassName: 'bg-amber-500',
      },
    ],
    [t],
  );

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
      trailing={inlineTrailing}
      saveAction={
        isDirty ? (
          <SettingsHeaderSaveButton onClick={() => void save()} isSaving={isSaving} />
        ) : null
      }
    >
      {activeCategory === 'view' && (
        <>
          <DetailSection title={t('common.defaultListView')} className="pt-0">
            <div className="flex items-center gap-2 flex-wrap">
              {VIEW_MODE_OPTIONS.map((mode) => {
                const isActive = listViewMode === mode;
                return (
                  <Button
                    key={mode}
                    variant="ghost"
                    onClick={() => setListViewMode(mode)}
                    className={cn(
                      'h-9 text-xs px-3 rounded-lg font-medium',
                      'flex items-center gap-1.5',
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                    )}
                    aria-label={mode === 'cards' ? t('common.cardsView') : t('common.tableView')}
                    aria-pressed={isActive}
                  >
                    <span>{mode === 'cards' ? t('common.cardsView') : t('common.tableView')}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground mt-2">{t('common.listViewHelp')}</p>
          </DetailSection>
          {listViewMode === 'cards' ? (
            <DetailSection title={t('slots.defaultColumns')}>
              <div className="flex items-center gap-2 flex-wrap">
                {COLUMN_OPTIONS.map((count) => {
                  const isActive = columnCount === count;
                  return (
                    <Button
                      key={count}
                      variant="ghost"
                      onClick={() => setColumnCount(count)}
                      className={cn(
                        'h-9 text-xs px-3 rounded-lg font-medium',
                        'flex items-center gap-1.5',
                        isActive
                          ? 'bg-primary/10 text-primary border border-primary'
                          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                      )}
                      aria-label={t(`slots.columns${count}`)}
                      aria-pressed={isActive}
                    >
                      <span>{count}</span>
                    </Button>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground mt-2">{t('slots.columnsHelp')}</p>
            </DetailSection>
          ) : null}
        </>
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={addTag}
                disabled={!newTag.trim()}
                className="h-9 text-xs px-3"
              >
                Add
              </Button>
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
