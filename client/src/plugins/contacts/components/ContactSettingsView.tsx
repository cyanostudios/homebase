import { Download, Plus, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { ImportWizard } from '@/core/ui/ImportWizard';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import type { ImportSchema } from '@/core/utils/importUtils';
import { downloadImportCsvTemplate } from '@/core/utils/importUtils';
import { cn } from '@/lib/utils';

import { useContacts } from '../hooks/useContacts';
import {
  CONTACTS_COLUMN_COUNT_STORAGE_KEY,
  CONTACTS_SETTINGS_KEY,
  resolveContactColumnCount,
  type ContactColumnCount,
} from '../utils/contactColumnCount';

const getContactImportSchema = (): ImportSchema => ({
  fields: [
    { key: 'companyName', label: 'Name', required: true },
    { key: 'contactType', label: 'Type', required: false },
    { key: 'email', label: 'Email', required: false },
    { key: 'phone', label: 'Phone', required: false },
    { key: 'notes', label: 'Notes', required: false },
  ],
});

const CONTACT_IMPORT_EXAMPLE_ROW: Record<string, string> = {
  companyName: 'Acme AB',
  contactType: 'company',
  email: 'info@acme.se',
  phone: '0701234567',
  notes: 'Imported sample',
};

export type ContactSettingsCategory = 'view' | 'tags' | 'import';

const COLUMN_OPTIONS: ContactColumnCount[] = [1, 2, 3];

interface ContactSettingsViewProps {
  selectedCategory?: ContactSettingsCategory;
  onSelectedCategoryChange?: (category: ContactSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  inlineTrailing?: React.ReactNode;
}

export function ContactSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  inlineTrailing,
}: ContactSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings } = useApp();
  const { importContacts } = useContacts();
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const [internalCategory, setInternalCategory] = useState<ContactSettingsCategory>('view');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [columnCount, setColumnCount] = useState<ContactColumnCount>(1);
  const [initialColumnCount, setInitialColumnCount] = useState<ContactColumnCount>(1);
  const [tags, setTags] = useState<string[]>([]);
  const [initialTags, setInitialTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'view',
        label: t('contacts.settingsCategories.view'),
        description: t('contacts.settingsCategories.viewDescription'),
        icon: SETTINGS_CATEGORY_ICONS.view,
        dotClassName: 'bg-blue-500',
      },
      {
        id: 'tags',
        label: t('contacts.settingsCategories.tags'),
        description: t('contacts.settingsCategories.tagsDescription'),
        icon: SETTINGS_CATEGORY_ICONS.tags,
        dotClassName: 'bg-amber-500',
      },
      {
        id: 'import',
        label: t('contacts.settingsCategories.import'),
        description: t('contacts.settingsCategories.importDescription'),
        icon: SETTINGS_CATEGORY_ICONS.import,
        dotClassName: 'bg-emerald-500',
      },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(CONTACTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loadedColumns = resolveContactColumnCount(settings);
        setColumnCount(loadedColumns);
        setInitialColumnCount(loadedColumns);
        const loadedTags = Array.isArray(settings?.tags)
          ? settings.tags
              .filter((tag: unknown) => typeof tag === 'string')
              .map((tag: string) => tag.trim())
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
  }, [getSettings]);

  const tagsEqual =
    tags.length === initialTags.length && tags.every((tag, i) => tag === initialTags[i]);
  const isDirty = columnCount !== initialColumnCount || !tagsEqual;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings(CONTACTS_SETTINGS_KEY, { columnCount, tags });
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CONTACTS_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
      }
      setInitialColumnCount(columnCount);
      setInitialTags([...tags]);
    } catch (error) {
      console.error('Failed to save contacts settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [columnCount, tags, updateSettings]);

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
  }, [newTag, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((x) => x !== tag));
  }, []);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('contacts.loading')}</div>;
  }

  return (
    <>
      <PluginSettingsPageShell
        title={t('contacts.settingsContacts')}
        subtitle={t('contacts.settingsSubtitle')}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id as ContactSettingsCategory)}
        trailing={inlineTrailing}
        saveAction={
          isDirty ? (
            <SettingsHeaderSaveButton
              onClick={() => void handleSave()}
              isSaving={isSaving}
              label={t('contacts.save')}
              savingLabel={t('contacts.saving')}
            />
          ) : null
        }
      >
        {activeCategory === 'view' && (
          <DetailSection title={t('contacts.defaultColumns')} className="pt-0">
            <div className="flex flex-wrap items-center gap-2">
              {COLUMN_OPTIONS.map((count) => {
                const isActive = columnCount === count;
                return (
                  <Button
                    key={count}
                    variant="ghost"
                    onClick={() => setColumnCount(count)}
                    className={cn(
                      'h-9 min-w-9 text-xs px-3 rounded-lg font-medium',
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                    )}
                    aria-label={t(`contacts.columns${count}`)}
                    aria-pressed={isActive}
                  >
                    {count}
                  </Button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t('contacts.columnsHelp')}</p>
          </DetailSection>
        )}

        {activeCategory === 'tags' && (
          <DetailSection title="Tags" className="pt-0">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Tags can be assigned to contacts in Contact Properties.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag (e.g. Family, Work)"
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
                <p className="text-sm text-muted-foreground">No tags yet.</p>
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
                        aria-label={`Remove tag ${tag}`}
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
          <DetailSection title={t('contacts.import')} className="pt-0">
            <p className="mb-4 text-sm text-muted-foreground">{t('contacts.importDescription')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={Download}
                onClick={() =>
                  downloadImportCsvTemplate({
                    schema: getContactImportSchema(),
                    filename: 'contacts-import-template.csv',
                    exampleRow: CONTACT_IMPORT_EXAMPLE_ROW,
                  })
                }
                className="h-9 text-xs px-3"
              >
                {t('importWizard.downloadTemplate')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={Upload}
                onClick={() => setIsImportWizardOpen(true)}
                className="h-9 text-xs px-3"
              >
                {t('contacts.import')}
              </Button>
            </div>
          </DetailSection>
        )}
      </PluginSettingsPageShell>

      <ImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        onImport={importContacts}
        schema={getContactImportSchema()}
        title={t('contacts.import')}
      />
    </>
  );
}
