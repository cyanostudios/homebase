// Matches settings as full-page content (like Core Settings): tab row + card + footer.

import { Check, CloudDownload, LayoutGrid, List, Settings2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';
import { matchesApi } from '../api/matchesApi';

const MATCHES_SETTINGS_KEY = 'matches';
const DEFAULT_API_BASE_URL = 'https://forening-api.svenskfotboll.se';
const MASKED_API_KEY = '••••••••';

type MatchViewMode = 'grid' | 'list';

export type MatchSettingsCategory = 'view' | 'api';

const matchSettingsCategories = [
  { id: 'view' as const, label: 'View', icon: LayoutGrid },
  { id: 'api' as const, label: 'API', icon: Settings2 },
];

interface MatchSettingsViewProps {
  selectedCategory?: MatchSettingsCategory;
  onSelectedCategoryChange?: (category: MatchSettingsCategory) => void;
  renderCategoryButtonsInline?: boolean;
  inlineTrailing?: React.ReactNode;
}

export function MatchSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  renderCategoryButtonsInline = false,
  inlineTrailing,
}: MatchSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { setHeaderTrailing } = useContentLayout();
  const { getSettings, updateSettings } = useApp();

  const [internalCategory, setInternalCategory] = useState<MatchSettingsCategory>('view');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [viewMode, setViewMode] = useState<MatchViewMode>('list');
  const [initialViewMode, setInitialViewMode] = useState<MatchViewMode>('list');
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [initialApiBaseUrl, setInitialApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [apiKey, setApiKey] = useState('');
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const categoryButtons = useMemo(
    () => (
      <div className="flex items-center gap-1">
        {matchSettingsCategories.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          return (
            <Button
              key={category.id}
              variant="ghost"
              onClick={() => !isActive && setActiveCategory(category.id)}
              className={cn(
                'h-9 text-xs px-3 rounded-lg font-medium transition-colors',
                'flex items-center gap-1.5 sm:gap-2',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary hover:bg-primary/15'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
              )}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{category.id === 'api' ? t('matches.apiSettings') : category.label}</span>
            </Button>
          );
        })}
      </div>
    ),
    [activeCategory, setActiveCategory, t],
  );

  useEffect(() => {
    if (renderCategoryButtonsInline) {
      setHeaderTrailing(null);
      return;
    }
    setHeaderTrailing(categoryButtons);
    return () => setHeaderTrailing(null);
  }, [setHeaderTrailing, renderCategoryButtonsInline, categoryButtons]);

  useEffect(() => {
    let cancelled = false;
    getSettings(MATCHES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loadedView = settings?.viewMode === 'list' ? 'list' : 'grid';
        const loadedBaseUrl =
          typeof settings?.apiBaseUrl === 'string' && settings.apiBaseUrl.trim()
            ? settings.apiBaseUrl.trim()
            : DEFAULT_API_BASE_URL;
        const storedKey = typeof settings?.apiKey === 'string' && settings.apiKey.trim();
        setViewMode(loadedView);
        setInitialViewMode(loadedView);
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

  const isViewDirty = viewMode !== initialViewMode;
  const isApiDirty =
    apiBaseUrl.trim() !== initialApiBaseUrl.trim() ||
    (apiKey.trim() !== '' && !apiKey.startsWith('••••'));
  const isDirty = activeCategory === 'view' ? isViewDirty : isApiDirty;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setImportError(null);
    try {
      if (activeCategory === 'view') {
        await updateSettings(MATCHES_SETTINGS_KEY, { viewMode });
        setInitialViewMode(viewMode);
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
  }, [activeCategory, apiBaseUrl, apiKey, updateSettings, viewMode]);

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

  const viewModes: {
    id: MatchViewMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'grid', label: 'Grid', icon: LayoutGrid },
    { id: 'list', label: 'List', icon: List },
  ];

  return (
    <div className="space-y-4">
      {renderCategoryButtonsInline ? (
        <div className="flex flex-shrink-0 items-center justify-between">
          <div className="mr-4 min-w-0 flex flex-1 items-center gap-4">
            <h2 className="truncate shrink-0 text-lg font-semibold tracking-tight">
              {t('matches.settingsMatches')}
            </h2>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {categoryButtons}
            {inlineTrailing}
          </div>
        </div>
      ) : (
        <h2 className="text-lg font-semibold tracking-tight">{t('matches.settingsMatches')}</h2>
      )}

      <Card padding="md" className="overflow-hidden border border-border/70 bg-card shadow-sm">
        {activeCategory === 'view' && (
          <DetailSection title="Default view" className="pt-0">
            <div className="flex flex-wrap items-center gap-2">
              {viewModes.map((mode) => {
                const ModeIcon = mode.icon;
                const isActive = viewMode === mode.id;
                return (
                  <Button
                    key={mode.id}
                    variant="ghost"
                    onClick={() => setViewMode(mode.id)}
                    className={cn(
                      'h-9 text-xs px-3 rounded-lg font-medium',
                      'flex items-center gap-1.5',
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                    )}
                  >
                    <ModeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>{mode.label}</span>
                  </Button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Matches will be displayed in the selected layout by default.
            </p>
          </DetailSection>
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
      </Card>

      {isDirty && (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSave}
            variant="primary"
            size="sm"
            icon={Check}
            disabled={isSaving}
            className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
          >
            {isSaving ? t('matches.saving') : t('matches.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
