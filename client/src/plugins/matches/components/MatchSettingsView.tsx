// Matches settings as full-page content matching Core Settings layout.

import { CloudDownload } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { cn } from '@/lib/utils';

import { matchesApi } from '../api/matchesApi';
import {
  MATCHES_COLUMN_COUNT_STORAGE_KEY,
  MATCHES_SETTINGS_KEY,
  resolveMatchColumnCount,
  type MatchColumnCount,
} from '../utils/matchColumnCount';
import { resolveMatchDefaultHomeTeam } from '../utils/matchDefaultHomeTeam';
import {
  MATCHES_LIST_VIEW_MODE_STORAGE_KEY,
  persistMatchListViewModeSession,
  resolveMatchListViewMode,
  type MatchListViewMode,
} from '../utils/matchListViewMode';

const DEFAULT_API_BASE_URL = 'https://forening-api.svenskfotboll.se';
const MASKED_API_KEY = '••••••••';

const COLUMN_OPTIONS: MatchColumnCount[] = [1, 2, 3];
const VIEW_MODE_OPTIONS: MatchListViewMode[] = ['cards', 'table'];

export type MatchSettingsCategory = 'view' | 'api';

interface MatchSettingsViewProps {
  selectedCategory?: MatchSettingsCategory;
  onSelectedCategoryChange?: (category: MatchSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
}

export function MatchSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: MatchSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings } = useApp();

  const [internalCategory, setInternalCategory] = useState<MatchSettingsCategory>('view');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [columnCount, setColumnCount] = useState<MatchColumnCount>(1);
  const [initialColumnCount, setInitialColumnCount] = useState<MatchColumnCount>(1);
  const [listViewMode, setListViewMode] = useState<MatchListViewMode>('cards');
  const [initialListViewMode, setInitialListViewMode] = useState<MatchListViewMode>('cards');
  const [defaultHomeTeam, setDefaultHomeTeam] = useState('');
  const [initialDefaultHomeTeam, setInitialDefaultHomeTeam] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [initialApiBaseUrl, setInitialApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [apiKey, setApiKey] = useState('');
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'view',
        label: t('matches.settingsCategories.view'),
        description: t('matches.settingsCategories.viewDescription'),
        icon: SETTINGS_CATEGORY_ICONS.view,
        dotClassName: 'bg-blue-500',
      },
      {
        id: 'api',
        label: t('matches.apiSettings'),
        description: t('matches.settingsCategories.apiDescription'),
        icon: SETTINGS_CATEGORY_ICONS.api,
        dotClassName: 'bg-violet-500',
      },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(MATCHES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loadedColumns = resolveMatchColumnCount(settings);
        const loadedView = resolveMatchListViewMode(settings);
        const loadedDefaultHomeTeam = resolveMatchDefaultHomeTeam(settings);
        const loadedBaseUrl =
          typeof settings?.apiBaseUrl === 'string' && settings.apiBaseUrl.trim()
            ? settings.apiBaseUrl.trim()
            : DEFAULT_API_BASE_URL;
        const storedKey = typeof settings?.apiKey === 'string' && settings.apiKey.trim();
        setColumnCount(loadedColumns);
        setInitialColumnCount(loadedColumns);
        setListViewMode(loadedView);
        setInitialListViewMode(loadedView);
        setDefaultHomeTeam(loadedDefaultHomeTeam);
        setInitialDefaultHomeTeam(loadedDefaultHomeTeam);
        setApiBaseUrl(loadedBaseUrl);
        setInitialApiBaseUrl(loadedBaseUrl);
        setHasStoredApiKey(Boolean(storedKey));
        setApiKey(storedKey ? MASKED_API_KEY : '');
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

  const isViewDirty =
    columnCount !== initialColumnCount ||
    listViewMode !== initialListViewMode ||
    defaultHomeTeam.trim() !== initialDefaultHomeTeam.trim();
  const isApiDirty =
    apiBaseUrl.trim() !== initialApiBaseUrl.trim() ||
    (apiKey.trim() !== '' && !apiKey.startsWith('••••'));
  const isDirty = activeCategory === 'view' ? isViewDirty : isApiDirty;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setImportError(null);
    try {
      if (activeCategory === 'view') {
        const trimmedDefaultHomeTeam = defaultHomeTeam.trim();
        await updateSettings(MATCHES_SETTINGS_KEY, {
          columnCount,
          listViewMode,
          defaultHomeTeam: trimmedDefaultHomeTeam,
        });
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(MATCHES_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
          window.sessionStorage.setItem(MATCHES_LIST_VIEW_MODE_STORAGE_KEY, listViewMode);
        }
        persistMatchListViewModeSession(listViewMode);
        setInitialColumnCount(columnCount);
        setInitialListViewMode(listViewMode);
        setDefaultHomeTeam(trimmedDefaultHomeTeam);
        setInitialDefaultHomeTeam(trimmedDefaultHomeTeam);
      } else {
        const payload: Record<string, string> = {
          apiBaseUrl: apiBaseUrl.trim() || DEFAULT_API_BASE_URL,
        };
        if (apiKey.trim() && !apiKey.startsWith('••••')) {
          payload.apiKey = apiKey.trim();
        }
        await updateSettings(MATCHES_SETTINGS_KEY, payload);
        setInitialApiBaseUrl(payload.apiBaseUrl);
        if (payload.apiKey) {
          setHasStoredApiKey(true);
          setApiKey(MASKED_API_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to save matches settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    activeCategory,
    apiBaseUrl,
    apiKey,
    columnCount,
    defaultHomeTeam,
    listViewMode,
    updateSettings,
  ]);

  const handleImport = useCallback(async () => {
    setIsImporting(true);
    setImportMessage(null);
    setImportError(null);
    try {
      const result = await matchesApi.importMatches();
      const summary = t('matches.importDone', {
        imported: result.imported,
        updated: result.updated,
      });
      setImportMessage(summary);
      if (result.errors?.length) {
        setImportError(result.errors.join(' '));
      }
    } catch (error) {
      console.error('Failed to import matches:', error);
      setImportError(t('matches.importError'));
    } finally {
      setIsImporting(false);
    }
  }, [t]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('matches.loading')}</div>;
  }

  return (
    <PluginSettingsPageShell
      title={t('matches.settingsMatches')}
      subtitle={t('matches.settingsSubtitle')}
      categories={categories}
      activeCategory={activeCategory}
      onCategoryChange={(id) => setActiveCategory(id as MatchSettingsCategory)}
      onClose={onClose}
      onSave={isDirty ? () => void handleSave() : undefined}
      isSaving={isSaving}
      saveAction={
        isDirty ? (
          <SettingsHeaderSaveButton
            onClick={() => void handleSave()}
            isSaving={isSaving}
            label={t('matches.save')}
            savingLabel={t('matches.saving')}
          />
        ) : null
      }
    >
      {activeCategory === 'view' && (
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
            <DetailSection title={t('matches.defaultColumns')}>
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
                      aria-label={t(`matches.columns${count}`)}
                      aria-pressed={isActive}
                    >
                      {count}
                    </Button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t('matches.columnsHelp')}</p>
            </DetailSection>
          ) : null}
          <DetailSection title={t('matches.defaultHomeTeam')}>
            <div className="space-y-2">
              <Label htmlFor="matches-default-home-team">{t('matches.defaultHomeTeamLabel')}</Label>
              <Input
                id="matches-default-home-team"
                value={defaultHomeTeam}
                onChange={(e) => setDefaultHomeTeam(e.target.value)}
                placeholder={t('matches.defaultHomeTeamPlaceholder')}
                maxLength={255}
              />
              <p className="text-sm text-muted-foreground">{t('matches.defaultHomeTeamHelp')}</p>
            </div>
          </DetailSection>
        </>
      )}

      {activeCategory === 'api' && (
        <DetailSection title={t('matches.apiSettings')} className="pt-0">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="matches-api-base-url">{t('matches.apiBaseUrl')}</Label>
              <Input
                id="matches-api-base-url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder={DEFAULT_API_BASE_URL}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matches-api-key">{t('matches.apiKey')}</Label>
              <Input
                id="matches-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasStoredApiKey ? MASKED_API_KEY : t('matches.apiKeyPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('matches.apiKeyHint')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={CloudDownload}
                disabled={isImporting || !hasStoredApiKey}
                onClick={() => void handleImport()}
              >
                {isImporting ? t('matches.importing') : t('matches.importNow')}
              </Button>
            </div>
            {importMessage ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">{importMessage}</p>
            ) : null}
            {importError ? <p className="text-sm text-destructive">{importError}</p> : null}
          </div>
        </DetailSection>
      )}
    </PluginSettingsPageShell>
  );
}
