// Notes settings as full-page content matching Core Settings layout.

import { Download, Upload } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { DetailSection } from '@/core/ui/DetailSection';
import { ImportWizard } from '@/core/ui/ImportWizard';
import {
  PluginSettingsPageShell,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import type { ImportSchema } from '@/core/utils/importUtils';
import { downloadImportCsvTemplate } from '@/core/utils/importUtils';

import { useNotes } from '../hooks/useNotes';

const getNoteImportSchema = (t: (key: string) => string): ImportSchema => ({
  fields: [
    { key: 'title', label: t('notes.title'), required: true },
    { key: 'content', label: t('notes.content'), required: true },
  ],
});

export type NotesSettingsCategory = 'import';

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
  const { importNotes } = useNotes();

  const [internalCategory, setInternalCategory] = useState<NotesSettingsCategory>('import');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'import',
        label: t('common.import'),
        description: t('notes.settingsCategories.importDescription'),
        icon: SETTINGS_CATEGORY_ICONS.import,
      },
    ],
    [t],
  );

  return (
    <>
      <PluginSettingsPageShell
        title={t('notes.settingsNotes')}
        subtitle={t('notes.settingsSubtitle')}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id as NotesSettingsCategory)}
        onClose={onClose}
      >
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
