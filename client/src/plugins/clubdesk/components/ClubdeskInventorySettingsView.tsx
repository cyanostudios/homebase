import { Download, Eye, Plus, Receipt, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useApp } from '@/core/api/AppContext';
import { hasInventoryInvoicingPlugins } from '@/core/settings/inventoryInvoicingGate';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { InventoryInvoicingEnableSwitch } from '@/plugins/invoices/components/InventoryInvoicingEnableSwitch';
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

import { clubdeskApi } from '../api/clubdeskApi';
import { useClubdesk } from '../hooks/useClubdesk';
import { CLUBDESK_INVENTORY_SETTINGS_KEY } from '../utils/clubdeskInventorySettingsKey';
import {
  CLUBDESK_INVENTORY_IMPORT_EXAMPLE_ROWS,
  getClubdeskInventoryImportSchema,
} from '../utils/inventoryImportSchema';
import { inventoryTagsEqual, normalizeInventoryTags } from '../utils/inventoryTags';

import { ClubdeskPublicVisibleSwitch } from './ClubdeskPublicVisibleSwitch';

export type ClubdeskInventorySettingsCategory = 'public' | 'tags' | 'invoicing' | 'import';

interface ClubdeskInventorySettingsViewProps {
  selectedCategory?: ClubdeskInventorySettingsCategory;
  onSelectedCategoryChange?: (category: ClubdeskInventorySettingsCategory) => void;
  onClose?: () => void;
}

function readCardVisible(meta: Record<string, unknown> | undefined): boolean {
  return meta?.visible !== false;
}

