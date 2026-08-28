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

import { matchesApi } from '../api/matchesApi';
import { MATCHES_SETTINGS_KEY } from '../utils/matchColumnCount';
import { resolveMatchDefaultHomeTeam } from '../utils/matchDefaultHomeTeam';

const DEFAULT_API_BASE_URL = 'https://forening-api.svenskfotboll.se';
const MASKED_API_KEY = '••••••••';

export type MatchSettingsCategory = 'api';

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

  const [internalCategory, setInternalCategory] = useState<MatchSettingsCategory>('api');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

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
        id: 'api',
        label: t('matches.apiSettings'),
        description: t('matches.settingsCategories.apiDescription'),
        icon: SETTINGS_CATEGORY_ICONS.api,
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
        const loadedDefaultHomeTeam = resolveMatchDefaultHomeTeam(settings);
        const loadedBaseUrl =
          typeof settings?.apiBaseUrl === 'string' && settings.apiBaseUrl.trim()
            ? settings.apiBaseUrl.trim()
            : DEFAULT_API_BASE_URL;
        const storedKey = typeof settings?.apiKey === 'string' && settings.apiKey.trim();
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

  const isApiDirty =
    apiBaseUrl.trim() !== initialApiBaseUrl.trim() ||
    (apiKey.trim() !== '' && !apiKey.startsWith('••••')) ||
    defaultHomeTeam.trim() !== initialDefaultHomeTeam.trim();
  const isDirty = isApiDirty;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setImportError(null);
    try {
      const payload: Record<string, string> = {
        apiBaseUrl: apiBaseUrl.trim() || DEFAULT_API_BASE_URL,
        defaultHomeTeam: defaultHomeTeam.trim(),
      };
      if (apiKey.trim() && !apiKey.startsWith('••••')) {
        payload.apiKey = apiKey.trim();
      }
      await updateSettings(MATCHES_SETTINGS_KEY, payload);
      setInitialApiBaseUrl(payload.apiBaseUrl);
      setInitialDefaultHomeTeam(payload.defaultHomeTeam);
      if (payload.apiKey) {
        setHasStoredApiKey(true);
        setApiKey(MASKED_API_KEY);
      }
    } catch (error) {
      console.error('Failed to save matches settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [apiBaseUrl, apiKey, defaultHomeTeam, updateSettings]);

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
      {activeCategory === 'api' && (
        <DetailSection title={t('matches.apiSettings')} className="pt-0">
          <div className="space-y-4">
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
