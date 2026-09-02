// Notes settings as full-page content matching Core Settings layout.

import { Download, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { ImportWizard } from '@/core/ui/ImportWizard';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { TableColumnsSettingsSection } from '@/core/ui/TableColumnsSettingsSection';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import type { ImportSchema } from '@/core/utils/importUtils';
import { downloadImportCsvTemplate } from '@/core/utils/importUtils';

import { useNotes } from '../hooks/useNotes';
import { NOTES_SETTINGS_KEY } from '../utils/noteColumnCount';
import {
  isNoteTableColumnId,
  normalizeNoteTableColumns,
  noteTableColumnsEqual,
  reorderNoteTableColumns,
  setNoteTableColumnHidden,
  type NoteTableColumnId,
  type NoteTableColumnsPref,
} from '../utils/noteTableColumns';

const getNoteImportSchema = (t: (key: string) => string): ImportSchema => ({
  fields: [
    { key: 'title', label: t('notes.title'), required: true },
    { key: 'content', label: t('notes.content'), required: true },
  ],
});

const COLUMN_LABEL_KEYS: Record<NoteTableColumnId, string> = {
  title: 'notes.title',
  mentions: 'notes.mentions',
  createdAt: 'common.created',
  updatedAt: 'common.updated',
};

export type NotesSettingsCategory = 'columns' | 'import';

interface NotesSettingsViewProps {
  selectedCategory?: NotesSettingsCategory;
  onSelectedCategoryChange?: (category: NotesSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
}

export function NotesSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: NotesSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { importNotes } = useNotes();

  const [internalCategory, setInternalCategory] = useState<NotesSettingsCategory>('columns');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const [tableColumns, setTableColumns] = useState<NoteTableColumnsPref>(() =>
    normalizeNoteTableColumns(null),
  );
  const [initialTableColumns, setInitialTableColumns] = useState<NoteTableColumnsPref>(() =>
    normalizeNoteTableColumns(null),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'columns',
        label: t('notes.settingsCategories.columns'),
        description: t('notes.settingsCategories.columnsDescription'),
        icon: SETTINGS_CATEGORY_ICONS.columns,
      },
      {
        id: 'import',
        label: t('common.import'),
        description: t('notes.settingsCategories.importDescription'),
        icon: SETTINGS_CATEGORY_ICONS.import,
      },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(NOTES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loaded = normalizeNoteTableColumns(settings?.tableColumns);
        setTableColumns(loaded);
        setInitialTableColumns(loaded);
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

  const isDirty =
    activeCategory === 'columns' && !noteTableColumnsEqual(tableColumns, initialTableColumns);

  const handleSave = useCallback(async () => {
    if (activeCategory !== 'columns') {
      return;
    }
    setIsSaving(true);
    try {
      const next = normalizeNoteTableColumns(tableColumns);
      await updateSettings(NOTES_SETTINGS_KEY, { tableColumns: next });
      setTableColumns(next);
      setInitialTableColumns(next);
    } catch (error) {
      console.error('Failed to save notes table columns:', error);
    } finally {
      setIsSaving(false);
    }
  }, [activeCategory, tableColumns, updateSettings]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <>
      <PluginSettingsPageShell
        title={t('notes.settingsNotes')}
        subtitle={t('notes.settingsSubtitle')}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id as NotesSettingsCategory)}
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
        {activeCategory === 'columns' && (
          <TableColumnsSettingsSection
            title={t('notes.settingsCategories.columns')}
            hint={t('notes.settingsCategories.columnsHint')}
            pref={tableColumns}
            requiredColumnId="title"
            labelFor={(id) => t(COLUMN_LABEL_KEYS[id])}
            isColumnId={isNoteTableColumnId}
            reorder={reorderNoteTableColumns}
            setHidden={setNoteTableColumnHidden}
            onChange={setTableColumns}
          />
        )}

        {activeCategory === 'import' && (
          <DetailSection title={t('common.import')} className="pt-0">
            <p className="mb-4 text-sm text-muted-foreground">{t('notes.importDescription')}</p>
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
                    schema: getNoteImportSchema(t),
                    filename: 'notes-import-template.csv',
                    exampleRow: {
                      title: t('notes.importTemplateExampleTitle'),
                      content: t('notes.importTemplateExampleContent'),
                    },
                  })
                }
              />
              <RoundIconLabelButton
                type="button"
                icon={Upload}
                label={t('notes.importTitle') || t('common.import')}
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
        onImport={importNotes}
        schema={getNoteImportSchema(t)}
        title={t('notes.importTitle') || t('common.import')}
      />
    </>
  );
}