export function ClubdeskInventorySettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: ClubdeskInventorySettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const enabledPlugins = useEnabledPlugins();
  const showInvoicingCategory = hasInventoryInvoicingPlugins(enabledPlugins);
  const { importInventoryItems } = useClubdesk();
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const [internalCategory, setInternalCategory] =
    useState<ClubdeskInventorySettingsCategory>('public');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [tags, setTags] = useState<string[]>([]);
  const [initialTags, setInitialTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [inventoryPublicVisible, setInventoryPublicVisible] = useState(true);
  const [initialInventoryPublicVisible, setInitialInventoryPublicVisible] = useState(true);
  const [invoicable, setInvoicable] = useState(false);
  const [initialInvoicable, setInitialInvoicable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const importSchema = useMemo(() => getClubdeskInventoryImportSchema(), []);

  const categories: PluginSettingsCategory[] = useMemo(() => {
    const list: PluginSettingsCategory[] = [
      {
        id: 'public',
        label: t('clubdesk.inventory.settingsCategories.public'),
        description: t('clubdesk.inventory.settingsCategories.publicDescription'),
        icon: Eye,
      },
      {
        id: 'tags',
        label: t('clubdesk.inventory.settingsCategories.tags'),
        description: t('clubdesk.inventory.settingsCategories.tagsDescription'),
        icon: SETTINGS_CATEGORY_ICONS.tags,
      },
    ];
    if (showInvoicingCategory) {
      list.push({
        id: 'invoicing',
        label: t('clubdesk.inventory.settingsCategories.invoicing'),
        description: t('clubdesk.inventory.settingsCategories.invoicingDescription'),
        icon: Receipt,
      });
    }
    list.push({
      id: 'import',
      label: t('common.import'),
      description: t('clubdesk.inventory.settingsCategories.importDescription'),
      icon: SETTINGS_CATEGORY_ICONS.import,
    });
    return list;
  }, [showInvoicingCategory, t]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSettings(CLUBDESK_INVENTORY_SETTINGS_KEY), clubdeskApi.getSiteContent()])
      .then(([settings, siteContent]) => {
        if (cancelled) {
          return;
        }
        const loadedTags = normalizeInventoryTags(settings?.tags);
        setTags(loadedTags);
        setInitialTags(loadedTags);
        const loadedInvoicable = settings?.invoicable === true;
        setInvoicable(loadedInvoicable);
        setInitialInvoicable(loadedInvoicable);
        const visible = readCardVisible(siteContent.inventory?.meta);
        setInventoryPublicVisible(visible);
        setInitialInventoryPublicVisible(visible);
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
  const publicDirty = inventoryPublicVisible !== initialInventoryPublicVisible;
  const invoicingDirty = invoicable !== initialInvoicable;
  const isDirty =
    (activeCategory === 'tags' && tagsDirty) ||
    (activeCategory === 'public' && publicDirty) ||
    (activeCategory === 'invoicing' && invoicingDirty);

  const handleSave = useCallback(async () => {
    if (activeCategory === 'import') {
      return;
    }
    setIsSaving(true);
    try {
      if (activeCategory === 'tags') {
        const next = normalizeInventoryTags(tags);
        await updateSettings(CLUBDESK_INVENTORY_SETTINGS_KEY, { tags: next });
        setTags(next);
        setInitialTags(next);
      } else if (activeCategory === 'invoicing') {
        await updateSettings(CLUBDESK_INVENTORY_SETTINGS_KEY, { invoicable });
        setInitialInvoicable(invoicable);
      } else if (activeCategory === 'public') {
        await clubdeskApi.saveSiteContent([
          {
            cardKey: 'inventory',
            content: '',
            meta: { visible: inventoryPublicVisible },
          },
        ]);
        setInitialInventoryPublicVisible(inventoryPublicVisible);
      }
    } catch (error) {
      console.error('Failed to save clubdesk inventory settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [activeCategory, inventoryPublicVisible, invoicable, tags, updateSettings]);

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
        title={t('clubdesk.inventory.settingsInventory')}
        subtitle={t('clubdesk.inventory.settingsInventorySubtitle')}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id as ClubdeskInventorySettingsCategory)}
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
        {activeCategory === 'public' && (
          <DetailSection
            title={t('clubdesk.inventory.settingsCategories.public')}
            icon={Eye}
            subtleTitle
            className="pt-0"
            titleAside={
              <ClubdeskPublicVisibleSwitch
                id="clubdesk-inventory-public-visible"
                checked={inventoryPublicVisible}
                onCheckedChange={setInventoryPublicVisible}
              />
            }
          >
            <p className="text-sm text-muted-foreground">
              {t('clubdesk.inventory.settingsCategories.publicHint')}
            </p>
          </DetailSection>
        )}

        {activeCategory === 'invoicing' && (
          <DetailSection
            title={t('clubdesk.inventory.settingsCategories.invoicing')}
            icon={Receipt}
            subtleTitle
            className="pt-0"
            titleAside={
              <InventoryInvoicingEnableSwitch
                id="clubdesk-inventory-invoicable"
                checked={invoicable}
                onCheckedChange={setInvoicable}
              />
            }
          >
            <p className="text-sm text-muted-foreground">
              {t('clubdesk.inventory.settingsCategories.invoicingHint')}
            </p>
          </DetailSection>
        )}

        {activeCategory === 'tags' && (
          <DetailSection
            title={t('clubdesk.inventory.settingsCategories.tags')}
            icon={SETTINGS_CATEGORY_ICONS.tags}
            subtleTitle
            className="pt-0"
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('clubdesk.inventory.settingsCategories.tagsHint')}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder={t('clubdesk.inventory.settingsCategories.tagsPlaceholder')}
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
                <p className="text-sm text-muted-foreground">{t('clubdesk.inventory.noTagsYet')}</p>
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
                        aria-label={t('clubdesk.inventory.removeTagAria', { tag })}
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
            title={t('clubdesk.inventory.importInventory')}
            icon={SETTINGS_CATEGORY_ICONS.import}
            subtleTitle
            className="pt-0"
          >
            <p className="mb-4 text-sm text-muted-foreground">
              {t('clubdesk.inventory.importInventoryDescription')}
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
                    filename: 'clubdesk-inventory-import-template.csv',
                    exampleRows: CLUBDESK_INVENTORY_IMPORT_EXAMPLE_ROWS,
                  })
                }
              />
              <RoundIconLabelButton
                type="button"
                icon={Upload}
                label={t('clubdesk.inventory.importInventory')}
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
        title={t('clubdesk.inventory.importInventory')}
      />
    </>
  );
}
