import { CloudDownload } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailSection } from '@/core/ui/DetailSection';

import { matchesApi } from '../api/matchesApi';

export type MatchViewMode = 'grid' | 'list';

export interface MatchSettingsFormProps {
  onCancel: () => void;
}

const MATCHES_SETTINGS_KEY = 'matches';
const DEFAULT_API_BASE_URL = 'https://forening-api.svenskfotboll.se';
const MASKED_API_KEY = '••••••••';

export const MatchSettingsForm = React.forwardRef<PanelFormHandle, MatchSettingsFormProps>(
  function MatchSettingsForm({ onCancel }, ref) {
    const { t } = useTranslation();
    const { getSettings, updateSettings } = useApp();
    const [viewMode, setViewMode] = useState<MatchViewMode>('list');
    const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
    const [apiKey, setApiKey] = useState('');
    const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const [importError, setImportError] = useState<string | null>(null);

    useEffect(() => {
      const load = async () => {
        setIsLoading(true);
        try {
          const settings = await getSettings(MATCHES_SETTINGS_KEY);
          if (settings?.viewMode === 'list') {
            setViewMode('list');
          } else if (settings?.viewMode === 'grid') {
            setViewMode('grid');
          }
          const loadedBaseUrl =
            typeof settings?.apiBaseUrl === 'string' && settings.apiBaseUrl.trim()
              ? settings.apiBaseUrl.trim()
              : DEFAULT_API_BASE_URL;
          const storedKey = typeof settings?.apiKey === 'string' && settings.apiKey.trim();
          setApiBaseUrl(loadedBaseUrl);
          setHasStoredApiKey(Boolean(storedKey));
          setApiKey(storedKey ? MASKED_API_KEY : '');
        } catch (error) {
          console.error('Failed to load matches settings:', error);
        } finally {
          setIsLoading(false);
        }
      };
      void load();
    }, [getSettings]);

    const handleSave = useCallback(async () => {
      try {
        const payload: Record<string, string> = {
          viewMode,
          apiBaseUrl: apiBaseUrl.trim() || DEFAULT_API_BASE_URL,
        };
        if (apiKey.trim() && !apiKey.startsWith('••••')) {
          payload.apiKey = apiKey.trim();
        }
        await updateSettings(MATCHES_SETTINGS_KEY, payload);
        if (payload.apiKey) {
          setHasStoredApiKey(true);
          setApiKey(MASKED_API_KEY);
        }
        onCancel();
      } catch (error) {
        console.error('Failed to save matches settings:', error);
      }
    }, [apiBaseUrl, apiKey, onCancel, updateSettings, viewMode]);

    const handleImport = useCallback(async () => {
      setIsImporting(true);
      setImportMessage(null);
      setImportError(null);
      try {
        const result = await matchesApi.importMatches();
        setImportMessage(
          t('matches.importDone', { imported: result.imported, updated: result.updated }),
        );
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

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSave(),
        cancel: onCancel,
      }),
      [handleSave, onCancel],
    );

    if (isLoading) {
      return <div className="p-6 text-sm text-muted-foreground">{t('matches.loading')}</div>;
    }

    return (
      <div className="space-y-6">
        <DetailSection
          title={
            <div className="flex items-center gap-2">
              <CloudDownload className="w-3.5 h-3.5" />
              <span>{t('matches.apiSettings')}</span>
            </div>
          }
        >
          <DetailCard className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="panel-matches-api-base-url">{t('matches.apiBaseUrl')}</Label>
              <Input
                id="panel-matches-api-base-url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder={DEFAULT_API_BASE_URL}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="panel-matches-api-key">{t('matches.apiKey')}</Label>
              <Input
                id="panel-matches-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasStoredApiKey ? MASKED_API_KEY : t('matches.apiKeyPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('matches.apiKeyHint')}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={CloudDownload}
              disabled={isImporting || !hasStoredApiKey}
              className="gap-1.5"
              onClick={() => void handleImport()}
            >
              {isImporting ? t('matches.importing') : t('matches.importNow')}
            </Button>
            {importMessage ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">{importMessage}</p>
            ) : null}
            {importError ? <p className="text-sm text-destructive">{importError}</p> : null}
          </DetailCard>
        </DetailSection>
      </div>
    );
  },
);
