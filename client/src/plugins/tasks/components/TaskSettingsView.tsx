// Tasks settings as full-page content (like Core Settings / Notes): tab row + card + footer.

import { Check, Download, LayoutGrid, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { ImportWizard } from '@/core/ui/ImportWizard';
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

interface TaskSettingsCategoryDef {
  id: TaskSettingsCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const getTaskSettingsCategories = (t: (key: string) => string): TaskSettingsCategoryDef[] => [
  { id: 'view', label: 'View', icon: LayoutGrid },
  { id: 'import', label: t('common.import'), icon: Upload },
];

const COLUMN_OPTIONS: TaskColumnCount[] = [1, 2, 3];

interface TaskSettingsViewProps {
  selectedCategory?: TaskSettingsCategory;
  onSelectedCategoryChange?: (category: TaskSettingsCategory) => void;
  renderCategoryButtonsInline?: boolean;
  inlineTrailing?: React.ReactNode;
}

export function TaskSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  renderCategoryButtonsInline = false,
  inlineTrailing,
}: TaskSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { setHeaderTrailing } = useContentLayout();
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

  const categoryButtons = useMemo(
    () => (
      <div className="flex items-center gap-1">
        {getTaskSettingsCategories(t).map((category) => {
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

  const settingsTitle = t('tasks.settingsTasks');

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
      </Card>

      <ImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        onImport={importTasks}
        schema={getTaskImportSchema()}
        title={t('common.import')}
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
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
