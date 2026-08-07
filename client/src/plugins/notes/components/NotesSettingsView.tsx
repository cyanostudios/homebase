// Notes settings as full-page content matching Core Settings layout.

import { Download, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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

import { useNotes } from '../hooks/useNotes';
import {
  NOTES_COLUMN_COUNT_STORAGE_KEY,
  NOTES_SETTINGS_KEY,
  resolveNoteColumnCount,
  type NoteColumnCount,
} from '../utils/noteColumnCount';

const getNoteImportSchema = (t: (key: string) => string): ImportSchema => ({
  fields: [
    { key: 'title', label: t('notes.title'), required: true },
    { key: 'content', label: t('notes.content'), required: true },
  ],
});

export type NotesSettingsCategory = 'view' | 'import';

const COLUMN_OPTIONS: NoteColumnCount[] = [1, 2, 3];

interface NotesSettingsViewProps {
  selectedCategory?: NotesSettingsCategory;
  onSelectedCategoryChange?: (category: NotesSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  inlineTrailing?: React.ReactNode;
}

export function NotesSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  inlineTrailing,
}: NotesSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { importNotes } = useNotes();

  const [internalCategory, setInternalCategory] = useState<NotesSettingsCategory>('view');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [columnCount, setColumnCount] = useState<NoteColumnCount>(1);
  const [initialColumnCount, setInitialColumnCount] = useState<NoteColumnCount>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'view',
        label: t('notes.settingsCategories.view'),
        description: t('notes.settingsCategories.viewDescription'),
        icon: SETTINGS_CATEGORY_ICONS.view,
        dotClassName: 'bg-blue-500',
      },
      {
        id: 'import',
        label: t('common.import'),
        description: t('notes.settingsCategories.importDescription'),
        icon: SETTINGS_CATEGORY_ICONS.import,
        dotClassName: 'bg-emerald-500',
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
        const loaded = resolveNoteColumnCount(settings);
        setColumnCount(loaded);
        setInitialColumnCount(loaded);
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

  const isDirty = columnCount !== initialColumnCount;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings(NOTES_SETTINGS_KEY, { columnCount });
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(NOTES_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
      }
      setInitialColumnCount(columnCount);
    } catch (error) {
      console.error('Failed to save notes settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [columnCount, updateSettings]);

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
        trailing={inlineTrailing}
        saveAction={
          isDirty ? (
            <SettingsHeaderSaveButton onClick={() => void handleSave()} isSaving={isSaving} />
          ) : null
        }
      >
        {activeCategory === 'view' && (
          <DetailSection title={t('notes.defaultColumns')} className="pt-0">
            <div className="flex flex-wrap items-center gap-2">
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
                  >
                    <span>{t(`notes.columns${count}`)}</span>
                  </Button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t('notes.columnsHelp')}</p>
          </DetailSection>
        )}

        {activeCategory === 'import' && (
          <DetailSection title={t('common.import')} className="pt-0">
            <p className="mb-4 text-sm text-muted-foreground">{t('notes.importDescription')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={Download}
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
                {t('notes.importTitle') || t('common.import')}
              </Button>
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
