// Tasks settings as full-page content matching Core Settings layout.

import { Download, Upload } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DetailSection } from '@/core/ui/DetailSection';
import { ImportWizard } from '@/core/ui/ImportWizard';
import {
  PluginSettingsPageShell,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import type { ImportSchema } from '@/core/utils/importUtils';
import { downloadImportCsvTemplate } from '@/core/utils/importUtils';

import { useTasks } from '../hooks/useTasks';

const getTaskImportSchema = (): ImportSchema => ({
  fields: [
    { key: 'title', label: 'Title', required: true },
    { key: 'content', label: 'Content', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'priority', label: 'Priority', required: false },
  ],
});

const TASK_IMPORT_EXAMPLE_ROW: Record<string, string> = {
  title: 'Follow up with client',
  content: 'Send proposal draft',
  status: 'not started',
  priority: 'Medium',
};

export type TaskSettingsCategory = 'import';

interface TaskSettingsViewProps {
  selectedCategory?: TaskSettingsCategory;
  onSelectedCategoryChange?: (category: TaskSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
}

export function TaskSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: TaskSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { importTasks } = useTasks();
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const [internalCategory, setInternalCategory] = useState<TaskSettingsCategory>('import');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'import',
        label: t('common.import'),
        description: t('tasks.settingsCategories.importDescription'),
        icon: SETTINGS_CATEGORY_ICONS.import,
      },
    ],
    [t],
  );

  return (
    <>
      <PluginSettingsPageShell
        title={t('tasks.settingsTasks')}
        subtitle={t('tasks.settingsSubtitle')}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id as TaskSettingsCategory)}
        onClose={onClose}
      >
        {activeCategory === 'import' && (
          <DetailSection title={t('common.import')} className="pt-0">
            <p className="mb-4 text-sm text-muted-foreground">{t('tasks.importDescription')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={Download}
                onClick={() =>
                  downloadImportCsvTemplate({
                    schema: getTaskImportSchema(),
                    filename: 'tasks-import-template.csv',
                    exampleRow: TASK_IMPORT_EXAMPLE_ROW,
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
                {t('common.import')}
              </Button>
            </div>
          </DetailSection>
        )}
      </PluginSettingsPageShell>

      <ImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        onImport={importTasks}
        schema={getTaskImportSchema()}
        title={t('common.import')}
      />
    </>
  );
}
