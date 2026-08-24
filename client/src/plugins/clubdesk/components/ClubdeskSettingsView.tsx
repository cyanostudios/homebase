import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { cn } from '@/lib/utils';

import type { ClubdeskSettingsTab } from '../context/ClubdeskContext';
import { useClubdesk } from '../hooks/useClubdesk';
import {
  getInitialClubdeskColumnCount,
  CLUBDESK_COLUMN_COUNT_STORAGE_KEY,
  CLUBDESK_SETTINGS_KEY,
  resolveClubdeskColumnCount,
  type ClubdeskColumnCount,
} from '../utils/clubdeskColumnCount';
import {
  getInitialClubdeskListViewMode,
  CLUBDESK_LIST_VIEW_MODE_STORAGE_KEY,
  persistClubdeskListViewModeSession,
  resolveClubdeskListViewMode,
  type ClubdeskListViewMode,
} from '../utils/clubdeskListViewMode';

const COLUMN_OPTIONS: ClubdeskColumnCount[] = [1, 2, 3];
const VIEW_MODE_OPTIONS: ClubdeskListViewMode[] = ['cards', 'table'];

interface ClubdeskSettingsViewProps {
  selectedTab?: ClubdeskSettingsTab;
  onSelectedTabChange?: (tab: ClubdeskSettingsTab) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderTabButtonsInline?: boolean;
  onClose?: () => void;
}

export function ClubdeskSettingsView({
  selectedTab,
  onSelectedTabChange,
  onClose,
}: ClubdeskSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings } = useApp();
  const { clubdeskSettingsTab } = useClubdesk();

  const [internalTab, setInternalTab] = useState<ClubdeskSettingsTab>('view');
  const activeTab = selectedTab ?? internalTab;
  const setActiveTab = onSelectedTabChange ?? setInternalTab;

  const [columnCount, setColumnCount] = useState<ClubdeskColumnCount>(
    getInitialClubdeskColumnCount,
  );
  const [initialColumnCount, setInitialColumnCount] = useState<ClubdeskColumnCount>(
    getInitialClubdeskColumnCount,
  );
  const [listViewMode, setListViewMode] = useState<ClubdeskListViewMode>(
    getInitialClubdeskListViewMode,
  );
  const [initialListViewMode, setInitialListViewMode] = useState<ClubdeskListViewMode>(
    getInitialClubdeskListViewMode,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shellCategories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'view',
        label: t('clubdesk.settings.tabs.view'),
        description: t('clubdesk.settings.tabs.viewDescription'),
        icon: SETTINGS_CATEGORY_ICONS.view,
        dotClassName: 'bg-blue-500',
      },
    ],
    [t],
  );

  useEffect(() => {
    setActiveTab(clubdeskSettingsTab);
  }, [clubdeskSettingsTab, setActiveTab]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getSettings(CLUBDESK_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) return;
        const next = resolveClubdeskColumnCount(settings);
        setColumnCount(next);
        setInitialColumnCount(next);
        const nextView = resolveClubdeskListViewMode(settings);
        setListViewMode(nextView);
        setInitialListViewMode(nextView);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage(t('clubdesk.settings.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, t]);

  const isDirty = columnCount !== initialColumnCount || listViewMode !== initialListViewMode;

  const save = useCallback(async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await updateSettings(CLUBDESK_SETTINGS_KEY, { columnCount, listViewMode });
      setInitialColumnCount(columnCount);
      setInitialListViewMode(listViewMode);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CLUBDESK_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
        window.sessionStorage.setItem(CLUBDESK_LIST_VIEW_MODE_STORAGE_KEY, listViewMode);
      }
      persistClubdeskListViewModeSession(listViewMode);
    } catch (error: unknown) {
      const err = error as { message?: string; error?: string };
      setErrorMessage(err?.message || err?.error || t('clubdesk.settings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [columnCount, listViewMode, t, updateSettings]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <PluginSettingsPageShell
      title={t('clubdesk.settings.title')}
      subtitle={t('clubdesk.settingsSubtitle')}
      categories={shellCategories}
      activeCategory={activeTab}
      onCategoryChange={(id) => setActiveTab(id as ClubdeskSettingsTab)}
      onClose={onClose}
      onSave={isDirty ? () => void save() : undefined}
      isSaving={isSaving}
      saveAction={
        isDirty ? (
          <SettingsHeaderSaveButton onClick={() => void save()} isSaving={isSaving} />
        ) : null
      }
    >
      {errorMessage ? <p className="mb-4 text-sm text-destructive">{errorMessage}</p> : null}

      {activeTab === 'view' && (
        <>
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
            <DetailSection title={t('clubdesk.settings.defaultColumns')}>
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
                      aria-label={t(`clubdesk.columns${count}`)}
                      aria-pressed={isActive}
                    >
                      <span>{count}</span>
                    </Button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('clubdesk.settings.columnsHelp')}
              </p>
            </DetailSection>
          ) : null}
        </>
      )}
    </PluginSettingsPageShell>
  );
}
