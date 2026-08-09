// Estimates settings as full-page content matching Core Settings layout.

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
} from '@/core/ui/PluginSettingsPageShell';
import { cn } from '@/lib/utils';

import {
  ESTIMATES_COLUMN_COUNT_STORAGE_KEY,
  ESTIMATES_SETTINGS_KEY,
  resolveEstimateColumnCount,
  type EstimateColumnCount,
} from '../utils/estimateColumnCount';
import {
  ESTIMATES_LIST_VIEW_MODE_STORAGE_KEY,
  persistEstimateListViewModeSession,
  resolveEstimateListViewMode,
  type EstimateListViewMode,
} from '../utils/estimateListViewMode';

interface EstimateSettingsViewProps {
  inlineTrailing?: React.ReactNode;
}

const COLUMN_OPTIONS: EstimateColumnCount[] = [1, 2, 3];
const VIEW_MODE_OPTIONS: EstimateListViewMode[] = ['cards', 'table'];

export function EstimateSettingsView({ inlineTrailing }: EstimateSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings } = useApp();

  const [columnCount, setColumnCount] = useState<EstimateColumnCount>(1);
  const [initialColumnCount, setInitialColumnCount] = useState<EstimateColumnCount>(1);
  const [listViewMode, setListViewMode] = useState<EstimateListViewMode>('cards');
  const [initialListViewMode, setInitialListViewMode] = useState<EstimateListViewMode>('cards');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(ESTIMATES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loadedColumns = resolveEstimateColumnCount(settings);
        setColumnCount(loadedColumns);
        setInitialColumnCount(loadedColumns);
        const loadedView = resolveEstimateListViewMode(settings);
        setListViewMode(loadedView);
        setInitialListViewMode(loadedView);
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

  const isDirty = columnCount !== initialColumnCount || listViewMode !== initialListViewMode;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings(ESTIMATES_SETTINGS_KEY, { columnCount, listViewMode });
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(ESTIMATES_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
        window.sessionStorage.setItem(ESTIMATES_LIST_VIEW_MODE_STORAGE_KEY, listViewMode);
      }
      persistEstimateListViewModeSession(listViewMode);
      setInitialColumnCount(columnCount);
      setInitialListViewMode(listViewMode);
    } catch (error) {
      console.error('Failed to save estimates settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [columnCount, listViewMode, updateSettings]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <PluginSettingsPageShell
      title={t('estimates.settingsTitle')}
      subtitle={t('estimates.settingsSubtitle')}
      trailing={inlineTrailing}
      saveAction={
        isDirty ? (
          <SettingsHeaderSaveButton onClick={() => void handleSave()} isSaving={isSaving} />
        ) : null
      }
    >
      <DetailSection title={t('common.defaultListView')} className="pt-0">
        <div className="flex flex-wrap items-center gap-2">
          {VIEW_MODE_OPTIONS.map((mode) => {
            const isActive = listViewMode === mode;
            return (
              <Button
                key={mode}
                variant="ghost"
                onClick={() => setListViewMode(mode)}
                className={cn(
                  'h-9 text-xs px-3 rounded-lg font-medium',
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                )}
                aria-label={mode === 'cards' ? t('common.cardsView') : t('common.tableView')}
                aria-pressed={isActive}
              >
                {mode === 'cards' ? t('common.cardsView') : t('common.tableView')}
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t('common.listViewHelp')}</p>
      </DetailSection>
      {listViewMode === 'cards' ? (
        <DetailSection title={t('estimates.defaultColumns')}>
          <div className="flex flex-wrap items-center gap-2">
            {COLUMN_OPTIONS.map((count) => {
              const isActive = columnCount === count;
              return (
                <Button
                  key={count}
                  variant="ghost"
                  onClick={() => setColumnCount(count)}
                  className={cn(
                    'h-9 min-w-9 text-xs px-3 rounded-lg font-medium',
                    isActive
                      ? 'bg-primary/10 text-primary border border-primary'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                  )}
                  aria-label={t(`estimates.columns${count}`)}
                  aria-pressed={isActive}
                >
                  {count}
                </Button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t('estimates.columnsHelp')}</p>
        </DetailSection>
      ) : null}
    </PluginSettingsPageShell>
  );
}
