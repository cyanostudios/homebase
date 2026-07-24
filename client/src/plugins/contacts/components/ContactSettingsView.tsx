import { Check, Download, Eye, Plus, Tag, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApp } from '@/core/api/AppContext';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { ImportWizard } from '@/core/ui/ImportWizard';
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

interface ContactSettingsCategoryDef {
  id: ContactSettingsCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const getContactSettingsCategories = (t: (key: string) => string): ContactSettingsCategoryDef[] => [
  { id: 'view', label: 'View', icon: Eye },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'import', label: t('contacts.import'), icon: Upload },
];

const COLUMN_OPTIONS: ContactColumnCount[] = [1, 2, 3];
interface ContactSettingsViewProps {
  selectedCategory?: ContactSettingsCategory;
  onSelectedCategoryChange?: (category: ContactSettingsCategory) => void;
  renderCategoryButtonsInline?: boolean;
  inlineTrailing?: React.ReactNode;
}

export function ContactSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  renderCategoryButtonsInline = false,
  inlineTrailing,
}: ContactSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { setHeaderTrailing } = useContentLayout();
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

  const categoryButtons = useMemo(
    () => (
      <div className="flex items-center gap-1">
        {getContactSettingsCategories(t).map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          return (
            <Button
              key={category.id}
              variant="ghost"
              onClick={() => !isActive && setActiveCategory(category.id)}
              className={cn(
                'h-9 text-xs px-3 rounded-lg font-medium transition-colors',
                'flex items-center gap-1.5 sm:gap-2',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary hover:bg-primary/15'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
              )}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{category.label}</span>
            </Button>
          );
        })}
      </div>
    ),
    [activeCategory, setActiveCategory, t],
  );

  useEffect(() => {
    if (renderCategoryButtonsInline) {
      setHeaderTrailing(null);
      return;
    }
    setHeaderTrailing(categoryButtons);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, renderCategoryButtonsInline, categoryButtons]);

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

  const settingsTitle = t('contacts.settingsContacts');

  return (
    <div className="space-y-4">
      {renderCategoryButtonsInline ? (
        <div className="flex flex-shrink-0 items-center justify-between">
          <div className="mr-4 min-w-0 flex flex-1 items-center gap-4">
            <h2 className="truncate shrink-0 text-lg font-semibold tracking-tight">
              {settingsTitle}
            </h2>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {categoryButtons}
            {inlineTrailing}
          </div>
        </div>
      ) : (
        <h2 className="text-lg font-semibold tracking-tight">{settingsTitle}</h2>
      )}

      <Card padding="md" className="overflow-hidden border border-border/70 bg-card shadow-sm">
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
      </Card>

      <ImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        onImport={importContacts}
        schema={getContactImportSchema()}
        title={t('contacts.import')}
      />

      {isDirty && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSave}
            variant="primary"
            size="sm"
            icon={Check}
            disabled={isSaving}
            className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
          >
            {isSaving ? t('contacts.saving') : t('contacts.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
