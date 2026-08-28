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

import { useSlotSettings } from '../hooks/useSlotSettings';

export type SlotsSettingsCategory = 'categories';

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
  const { tags, setTags, isDirty, isLoading, isSaving, save } = useSlotSettings();
  const [internalSelectedCategory, setInternalSelectedCategory] =
    useState<SlotsSettingsCategory>('categories');
  const [newTag, setNewTag] = useState('');
  const activeCategory = selectedCategory ?? internalSelectedCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalSelectedCategory;

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'categories',
        label: t('slots.settingsCategories.categories'),
        description: t('slots.settingsCategories.categoriesDescription'),
        icon: SETTINGS_CATEGORY_ICONS.categories,
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
      onClose={onClose}
      onSave={isDirty ? () => void save() : undefined}
      isSaving={isSaving}
      saveAction={
        isDirty ? (
          <SettingsHeaderSaveButton onClick={() => void save()} isSaving={isSaving} />
        ) : null
      }
    >
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
