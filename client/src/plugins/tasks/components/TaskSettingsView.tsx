// Tasks settings as full-page content (like Core Settings / Notes): tab row + card + footer.

import { Check, LayoutGrid, List, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { ImportWizard } from '@/core/ui/ImportWizard';
import type { ImportSchema } from '@/core/utils/importUtils';
import { cn } from '@/lib/utils';

import { useTasks } from '../hooks/useTasks';

const TASKS_SETTINGS_KEY = 'tasks';

type TaskViewMode = 'grid' | 'list';

const getTaskImportSchema = (): ImportSchema => ({
  fields: [
    { key: 'title', label: 'Title', required: true },
    { key: 'content', label: 'Content', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'priority', label: 'Priority', required: false },
  ],
});

const getTaskSettingsCategories = (t: (key: string) => string) => [
  { id: 'view', label: 'View', icon: LayoutGrid },
  { id: 'import', label: t('common.import'), icon: Upload },
];

export function TaskSettingsView() {
  const { t } = useTranslation();
  const { setHeaderTrailing } = useContentLayout();
  const { getSettings, updateSettings } = useApp();
  const { importTasks } = useTasks();
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('view');
  const [viewMode, setViewMode] = useState<TaskViewMode>('grid');
  const [initialViewMode, setInitialViewMode] = useState<TaskViewMode>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setHeaderTrailing(
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {getTaskSettingsCategories(t).map((category) => {
          const Icon = category.icon;
          const isActive = selectedCategory === category.id;
          return (
            <Button
              key={category.id}
              variant="ghost"
              onClick={() => !isActive && setSelectedCategory(category.id)}
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
      </div>,
    );
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, selectedCategory, t]);

  useEffect(() => {
    let cancelled = false;
    getSettings(TASKS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loaded = settings?.viewMode === 'list' ? 'list' : 'grid';
        setViewMode(loaded);
        setInitialViewMode(loaded);
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

  const isDirty = viewMode !== initialViewMode;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings(TASKS_SETTINGS_KEY, { viewMode });
      setInitialViewMode(viewMode);
    } catch (error) {
      console.error('Failed to save tasks settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [viewMode, updateSettings]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  const viewModes: {
    id: TaskViewMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'grid', label: 'Grid', icon: LayoutGrid },
    { id: 'list', label: 'List', icon: List },
  ];

  return (
    <div className="space-y-4">
      <Card
        padding="md"
        className="overflow-hidden border border-border/60 bg-background/50 shadow-sm"
      >
        {selectedCategory === 'view' && (
          <DetailSection title="Default view" className="pt-0">
            <div className="flex items-center gap-2 flex-wrap">
              {viewModes.map((mode) => {
                const ModeIcon = mode.icon;
                const isActive = viewMode === mode.id;
                return (
                  <Button
                    key={mode.id}
                    variant="ghost"
                    onClick={() => setViewMode(mode.id)}
                    className={cn(
                      'h-9 text-xs px-3 rounded-lg font-medium',
                      'flex items-center gap-1.5',
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                    )}
                  >
                    <ModeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>{mode.label}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Tasks will be displayed in the selected layout by default.
            </p>
          </DetailSection>
        )}
        {selectedCategory === 'import' && (
          <DetailSection title={t('common.import')} className="pt-0">
            <p className="text-sm text-muted-foreground mb-4">
              {t('tasks.importDescription') ||
                'Import tasks from a CSV file. Columns: Title, Content, Status, Priority.'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              icon={Upload}
              onClick={() => setIsImportWizardOpen(true)}
              className="h-9 text-xs px-3"
            >
              {t('common.import')}
            </Button>
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
