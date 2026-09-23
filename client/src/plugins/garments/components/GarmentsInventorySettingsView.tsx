import { Download, Plus, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { ImportWizard } from '@/core/ui/ImportWizard';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { FORM_INPUT_CLASS } from '@/core/ui/formFieldStyles';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { downloadImportCsvTemplate } from '@/core/utils/importUtils';
import { cn } from '@/lib/utils';

import { useGarments } from '../hooks/useGarments';
import { GARMENTS_SETTINGS_KEY } from '../utils/garmentColumnCount';
import {
  GARMENT_INVENTORY_IMPORT_EXAMPLE_ROWS,
  getGarmentInventoryImportSchema,
} from '../utils/inventoryImportSchema';
import { inventoryTagsEqual, normalizeInventoryTags } from '../utils/inventoryTags';

export type GarmentsInventorySettingsCategory = 'tags' | 'import';

interface GarmentsInventorySettingsViewProps {
  selectedCategory?: GarmentsInventorySettingsCategory;
  onSelectedCategoryChange?: (category: GarmentsInventorySettingsCategory) => void;
  onClose?: () => void;
}

export function GarmentsInventorySettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: GarmentsInventorySettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { importInventoryItems } = useGarments();
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const [internalCategory, setInternalCategory] =
    useState<GarmentsInventorySettingsCategory>('tags');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [tags, setTags] = useState<string[]>([]);
  const [initialTags, setInitialTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const importSchema = useMemo(() => getGarmentInventoryImportSchema(), []);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'tags',
        label: t('garments.settingsCategories.tags'),
        description: t('garments.settingsCategories.tagsDescription'),
        icon: SETTINGS_CATEGORY_ICONS.tags,
      },
      {
        id: 'import',
        label: t('common.import'),
        description: t('garments.settingsCategories.importDescription'),
        icon: SETTINGS_CATEGORY_ICONS.import,
      },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(GARMENTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loadedTags = normalizeInventoryTags(settings?.tags);
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

  const tagsDirty = !inventoryTagsEqual(tags, initialTags);
  const isDirty = activeCategory === 'tags' && tagsDirty;

  const handleSave = useCallback(async () => {
    if (activeCategory !== 'tags') {
      return;
    }
    setIsSaving(true);
    try {
      const next = normalizeInventoryTags(tags);
      await updateSettings(GARMENTS_SETTINGS_KEY, { tags: next });
      setTags(next);
      setInitialTags(next);
    } catch (error) {
      console.error('Failed to save garments inventory tags:', error);
    } finally {
      setIsSaving(false);
    }
  }, [activeCategory, tags, updateSettings]);

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
    setTags((prev) => normalizeInventoryTags([...prev, next]));
    setNewTag('');
  }, [newTag, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((x) => x !== tag));
  }, []);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <>
      <PluginSettingsPageShell
        title={t('garments.settingsInventory')}
        subtitle={t('garments.settingsInventorySubtitle')}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id as GarmentsInventorySettingsCategory)}
        onClose={onClose}
        onSave={isDirty ? () => void handleSave() : undefined}
        isSaving={isSaving}
        saveAction={
          isDirty ? (
            <SettingsHeaderSaveButton
              onClick={() => void handleSave()}
              isSaving={isSaving}
              label={t('common.save')}
              savingLabel={t('common.saving')}
            />
          ) : null
        }
      >
        {activeCategory === 'tags' && (
          <DetailSection
            title={t('garments.settingsCategories.tags')}
            icon={SETTINGS_CATEGORY_ICONS.tags}
            subtleTitle
            className="pt-0"
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('garments.settingsCategories.tagsHint')}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder={t('garments.settingsCategories.tagsPlaceholder')}
                  className={cn(FORM_INPUT_CLASS, 'flex-1')}
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
                  label={t('common.add')}
                  variant="secondary"
                  size="xs"
                  alwaysExpanded
                  onClick={addTag}
                  disabled={!newTag.trim()}
                />
              </div>
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('garments.noTagsYet')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1">
                      <span>{tag}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 min-w-5 rounded p-0 hover:bg-muted"
                        onClick={() => removeTag(tag)}
                        aria-label={t('garments.removeTagAria', { tag })}
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

        {activeCategory === 'import' && (
          <DetailSection
            title={t('garments.importInventory')}
            icon={SETTINGS_CATEGORY_ICONS.import}
            subtleTitle
            className="pt-0"
          >
            <p className="mb-4 text-sm text-muted-foreground">
              {t('garments.importInventoryDescription')}
            </p>
            <div className="flex flex-wrap gap-2">
              <RoundIconLabelButton
                type="button"
                icon={Download}
                label={t('importWizard.downloadTemplate')}
                variant="secondary"
                size="xs"
                alwaysExpanded
                onClick={() =>
                  downloadImportCsvTemplate({
                    schema: importSchema,
                    filename: 'garments-inventory-import-template.csv',
                    exampleRows: GARMENT_INVENTORY_IMPORT_EXAMPLE_ROWS,
                  })
                }
              />
              <RoundIconLabelButton
                type="button"
                icon={Upload}
                label={t('garments.importInventory')}
                variant="secondary"
                size="xs"
                alwaysExpanded
                onClick={() => setIsImportWizardOpen(true)}
              />
            </div>
          </DetailSection>
        )}
      </PluginSettingsPageShell>

      <ImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        onImport={importInventoryItems}
        schema={importSchema}
        title={t('garments.importInventory')}
      />
    </>
  );
}
