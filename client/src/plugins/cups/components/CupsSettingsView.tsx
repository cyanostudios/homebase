import { Check, Download, LayoutGrid, List, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useApp } from '@/core/api/AppContext';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';
import { useCups } from '@/plugins/cups/hooks/useCups';
import { ingestApi } from '@/plugins/ingest/api/ingestApi';
import type { IngestSource } from '@/plugins/ingest/types/ingest';

import {
  CupIngestImportResultDialog,
  type CupIngestImportResultVariant,
} from './CupIngestImportResultDialog';

const CUPS_SETTINGS_KEY = 'cups';
type CupsViewMode = 'grid' | 'list';
export type CupsSettingsCategory = 'view' | 'import';

const categories = [
  { id: 'view' as const, label: 'View', icon: LayoutGrid },
  { id: 'import' as const, label: 'Import', icon: Download },
];

export function CupsSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  renderCategoryButtonsInline = false,
  inlineTrailing,
}: {
  selectedCategory?: CupsSettingsCategory;
  onSelectedCategoryChange?: (category: CupsSettingsCategory) => void;
  renderCategoryButtonsInline?: boolean;
  inlineTrailing?: React.ReactNode;
} = {}) {
  const { getSettings, updateSettings } = useApp();
  const { importFromIngestSource } = useCups();
  const { setHeaderTrailing } = useContentLayout();
  const [internalCategory, setInternalCategory] = useState<CupsSettingsCategory>('view');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [viewMode, setViewMode] = useState<CupsViewMode>('list');
  const [defaultIngestSourceId, setDefaultIngestSourceId] = useState('');
  const [allowedIngestSourceIds, setAllowedIngestSourceIds] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [ingestSources, setIngestSources] = useState<IngestSource[]>([]);
  const [ingestLoading, setIngestLoading] = useState(true);
  const [initialState, setInitialState] = useState({
    viewMode: 'list' as CupsViewMode,
    defaultIngestSourceId: '',
    allowedIngestSourceIds: [] as string[],
    autoRefresh: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [importResult, setImportResult] = useState<{
    variant: CupIngestImportResultVariant;
    sourceCount: number;
    parsed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings(CUPS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loadedView = settings?.viewMode === 'grid' ? 'grid' : 'list';
        const loadedDefault = settings?.defaultIngestSourceId
          ? String(settings.defaultIngestSourceId)
          : '';
        const loadedAllowed = Array.isArray(settings?.allowedIngestSourceIds)
          ? settings.allowedIngestSourceIds.map(String)
          : [];
        const loadedAutoRefresh = settings?.autoRefresh === true;
        setViewMode(loadedView);
        setDefaultIngestSourceId(loadedDefault);
        setAllowedIngestSourceIds(loadedAllowed);
        setAutoRefresh(loadedAutoRefresh);
        setInitialState({
          viewMode: loadedView,
          defaultIngestSourceId: loadedDefault,
          allowedIngestSourceIds: loadedAllowed,
          autoRefresh: loadedAutoRefresh,
        });
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

  useEffect(() => {
    let cancelled = false;
    ingestApi
      .getSources()
      .then((sources) => {
        if (!cancelled) {
          setIngestSources(sources || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setIngestLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isDirty =
    viewMode !== initialState.viewMode ||
    defaultIngestSourceId !== initialState.defaultIngestSourceId ||
    JSON.stringify([...allowedIngestSourceIds].sort()) !==
      JSON.stringify([...initialState.allowedIngestSourceIds].sort()) ||
    autoRefresh !== initialState.autoRefresh;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const payload = {
        viewMode,
        defaultIngestSourceId: defaultIngestSourceId.trim() || '',
        allowedIngestSourceIds,
        autoRefresh,
      };
      await updateSettings(CUPS_SETTINGS_KEY, payload);
      setInitialState({
        viewMode,
        defaultIngestSourceId: defaultIngestSourceId.trim() || '',
        allowedIngestSourceIds,
        autoRefresh,
      });
    } finally {
      setIsSaving(false);
    }
  }, [allowedIngestSourceIds, autoRefresh, defaultIngestSourceId, updateSettings, viewMode]);

  const toggleAllowedSource = useCallback((sourceId: string) => {
    setAllowedIngestSourceIds((prev) =>
      prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId],
    );
  }, []);

  const handleImportSelected = useCallback(async () => {
    if (!allowedIngestSourceIds.length) {
      return;
    }
    setIsImporting(true);
    try {
      let totalParsed = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      const errors: string[] = [];

      for (const sourceId of allowedIngestSourceIds) {
        try {
          const result = await importFromIngestSource(sourceId);
          totalParsed += result.parsed || 0;
          totalCreated += result.created || 0;
          totalUpdated += result.updated || 0;
          totalSkipped += result.skipped || 0;
          if (Array.isArray(result.errors) && result.errors.length) {
            errors.push(...result.errors.map((e) => `[${sourceId}] ${e}`));
          }
        } catch (error: any) {
          errors.push(`[${sourceId}] ${error?.message || 'Import failed'}`);
        }
      }

      const variant: CupIngestImportResultVariant =
        errors.length > 0 && totalCreated === 0 && totalUpdated === 0 && totalParsed === 0
          ? 'error'
          : errors.length > 0
            ? 'partial'
            : 'success';
      setImportResult({
        variant,
        sourceCount: allowedIngestSourceIds.length,
        parsed: totalParsed,
        created: totalCreated,
        updated: totalUpdated,
        skipped: totalSkipped,
        errors,
      });
      setImportResultOpen(true);
    } finally {
      setIsImporting(false);
    }
  }, [allowedIngestSourceIds, importFromIngestSource]);

  const categoryButtons = useMemo(
    () => (
      <div className="flex items-center gap-1">
        {categories.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          return (
            <Button
              key={category.id}
              variant="ghost"
              onClick={() => !isActive && setActiveCategory(category.id)}
              className={cn(
                'h-9 text-xs px-3 rounded-lg font-medium transition-colors flex items-center gap-1.5',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary hover:bg-primary/15'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
              )}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{category.label}</span>
            </Button>
          );
        })}
      </div>
    ),
    [activeCategory, setActiveCategory],
  );

  useEffect(() => {
    if (renderCategoryButtonsInline) {
      setHeaderTrailing(null);
      return;
    }
    setHeaderTrailing(categoryButtons);
    return () => setHeaderTrailing(null);
  }, [categoryButtons, renderCategoryButtonsInline, setHeaderTrailing]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-4">
      {renderCategoryButtonsInline ? (
        <div className="flex flex-shrink-0 items-center justify-between">
          <div className="mr-4 min-w-0 flex flex-1 items-center gap-4">
            <h2 className="truncate shrink-0 text-lg font-semibold tracking-tight">
              Cups settings
            </h2>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {categoryButtons}
            {inlineTrailing}
          </div>
        </div>
      ) : (
        <h2 className="text-lg font-semibold tracking-tight">Cups settings</h2>
      )}

      <Card padding="md" className="overflow-hidden border border-border/70 bg-card shadow-sm">
        {activeCategory === 'view' && (
          <DetailSection title="Default view" className="pt-0">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'grid' as const, label: 'Grid', icon: LayoutGrid },
                { id: 'list' as const, label: 'List', icon: List },
              ].map((mode) => {
                const Icon = mode.icon;
                const isActive = viewMode === mode.id;
                return (
                  <Button
                    key={mode.id}
                    variant="ghost"
                    onClick={() => setViewMode(mode.id)}
                    className={cn(
                      'h-9 text-xs px-3 rounded-lg font-medium flex items-center gap-1.5',
                      isActive
                        ? 'bg-primary/10 text-primary border border-primary'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border-transparent',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>{mode.label}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Controls the default layout for Cups list.
            </p>
          </DetailSection>
        )}

        {activeCategory === 'import' && (
          <DetailSection title="Import sources" className="pt-0">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose which ingest sources Cups is allowed to use.
              </p>
              {ingestLoading ? (
                <p className="text-sm text-muted-foreground">Loading ingest sources...</p>
              ) : ingestSources.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ingest sources found.</p>
              ) : (
                <div className="space-y-2">
                  {ingestSources.map((source) => (
                    <label
                      key={source.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded border p-2 text-sm',
                        allowedIngestSourceIds.includes(String(source.id))
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border/60',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 cursor-pointer"
                        checked={allowedIngestSourceIds.includes(String(source.id))}
                        onChange={() => toggleAllowedSource(String(source.id))}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{source.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {source.sourceUrl}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {ingestSources.length > 0 && allowedIngestSourceIds.length === 0 && (
                <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-2">
                  Tick at least one source to enable bulk import here. From the Cups list, you can
                  still use Import from Ingest for any source until you restrict the list below.
                </p>
              )}
              {allowedIngestSourceIds.length > 0 && (
                <div className="flex items-center justify-between gap-2 rounded border border-border/60 p-3">
                  <p className="text-sm text-muted-foreground">
                    {allowedIngestSourceIds.length} ingest source(s) selected.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={Download}
                    className="h-9 px-3 text-xs"
                    onClick={handleImportSelected}
                    disabled={isImporting}
                  >
                    {isImporting ? 'Importing...' : 'Import selected'}
                  </Button>
                </div>
              )}
              <label className="text-sm font-medium">Default ingest source id</label>
              <Input
                value={defaultIngestSourceId}
                onChange={(e) => setDefaultIngestSourceId(e.target.value)}
                placeholder="Example: 5"
              />
              <p className="text-sm text-muted-foreground">
                Used as default in Cups import action and should be one of the selected sources.
              </p>

              <div className="mt-4 border-t border-border/60 pt-4">
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded border p-3 text-sm',
                    autoRefresh ? 'border-primary/50 bg-primary/5' : 'border-border/60',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 cursor-pointer"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Auto refresh
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Runs daily at 03:00 UTC — imports cups from the selected sources above and
                      soft-deletes cups that are no longer in the source. Cups not seen for 30 days
                      are permanently deleted.
                    </span>
                  </span>
                </label>
              </div>
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
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}

      {importResult && (
        <CupIngestImportResultDialog
          isOpen={importResultOpen}
          onClose={() => {
            setImportResultOpen(false);
            setImportResult(null);
          }}
          variant={importResult.variant}
          sourceCount={importResult.sourceCount}
          parsed={importResult.parsed}
          created={importResult.created}
          updated={importResult.updated}
          skipped={importResult.skipped}
          errors={importResult.errors}
        />
      )}
    </div>
  );
}
