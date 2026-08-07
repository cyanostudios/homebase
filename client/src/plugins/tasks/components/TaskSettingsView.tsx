// Tasks settings as full-page content matching Core Settings layout.

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

import { useTasks } from '../hooks/useTasks';
import {
  resolveTaskColumnCount,
  TASKS_COLUMN_COUNT_STORAGE_KEY,
  TASKS_SETTINGS_KEY,
  type TaskColumnCount,
} from '../utils/taskColumnCount';

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

export type TaskSettingsCategory = 'view' | 'import';

const COLUMN_OPTIONS: TaskColumnCount[] = [1, 2, 3];

interface TaskSettingsViewProps {
  selectedCategory?: TaskSettingsCategory;
  onSelectedCategoryChange?: (category: TaskSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  inlineTrailing?: React.ReactNode;
}

export function TaskSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  inlineTrailing,
}: TaskSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings } = useApp();
  const { importTasks } = useTasks();
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const [internalCategory, setInternalCategory] = useState<TaskSettingsCategory>('view');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [columnCount, setColumnCount] = useState<TaskColumnCount>(1);
  const [initialColumnCount, setInitialColumnCount] = useState<TaskColumnCount>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'view',
        label: t('tasks.settingsCategories.view'),
        description: t('tasks.settingsCategories.viewDescription'),
        icon: SETTINGS_CATEGORY_ICONS.view,
        dotClassName: 'bg-blue-500',
      },
      {
        id: 'import',
        label: t('common.import'),
        description: t('tasks.settingsCategories.importDescription'),
        icon: SETTINGS_CATEGORY_ICONS.import,
        dotClassName: 'bg-emerald-500',
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
        const loaded = resolveTaskColumnCount(settings);
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
  }, [getSettings]);

  const isDirty = columnCount !== initialColumnCount;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings(TASKS_SETTINGS_KEY, { columnCount });
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(TASKS_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
      }
      setInitialColumnCount(columnCount);
    } catch (error) {
      console.error('Failed to save tasks settings:', error);
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
        title={t('tasks.settingsTasks')}
        subtitle={t('tasks.settingsSubtitle')}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id as TaskSettingsCategory)}
        trailing={inlineTrailing}
        saveAction={
          isDirty ? (
            <SettingsHeaderSaveButton onClick={() => void handleSave()} isSaving={isSaving} />
          ) : null
        }
      >
        {activeCategory === 'view' && (
          <DetailSection title={t('tasks.defaultColumns')} className="pt-0">
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
                    <span>{t(`tasks.columns${count}`)}</span>
                  </Button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t('tasks.columnsHelp')}</p>
          </DetailSection>
        )}
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
