import { Download, Grip, Plus, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Switch } from '@/components/ui/switch';
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
import { CONTACTS_SETTINGS_KEY } from '../utils/contactColumnCount';
import {
  contactTableColumnsEqual,
  isContactTableColumnId,
  normalizeContactTableColumns,
  reorderContactTableColumns,
  setContactTableColumnHidden,
  type ContactTableColumnId,
  type ContactTableColumnsPref,
} from '../utils/contactTableColumns';

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

const COLUMN_LABEL_KEYS: Record<ContactTableColumnId, string> = {
  name: 'contacts.table.name',
  type: 'contacts.table.type',
  tags: 'contacts.table.tags',
  assignable: 'contacts.table.assignable',
  time: 'contacts.table.time',
  email: 'contacts.table.email',
  phone: 'contacts.table.phone',
  createdAt: 'contacts.table.created',
  updatedAt: 'contacts.table.updated',
};

export type ContactSettingsCategory = 'tags' | 'columns' | 'import';

interface ContactSettingsViewProps {
  selectedCategory?: ContactSettingsCategory;
  onSelectedCategoryChange?: (category: ContactSettingsCategory) => void;
  /** @deprecated Category buttons live in the settings header. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
}

export function ContactSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: ContactSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { importContacts } = useContacts();
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const [internalCategory, setInternalCategory] = useState<ContactSettingsCategory>('tags');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [tags, setTags] = useState<string[]>([]);
  const [initialTags, setInitialTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [tableColumns, setTableColumns] = useState<ContactTableColumnsPref>(() =>
    normalizeContactTableColumns(null),
  );
  const [initialTableColumns, setInitialTableColumns] = useState<ContactTableColumnsPref>(() =>
    normalizeContactTableColumns(null),
  );
  const [draggingColumnId, setDraggingColumnId] = useState<ContactTableColumnId | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<ContactTableColumnId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'tags',
        label: t('contacts.settingsCategories.tags'),
        description: t('contacts.settingsCategories.tagsDescription'),
        icon: SETTINGS_CATEGORY_ICONS.tags,
      },
      {
        id: 'columns',
        label: t('contacts.settingsCategories.columns'),
        description: t('contacts.settingsCategories.columnsDescription'),
        icon: SETTINGS_CATEGORY_ICONS.columns,
      },
      {
        id: 'import',
        label: t('contacts.settingsCategories.import'),
        description: t('contacts.settingsCategories.importDescription'),
        icon: SETTINGS_CATEGORY_ICONS.import,
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
        const loadedTags = Array.isArray(settings?.tags)
          ? settings.tags
              .filter((tag: unknown) => typeof tag === 'string')
              .map((tag: string) => tag.trim())
              .filter(Boolean)
          : [];
        setTags(loadedTags);
        setInitialTags(loadedTags);
        const loadedColumns = normalizeContactTableColumns(settings?.tableColumns);
        setTableColumns(loadedColumns);
        setInitialTableColumns(loadedColumns);
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

  const tagsEqual =
    tags.length === initialTags.length && tags.every((tag, i) => tag === initialTags[i]);
  const columnsEqual = contactTableColumnsEqual(tableColumns, initialTableColumns);
  const isDirty =
    (activeCategory === 'tags' && tagsEqual === false) ||
    (activeCategory === 'columns' && columnsEqual === false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (activeCategory === 'tags') {
        await updateSettings(CONTACTS_SETTINGS_KEY, { tags });
        setInitialTags([...tags]);
      } else if (activeCategory === 'columns') {
        const next = normalizeContactTableColumns(tableColumns);
        await updateSettings(CONTACTS_SETTINGS_KEY, { tableColumns: next });
        setTableColumns(next);
        setInitialTableColumns(next);
      }
    } catch (error) {
      console.error('Failed to save contacts settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [activeCategory, tags, tableColumns, updateSettings]);

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

  const handleDragStart = (e: React.DragEvent, columnId: ContactTableColumnId) => {
    setDraggingColumnId(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: ContactTableColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggingColumnId && draggingColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: ContactTableColumnId) => {
    e.preventDefault();
    const rawSource = e.dataTransfer.getData('text/plain') || draggingColumnId;
    if (isContactTableColumnId(rawSource)) {
      setTableColumns((prev) => ({
        ...prev,
        order: reorderContactTableColumns(prev.order, rawSource, targetId),
      }));
    }
    setDraggingColumnId(null);
    setDragOverColumnId(null);
  };

  const handleDragEnd = () => {
    setDraggingColumnId(null);
    setDragOverColumnId(null);
  };

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
        onClose={onClose}
        onSave={isDirty ? () => void handleSave() : undefined}
        isSaving={isSaving}
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

        {activeCategory === 'columns' && (
          <DetailSection title={t('contacts.settingsCategories.columns')} className="pt-0">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('contacts.settingsCategories.columnsHint')}
              </p>
              <ul className="divide-y divide-border/50 rounded-lg border border-border/50 bg-background">
                {tableColumns.order.map((columnId) => {
                  const isVisible = !tableColumns.hidden.includes(columnId);
                  const isName = columnId === 'name';
                  return (
                    <li
                      key={columnId}
                      draggable
                      onDragStart={(e) => handleDragStart(e, columnId)}
                      onDragOver={(e) => handleDragOver(e, columnId)}
                      onDrop={(e) => handleDrop(e, columnId)}
                      onDragEnd={handleDragEnd}
                      onDragLeave={() => {
                        if (dragOverColumnId === columnId) {
                          setDragOverColumnId(null);
                        }
                      }}
                      className={cn(
                        'flex items-center justify-between gap-3 px-4 py-2.5 transition-colors',
                        draggingColumnId === columnId && 'opacity-50',
                        dragOverColumnId === columnId && 'bg-muted/60',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Grip
                          className="h-3.5 w-3.5 flex-shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing"
                          aria-hidden
                        />
                        <span className="text-sm font-medium">
                          {t(COLUMN_LABEL_KEYS[columnId])}
                        </span>
                      </div>
                      <Switch
                        checked={isVisible}
                        disabled={isName}
                        onCheckedChange={(checked) => {
                          setTableColumns((prev) =>
                            setContactTableColumnHidden(prev, columnId, !checked),
                          );
                        }}
                        aria-label={t('contacts.settingsCategories.columnsToggle', {
                          column: t(COLUMN_LABEL_KEYS[columnId]),
                        })}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          </DetailSection>
        )}

        {activeCategory === 'import' && (
          <DetailSection title={t('contacts.import')} className="pt-0">
            <p className="mb-4 text-sm text-muted-foreground">{t('contacts.importDescription')}</p>
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
                    schema: getContactImportSchema(),
                    filename: 'contacts-import-template.csv',
                    exampleRow: CONTACT_IMPORT_EXAMPLE_ROW,
                  })
                }
              />
              <RoundIconLabelButton
                type="button"
                icon={Upload}
                label={t('contacts.import')}
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
        onImport={importContacts}
        schema={getContactImportSchema()}
        title={t('contacts.import')}
      />
    </>
  );
}
