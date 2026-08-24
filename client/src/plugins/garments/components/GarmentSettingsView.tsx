import { Columns3, LayoutList } from 'lucide-react';
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
  getInitialGarmentColumnCount,
  resolveGarmentColumnCount,
  GARMENTS_COLUMN_COUNT_STORAGE_KEY,
  GARMENTS_SETTINGS_KEY,
  type GarmentColumnCount,
} from '../utils/garmentColumnCount';
import {
  getInitialGarmentListViewMode,
  persistGarmentListViewModeSession,
  resolveGarmentListViewMode,
  GARMENTS_LIST_VIEW_MODE_STORAGE_KEY,
  type GarmentListViewMode,
} from '../utils/garmentListViewMode';

const VIEW_MODE_OPTIONS: GarmentListViewMode[] = ['cards', 'table'];
const COLUMN_OPTIONS: GarmentColumnCount[] = [1, 2, 3];

interface GarmentSettingsViewProps {
  onClose?: () => void;
}

export function GarmentSettingsView({ onClose }: GarmentSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [listViewMode, setListViewMode] = useState<GarmentListViewMode>(
    getInitialGarmentListViewMode,
  );
  const [initialListViewMode, setInitialListViewMode] = useState<GarmentListViewMode>(
    getInitialGarmentListViewMode,
  );
  const [columnCount, setColumnCount] = useState<GarmentColumnCount>(getInitialGarmentColumnCount);
  const [initialColumnCount, setInitialColumnCount] = useState<GarmentColumnCount>(
    getInitialGarmentColumnCount,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(GARMENTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loadedView = resolveGarmentListViewMode(settings);
        const loadedColumns = resolveGarmentColumnCount(settings);
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
      await updateSettings(GARMENTS_SETTINGS_KEY, { listViewMode, columnCount });
      setInitialListViewMode(listViewMode);
      setInitialColumnCount(columnCount);
      persistGarmentListViewModeSession(listViewMode);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(GARMENTS_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
        window.sessionStorage.setItem(GARMENTS_LIST_VIEW_MODE_STORAGE_KEY, listViewMode);
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
      title={t('garments.settingsTitle')}
      subtitle={t('garments.settingsSubtitle')}
      onClose={onClose}
      onSave={hasChanges ? () => void handleSave() : undefined}
      isSaving={isSaving}
      saveAction={
        hasChanges ? (
          <SettingsHeaderSaveButton onClick={() => void handleSave()} isSaving={isSaving} />
        ) : null
      }
    >
      <DetailSection
        title={t('common.defaultListView')}
        icon={LayoutList}
        subtleTitle
        className="pt-0"
      >
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
        <DetailSection title={t('garments.defaultColumns')} icon={Columns3} subtleTitle>
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
          <p className="mt-2 text-sm text-muted-foreground">{t('garments.defaultColumnsHelp')}</p>
        </DetailSection>
      ) : null}
    </PluginSettingsPageShell>
  );
}
