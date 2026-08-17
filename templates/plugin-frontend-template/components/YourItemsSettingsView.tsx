import React, { useEffect, useState } from 'react';
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
  getInitialYourItemColumnCount,
  resolveYourItemColumnCount,
  YOUR_ITEMS_COLUMN_COUNT_STORAGE_KEY,
  YOUR_ITEMS_SETTINGS_KEY,
  type YourItemColumnCount,
} from '../utils/yourItemColumnCount';
import {
  getInitialYourItemListViewMode,
  persistYourItemListViewModeSession,
  resolveYourItemListViewMode,
  YOUR_ITEMS_LIST_VIEW_MODE_STORAGE_KEY,
  type YourItemListViewMode,
} from '../utils/yourItemListViewMode';

const VIEW_MODE_OPTIONS: YourItemListViewMode[] = ['cards', 'table'];
const COLUMN_OPTIONS: YourItemColumnCount[] = [1, 2, 3];

interface YourItemsSettingsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function YourItemsSettingsView({ inlineTrailing }: YourItemsSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [listViewMode, setListViewMode] = useState<YourItemListViewMode>(
    getInitialYourItemListViewMode,
  );
  const [initialListViewMode, setInitialListViewMode] = useState<YourItemListViewMode>(
    getInitialYourItemListViewMode,
  );
  const [columnCount, setColumnCount] = useState<YourItemColumnCount>(
    getInitialYourItemColumnCount,
  );
  const [initialColumnCount, setInitialColumnCount] = useState<YourItemColumnCount>(
    getInitialYourItemColumnCount,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(YOUR_ITEMS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loadedView = resolveYourItemListViewMode(settings);
        const loadedColumns = resolveYourItemColumnCount(settings);
        setListViewMode(loadedView);
        setInitialListViewMode(loadedView);
        setColumnCount(loadedColumns);
        setInitialColumnCount(loadedColumns);
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

  const hasChanges = listViewMode !== initialListViewMode || columnCount !== initialColumnCount;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(YOUR_ITEMS_SETTINGS_KEY, { listViewMode, columnCount });
      setInitialListViewMode(listViewMode);
      setInitialColumnCount(columnCount);
      persistYourItemListViewModeSession(listViewMode);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(YOUR_ITEMS_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
        window.sessionStorage.setItem(YOUR_ITEMS_LIST_VIEW_MODE_STORAGE_KEY, listViewMode);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <PluginSettingsPageShell
      title="Plugin settings"
      subtitle="Choose defaults for this plugin."
      trailing={inlineTrailing}
      saveAction={
        hasChanges ? (
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
                  'h-9 rounded-lg px-3 text-xs font-medium',
                  isActive
                    ? 'border border-primary bg-primary/10 text-primary'
                    : 'border-transparent bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
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
        <DetailSection title="Default columns">
          <div className="flex flex-wrap items-center gap-2">
            {COLUMN_OPTIONS.map((count) => {
              const isActive = columnCount === count;
              return (
                <Button
                  key={count}
                  variant="ghost"
                  onClick={() => setColumnCount(count)}
                  className={cn(
                    'h-9 min-w-9 rounded-lg px-3 text-xs font-medium',
                    isActive
                      ? 'border border-primary bg-primary/10 text-primary'
                      : 'border-transparent bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                  aria-pressed={isActive}
                >
                  {count}
                </Button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            How many columns cards use by default (1 = full width, 2 = half, 3 = one third).
          </p>
        </DetailSection>
      ) : null}
    </PluginSettingsPageShell>
  );
}
