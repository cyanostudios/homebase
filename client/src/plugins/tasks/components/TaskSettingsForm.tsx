import { Check, Eye, LayoutGrid, List } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';

export type TaskViewMode = 'grid' | 'list';

export interface TaskSettingsFormProps {
  onCancel: () => void;
}

const TASKS_SETTINGS_KEY = 'tasks';

export const TaskSettingsForm = React.forwardRef<PanelFormHandle, TaskSettingsFormProps>(
  function TaskSettingsForm({ onCancel }, ref) {
    const { t } = useTranslation();
    const { getSettings, updateSettings } = useApp();
    const [viewMode, setViewMode] = useState<TaskViewMode>('grid');
    const [initialViewMode, setInitialViewMode] = useState<TaskViewMode>('grid');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      const load = async () => {
        setIsLoading(true);
        try {
          const settings = await getSettings(TASKS_SETTINGS_KEY);
          const loaded = settings?.viewMode === 'list' ? 'list' : 'grid';
          setViewMode(loaded);
          setInitialViewMode(loaded);
        } catch (error) {
          console.error('Failed to load tasks settings:', error);
        } finally {
          setIsLoading(false);
        }
      };
      load();
    }, [getSettings]);

    const isDirty = viewMode !== initialViewMode;

    const handleSave = useCallback(async () => {
      setIsSaving(true);
      try {
        await updateSettings(TASKS_SETTINGS_KEY, { viewMode });
        setInitialViewMode(viewMode);
        onCancel();
      } catch (error) {
        console.error('Failed to save tasks settings:', error);
      } finally {
        setIsSaving(false);
      }
    }, [viewMode, updateSettings, onCancel]);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSave(),
        cancel: onCancel,
      }),
      [handleSave, onCancel],
    );

    if (isLoading) {
      return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
    }

    return (
      <div className="space-y-6">
        <DetailSection
          title={
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              <span>Default view</span>
            </div>
          }
        >
          <DetailCard className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">View mode</Label>
                <p className="text-[11px] text-gray-500">How your tasks are displayed by default</p>
              </div>
              <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-100 dark:border-gray-700">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  className={
                    viewMode === 'grid'
                      ? 'h-8 px-3 text-[10px] uppercase font-bold tracking-tight'
                      : 'h-8 px-3 text-[10px] uppercase font-bold tracking-tight text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                  }
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className={
                    viewMode === 'list'
                      ? 'h-8 px-3 text-[10px] uppercase font-bold tracking-tight'
                      : 'h-8 px-3 text-[10px] uppercase font-bold tracking-tight text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                  }
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-3.5 h-3.5" />
                  List
                </Button>
              </div>
            </div>
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
