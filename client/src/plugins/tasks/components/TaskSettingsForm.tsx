import { Check, Eye } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import {
  resolveTaskColumnCount,
  TASKS_COLUMN_COUNT_STORAGE_KEY,
  TASKS_SETTINGS_KEY,
  type TaskColumnCount,
} from '../utils/taskColumnCount';
import {
  persistTaskListViewModeSession,
  resolveTaskListViewMode,
  TASKS_LIST_VIEW_MODE_STORAGE_KEY,
  type TaskListViewMode,
} from '../utils/taskListViewMode';

interface TaskSettingsFormProps {
  onCancel: () => void;
}

const COLUMN_OPTIONS: TaskColumnCount[] = [1, 2, 3];
const VIEW_MODE_OPTIONS: TaskListViewMode[] = ['cards', 'table'];

export const TaskSettingsForm = React.forwardRef<PanelFormHandle, TaskSettingsFormProps>(
  function TaskSettingsForm({ onCancel }, ref) {
    const { t } = useTranslation();
    const { getSettings, updateSettings } = useApp();
    const [columnCount, setColumnCount] = useState<TaskColumnCount>(1);
    const [initialColumnCount, setInitialColumnCount] = useState<TaskColumnCount>(1);
    const [listViewMode, setListViewMode] = useState<TaskListViewMode>('cards');
    const [initialListViewMode, setInitialListViewMode] = useState<TaskListViewMode>('cards');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      const load = async () => {
        setIsLoading(true);
        try {
          const settings = await getSettings(TASKS_SETTINGS_KEY);
          const loaded = resolveTaskColumnCount(settings);
          setColumnCount(loaded);
          setInitialColumnCount(loaded);
          const loadedView = resolveTaskListViewMode(settings);
          setListViewMode(loadedView);
          setInitialListViewMode(loadedView);
        } catch (error) {
          console.error('Failed to load tasks settings:', error);
        } finally {
          setIsLoading(false);
        }
      };
      load();
    }, [getSettings]);

    const isDirty = columnCount !== initialColumnCount || listViewMode !== initialListViewMode;

    const handleSave = useCallback(async () => {
      setIsSaving(true);
      try {
        await updateSettings(TASKS_SETTINGS_KEY, { columnCount, listViewMode });
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(TASKS_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
          window.sessionStorage.setItem(TASKS_LIST_VIEW_MODE_STORAGE_KEY, listViewMode);
        }
        persistTaskListViewModeSession(listViewMode);
        setInitialColumnCount(columnCount);
        setInitialListViewMode(listViewMode);
        onCancel();
      } catch (error) {
        console.error('Failed to save tasks settings:', error);
      } finally {
        setIsSaving(false);
      }
    }, [columnCount, listViewMode, updateSettings, onCancel]);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSave(),
        cancel: onCancel,
      }),
      [handleSave, onCancel],
    );

    if (isLoading) {
      return <div className="p-6 text-sm text-muted-foreground">{t('common.loading')}</div>;
    }

    return (
      <div className="space-y-6">
        <DetailSection
          title={
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              <span>{t('common.defaultListView')}</span>
            </div>
          }
        >
          <DetailCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">{t('common.defaultListView')}</Label>
                <p className="text-[11px] text-gray-500">{t('common.listViewHelp')}</p>
              </div>
              <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-100 dark:border-gray-700">
                {VIEW_MODE_OPTIONS.map((mode) => (
                  <Button
                    key={mode}
                    variant={listViewMode === mode ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      'h-8 px-3 text-[10px] font-bold tracking-tight',
                      listViewMode !== mode &&
                        'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200',
                    )}
                    onClick={() => setListViewMode(mode)}
                    aria-label={mode === 'cards' ? t('common.cardsView') : t('common.tableView')}
                  >
                    {mode === 'cards' ? t('common.cardsView') : t('common.tableView')}
                  </Button>
                ))}
              </div>
            </div>
            {listViewMode === 'cards' ? (
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">{t('tasks.columnsLabel')}</Label>
                  <p className="text-[11px] text-gray-500">{t('tasks.columnsHelp')}</p>
                </div>
                <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-100 dark:border-gray-700">
                  {COLUMN_OPTIONS.map((count) => (
                    <Button
                      key={count}
                      variant={columnCount === count ? 'default' : 'ghost'}
                      size="sm"
                      className={cn(
                        'h-8 min-w-8 px-3 text-[10px] font-bold tracking-tight',
                        columnCount !== count &&
                          'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200',
                      )}
                      onClick={() => setColumnCount(count)}
                      aria-label={t(`tasks.columns${count}`)}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </DetailCard>
        </DetailSection>

        {isDirty && (
          <div className="flex justify-end pt-2">
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
  },
);
