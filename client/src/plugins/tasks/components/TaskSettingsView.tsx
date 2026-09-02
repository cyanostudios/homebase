// Tasks settings as full-page content matching Core Settings layout.

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

import { useTasks } from '../hooks/useTasks';
import { TASKS_SETTINGS_KEY } from '../utils/taskColumnCount';
import {
  isTaskTableColumnId,
  normalizeTaskTableColumns,
  reorderTaskTableColumns,
  setTaskTableColumnHidden,
  taskTableColumnsEqual,
  type TaskTableColumnId,
  type TaskTableColumnsPref,
} from '../utils/taskTableColumns';

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

const COLUMN_LABEL_KEYS: Record<TaskTableColumnId, string> = {
  title: 'tasks.title',
  status: 'tasks.propertyStatus',
  priority: 'tasks.propertyPriority',
  dueDate: 'tasks.propertyDueDate',
  assignedTo: 'tasks.assignee',
  assignedTeam: 'tasks.assignedTeam',
  createdAt: 'common.created',
  updatedAt: 'common.updated',
};

export type TaskSettingsCategory = 'columns' | 'import';

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
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { importTasks } = useTasks();
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const [internalCategory, setInternalCategory] = useState<TaskSettingsCategory>('columns');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [tableColumns, setTableColumns] = useState<TaskTableColumnsPref>(() =>
    normalizeTaskTableColumns(null),
  );
  const [initialTableColumns, setInitialTableColumns] = useState<TaskTableColumnsPref>(() =>
    normalizeTaskTableColumns(null),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'columns',
        label: t('tasks.settingsCategories.columns'),
        description: t('tasks.settingsCategories.columnsDescription'),
        icon: SETTINGS_CATEGORY_ICONS.columns,
      },
      {
        id: 'import',
        label: t('common.import'),
        description: t('tasks.settingsCategories.importDescription'),
        icon: SETTINGS_CATEGORY_ICONS.import,
      },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(TASKS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loaded = normalizeTaskTableColumns(settings?.tableColumns);
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
    activeCategory === 'columns' && !taskTableColumnsEqual(tableColumns, initialTableColumns);

  const handleSave = useCallback(async () => {
    if (activeCategory !== 'columns') {
      return;
    }
    setIsSaving(true);
    try {
      const next = normalizeTaskTableColumns(tableColumns);
      await updateSettings(TASKS_SETTINGS_KEY, { tableColumns: next });
      setTableColumns(next);
      setInitialTableColumns(next);
    } catch (error) {
      console.error('Failed to save tasks table columns:', error);
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
        title={t('tasks.settingsTasks')}
        subtitle={t('tasks.settingsSubtitle')}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id as TaskSettingsCategory)}
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
            title={t('tasks.settingsCategories.columns')}
            hint={t('tasks.settingsCategories.columnsHint')}
            pref={tableColumns}
            requiredColumnId="title"
            labelFor={(id) => t(COLUMN_LABEL_KEYS[id])}
            isColumnId={isTaskTableColumnId}
            reorder={reorderTaskTableColumns}
            setHidden={setTaskTableColumnHidden}
            onChange={setTableColumns}
          />
        )}

        {activeCategory === 'import' && (
          <DetailSection title={t('common.import')} className="pt-0">
            <p className="mb-4 text-sm text-muted-foreground">{t('tasks.importDescription')}</p>
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
                    schema: getTaskImportSchema(),
                    filename: 'tasks-import-template.csv',
                    exampleRow: TASK_IMPORT_EXAMPLE_ROW,
                  })
                }
              />
              <RoundIconLabelButton
                type="button"
                icon={Upload}
                label={t('common.import')}
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
        onImport={importTasks}
        schema={getTaskImportSchema()}
        title={t('common.import')}
      />
    </>
  );
}
