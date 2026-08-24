import { Download, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';
import { cn } from '@/lib/utils';
import { useCups } from '@/plugins/cups/hooks/useCups';
import { ingestApi } from '@/plugins/ingest/api/ingestApi';
import type { IngestSource } from '@/plugins/ingest/types/ingest';

import {
  CUPS_COLUMN_COUNT_STORAGE_KEY,
  CUPS_SETTINGS_KEY,
  resolveCupColumnCount,
  type CupColumnCount,
} from '../utils/cupColumnCount';
import {
  CUPS_LIST_VIEW_MODE_STORAGE_KEY,
  persistCupListViewModeSession,
  resolveCupListViewMode,
  type CupListViewMode,
} from '../utils/cupListViewMode';

import {
  CupIngestImportResultDialog,
  type CupIngestImportResultVariant,
} from './CupIngestImportResultDialog';
import { CupFallbackPhotosSettings } from './CupFallbackPhotosSettings';

const COLUMN_OPTIONS: CupColumnCount[] = [1, 2, 3];
const VIEW_MODE_OPTIONS: CupListViewMode[] = ['cards', 'table'];
export type CupsSettingsCategory = 'view' | 'import' | 'appearance';

export function CupsSettingsView({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: {
  selectedCategory?: CupsSettingsCategory;
  onSelectedCategoryChange?: (category: CupsSettingsCategory) => void;
  /** @deprecated Category cards replace header tab buttons. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
} = {}) {
  const { t } = useTranslation();
  const { getSettings, updateSettings } = useApp();
  const { importFromIngestSource } = useCups();
  const [internalCategory, setInternalCategory] = useState<CupsSettingsCategory>('view');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [columnCount, setColumnCount] = useState<CupColumnCount>(1);
  const [listViewMode, setListViewMode] = useState<CupListViewMode>('cards');
  const [defaultIngestSourceId, setDefaultIngestSourceId] = useState('');
  const [allowedIngestSourceIds, setAllowedIngestSourceIds] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [ingestSources, setIngestSources] = useState<IngestSource[]>([]);
  const [ingestLoading, setIngestLoading] = useState(true);
  const [initialState, setInitialState] = useState({
    columnCount: 1 as CupColumnCount,
    listViewMode: 'cards' as CupListViewMode,
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
    softDeleted: number;
    restored: number;
    hardDeleted: number;
    errors: string[];
  } | null>(null);
  const [appearanceDirty, setAppearanceDirty] = useState(false);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const appearanceSaveRef = useRef<{ save: (() => Promise<void>) | null }>({ save: null });

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'view',
        label: t('cups.settingsCategories.view'),
        description: t('cups.settingsCategories.viewDescription'),
        icon: SETTINGS_CATEGORY_ICONS.view,
        dotClassName: 'bg-blue-500',
      },
      {
        id: 'appearance',
        label: t('cups.settingsCategories.appearance'),
        description: t('cups.settingsCategories.appearanceDescription'),
        icon: SETTINGS_CATEGORY_ICONS.appearance,
        dotClassName: 'bg-amber-500',
      },
      {
        id: 'import',
        label: t('cups.settingsCategories.import'),
        description: t('cups.settingsCategories.importDescription'),
        icon: SETTINGS_CATEGORY_ICONS.import,
        dotClassName: 'bg-emerald-500',
      },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(CUPS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const loadedColumns = resolveCupColumnCount(settings);
        const loadedView = resolveCupListViewMode(settings);
        const loadedDefault = settings?.defaultIngestSourceId
          ? String(settings.defaultIngestSourceId)
          : '';
        const loadedAllowed = Array.isArray(settings?.allowedIngestSourceIds)
          ? settings.allowedIngestSourceIds.map(String)
          : [];
        const loadedAutoRefresh = settings?.autoRefresh === true;
        setColumnCount(loadedColumns);
        setListViewMode(loadedView);
        setDefaultIngestSourceId(loadedDefault);
        setAllowedIngestSourceIds(loadedAllowed);
        setAutoRefresh(loadedAutoRefresh);
        setInitialState({
          columnCount: loadedColumns,
          listViewMode: loadedView,
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
    columnCount !== initialState.columnCount ||
    listViewMode !== initialState.listViewMode ||
    defaultIngestSourceId !== initialState.defaultIngestSourceId ||
    JSON.stringify([...allowedIngestSourceIds].sort()) !==
      JSON.stringify([...initialState.allowedIngestSourceIds].sort()) ||
    autoRefresh !== initialState.autoRefresh;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const payload = {
        columnCount,
        listViewMode,
        defaultIngestSourceId: defaultIngestSourceId.trim() || '',
        allowedIngestSourceIds,
        autoRefresh,
      };
      await updateSettings(CUPS_SETTINGS_KEY, payload);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CUPS_COLUMN_COUNT_STORAGE_KEY, String(columnCount));
        window.sessionStorage.setItem(CUPS_LIST_VIEW_MODE_STORAGE_KEY, listViewMode);
      }
      persistCupListViewModeSession(listViewMode);
      setInitialState({
        columnCount,
        listViewMode,
        defaultIngestSourceId: defaultIngestSourceId.trim() || '',
        allowedIngestSourceIds,
        autoRefresh,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    allowedIngestSourceIds,
    autoRefresh,
    columnCount,
    defaultIngestSourceId,
    listViewMode,
    updateSettings,
  ]);

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
      let totalSoftDeleted = 0;
      let totalRestored = 0;
      let totalHardDeleted = 0;
      const errors: string[] = [];

      for (const sourceId of allowedIngestSourceIds) {
        try {
          const result = await importFromIngestSource(sourceId);
          totalParsed += result.parsed || 0;
          totalCreated += result.created || 0;
          totalUpdated += result.updated || 0;
          totalSkipped += result.skipped || 0;
          totalSoftDeleted += result.softDeleted || 0;
          totalRestored += result.restored || 0;
          totalHardDeleted += result.hardDeleted || 0;
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
        softDeleted: totalSoftDeleted,
        restored: totalRestored,
        hardDeleted: totalHardDeleted,
        errors,
      });
      setImportResultOpen(true);
    } finally {
      setIsImporting(false);
    }
  }, [allowedIngestSourceIds, importFromIngestSource]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <>
      <PluginSettingsPageShell
        title={t('cups.settingsCups', { defaultValue: 'Cups settings' })}
        subtitle={t('cups.settingsSubtitle')}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id as CupsSettingsCategory)}
        onClose={onClose}
        onSave={isDirty ? () => void handleSave() : undefined}
        isSaving={isSaving}
        saveAction={
          activeCategory === 'appearance' ? (
            appearanceDirty ? (
              <SettingsHeaderSaveButton
                onClick={() => void appearanceSaveRef.current.save?.()}
                isSaving={appearanceSaving}
              />
            ) : null
          ) : isDirty ? (
            <SettingsHeaderSaveButton onClick={() => void handleSave()} isSaving={isSaving} />
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
              <DetailSection title={t('cups.defaultColumns')}>
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
                        aria-label={t(`cups.columns${count}`)}
                        aria-pressed={isActive}
                      >
                        {count}
                      </Button>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{t('cups.columnsHelp')}</p>
              </DetailSection>
            ) : null}
          </>
        )}

        {activeCategory === 'appearance' && (
          <CupFallbackPhotosSettings
            onDirtyChange={setAppearanceDirty}
            onSavingChange={setAppearanceSaving}
            saveRef={appearanceSaveRef}
          />
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
                      Scheduled via Railway cron (recommended weekly, e.g. Monday 03:00 UTC) —
                      imports cups from the selected sources above and soft-deletes cups that are no
                      longer in the source. Cups not seen for 30 days are permanently deleted.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </DetailSection>
        )}
      </PluginSettingsPageShell>

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
          softDeleted={importResult.softDeleted}
          restored={importResult.restored}
          hardDeleted={importResult.hardDeleted}
          errors={importResult.errors}
        />
      )}
    </>
  );
}
