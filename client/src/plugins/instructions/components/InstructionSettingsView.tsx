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

import type { InstructionSettingsTab } from '../context/InstructionContext';
import { useInstructions } from '../hooks/useInstructions';
import {
  getInitialInstructionColumnCount,
  INSTRUCTIONS_COLUMN_COUNT_STORAGE_KEY,
  INSTRUCTIONS_SETTINGS_KEY,
  resolveInstructionColumnCount,
  type InstructionColumnCount,
} from '../utils/instructionColumnCount';
import {
  getInitialInstructionListViewMode,
  INSTRUCTIONS_LIST_VIEW_MODE_STORAGE_KEY,
  persistInstructionListViewModeSession,
  resolveInstructionListViewMode,
  type InstructionListViewMode,
} from '../utils/instructionListViewMode';

const COLUMN_OPTIONS: InstructionColumnCount[] = [1, 2, 3];
const VIEW_MODE_OPTIONS: InstructionListViewMode[] = ['cards', 'table'];

interface InstructionSettingsViewProps {
  selectedTab?: InstructionSettingsTab;
  onSelectedTabChange?: (tab: InstructionSettingsTab) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderTabButtonsInline?: boolean;
  onClose?: () => void;
}

export function InstructionSettingsView({
  selectedTab,
  onSelectedTabChange,
  onClose,
}: InstructionSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings } = useApp();
  const { instructionsSettingsTab } = useInstructions();

  const [internalTab, setInternalTab] = useState<InstructionSettingsTab>('view');
  const activeTab = selectedTab ?? internalTab;
  const setActiveTab = onSelectedTabChange ?? setInternalTab;

  const [columnCount, setColumnCount] = useState<InstructionColumnCount>(
    getInitialInstructionColumnCount,
  );
  const [initialColumnCount, setInitialColumnCount] = useState<InstructionColumnCount>(
    getInitialInstructionColumnCount,
  );
  const [listViewMode, setListViewMode] = useState<InstructionListViewMode>(
    getInitialInstructionListViewMode,
  );
  const [initialListViewMode, setInitialListViewMode] = useState<InstructionListViewMode>(
    getInitialInstructionListViewMode,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shellCategories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'view',
        label: t('instructions.settings.tabs.view'),
        description: t('instructions.settings.tabs.viewDescription'),
        icon: SETTINGS_CATEGORY_ICONS.view,
        dotClassName: 'bg-blue-500',
      },
    ],
    [t],
  );

  useEffect(() => {
    setActiveTab(instructionsSettingsTab);
  }, [instructionsSettingsTab, setActiveTab]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getSettings(INSTRUCTIONS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) return;
        const next = resolveInstructionColumnCount(settings);
        setColumnCount(next);
        setInitialColumnCount(next);
        const nextView = resolveInstructionListViewMode(settings);
        setListViewMode(nextView);
        setInitialListViewMode(nextView);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage(t('instructions.settings.loadFailed'));
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
      await updateSettings(INSTRUCTIONS_SETTINGS_KEY, { columnCount, listViewMode });
      setInitialColumnCount(columnCount);
      setInitialListViewMode(listViewMode);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(INSTRUCTIONS_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
        window.sessionStorage.setItem(INSTRUCTIONS_LIST_VIEW_MODE_STORAGE_KEY, listViewMode);
      }
      persistInstructionListViewModeSession(listViewMode);
    } catch (error: unknown) {
      const err = error as { message?: string; error?: string };
      setErrorMessage(err?.message || err?.error || t('instructions.settings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [columnCount, listViewMode, t, updateSettings]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <PluginSettingsPageShell
      title={t('instructions.settings.title')}
      subtitle={t('instructions.settingsSubtitle')}
      categories={shellCategories}
      activeCategory={activeTab}
      onCategoryChange={(id) => setActiveTab(id as InstructionSettingsTab)}
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
            <DetailSection title={t('instructions.settings.defaultColumns')}>
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
                      aria-label={t(`instructions.columns${count}`)}
                      aria-pressed={isActive}
                    >
                      <span>{count}</span>
                    </Button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('instructions.settings.columnsHelp')}
              </p>
            </DetailSection>
          ) : null}
        </>
      )}
    </PluginSettingsPageShell>
  );
}
