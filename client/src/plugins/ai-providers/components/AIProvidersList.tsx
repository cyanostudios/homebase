import { ArrowDown, ArrowUp, Plus, Route } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { LIST_FILTER_STAT_ROW_CLASS, ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useMobileActions } from '@/core/ui/MobileActionsContext';
import { ListSearchInput } from '@/core/ui/ListSearchInput';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useAIProviders } from '../hooks/useAIProviders';
import type { ProviderSettings } from '../types/aiProviders';
import {
  AI_PROVIDERS_COLUMN_COUNT_STORAGE_KEY,
  AI_PROVIDERS_SETTINGS_KEY,
  getInitialAIProvidersColumnCount,
  resolveAIProvidersColumnCount,
  type AIProvidersColumnCount,
} from '../utils/aiProvidersColumnCount';
import {
  aiProviderMatchesListFilters,
  toggleAIProvidersListFilter,
  type AIProvidersListFilter,
  type AIProvidersListFilterSelection,
} from '../utils/aiProvidersListFilter';
import {
  compareAIProviders,
  nextAIProviderTableSort,
  type AIProviderSortField,
  type AIProviderSortOrder,
} from '../utils/aiProvidersListSort';
import {
  getInitialAIProvidersListViewMode,
  persistAIProvidersListViewModeSession,
  resolveAIProvidersListViewMode,
  type AIProvidersListViewMode,
} from '../utils/aiProvidersListViewMode';

import { AIProvidersListItem } from './AIProvidersListItem';
import { AIProvidersListTable } from './AIProvidersListTable';
import { AIProvidersRouting } from './AIProvidersRouting';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';

function providerTitle(
  t: (key: string, opts?: Record<string, unknown>) => string,
  provider: ProviderSettings,
) {
  return t(`aiProviders.providers.${provider.providerKey}.title`, {
    defaultValue: provider.providerKey,
  });
}

export const AIProvidersList: React.FC = () => {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openAIProviderPanel(null)),
  });

  const {
    providers,
    loading,
    openAIProviderPanel,
    openAIProviderForView,
    aiProvidersContentView,
    openRoutingView,
  } = useAIProviders();

  const [searchTerm, setSearchTerm] = useState('');
  const [primarySort, setPrimarySort] = useState<AIProviderSortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<AIProviderSortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<AIProvidersColumnCount>(
    getInitialAIProvidersColumnCount,
  );
  const [listViewMode, setListViewModeState] = useState<AIProvidersListViewMode>(
    getInitialAIProvidersListViewMode,
  );
  const [activeFilters, setActiveFilters] = useState<AIProvidersListFilterSelection>([]);

  useEffect(() => {
    let cancelled = false;
    getSettings(AI_PROVIDERS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolveAIProvidersColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(AI_PROVIDERS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        const nextView = resolveAIProvidersListViewMode(settings);
        setListViewModeState(nextView);
        persistAIProvidersListViewModeSession(nextView);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: AIProvidersColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistAIProvidersListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(AI_PROVIDERS_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(AI_PROVIDERS_SETTINGS_KEY, {
        columnCount: count,
        listViewMode: 'cards',
      }).catch(() => {});
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: AIProvidersListViewMode) => {
      setListViewModeState(mode);
      persistAIProvidersListViewModeSession(mode);
      updateSettings(AI_PROVIDERS_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);

  const stats = useMemo(
    () => ({
      total: providers.length,
      enabled: providers.filter((p) => p.enabled).length,
      disabled: providers.filter((p) => !p.enabled).length,
      configured: providers.filter((p) => p.hasApiKey).length,
    }),
    [providers],
  );

  const filteredAndSorted = useMemo(() => {
    const byFilter = providers.filter((provider) =>
      aiProviderMatchesListFilters(provider, activeFilters),
    );

    const needle = searchTerm.trim().toLowerCase();
    const filtered = byFilter.filter((provider) => {
      if (!needle) {
        return true;
      }
      const title = providerTitle(t, provider).toLowerCase();
      return (
        provider.providerKey.toLowerCase().includes(needle) ||
        title.includes(needle) ||
        String(provider.defaultModel || '')
          .toLowerCase()
          .includes(needle)
      );
    });

    return [...filtered].sort((a, b) =>
      compareAIProviders(a, b, primarySort, sortOrder, (provider) => providerTitle(t, provider)),
    );
  }, [activeFilters, primarySort, providers, searchTerm, sortOrder, t]);

  const isFilterActive = (filter: AIProvidersListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: AIProvidersListFilter) => {
    setActiveFilters((prev) => toggleAIProvidersListFilter(prev, filter));
  };

  const handlePrimarySortChange = useCallback((field: AIProviderSortField) => {
    setPrimarySort(field);
    setSortOrder(field === 'updatedAt' ? 'desc' : 'asc');
  }, []);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
  }, []);

  const handleTableSort = useCallback(
    (field: AIProviderSortField) => {
      const next = nextAIProviderTableSort(primarySort, sortOrder, field);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const handleOpenForView = (provider: ProviderSettings) =>
    attemptNavigation(() => openAIProviderForView(provider));

  const SORT_FIELD_OPTIONS: { value: AIProviderSortField; label: string }[] = [
    { value: 'providerKey', label: t('aiProviders.colProvider', { defaultValue: 'Provider' }) },
    { value: 'status', label: t('aiProviders.colStatus', { defaultValue: 'Status' }) },
    { value: 'defaultModel', label: t('aiProviders.defaultModel') },
    { value: 'updatedAt', label: t('common.updated') },
  ];

  if (aiProvidersContentView === 'routing') {
    return <AIProvidersRouting />;
  }

  return (
    <div className="plugin-ai-providers min-h-full bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <div className="space-y-3">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div className="min-w-0 space-y-1">
            <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
              {t('nav.ai-providers', { defaultValue: 'AI Providers' })}
            </h2>
            <p className="text-sm text-muted-foreground">{t('aiProviders.listDescription')}</p>
          </div>
          <div className="flex w-full flex-shrink-0 flex-wrap items-center gap-2 md:w-auto">
            <Button
              variant="secondary"
              size="sm"
              icon={Route}
              className="h-9 flex-1 md:flex-initial px-3 text-xs"
              onClick={() => attemptNavigation(openRoutingView)}
            >
              {t('aiProviders.routing.open', { defaultValue: 'Routing' })}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 flex-1 md:flex-initial px-3 text-xs"
              onClick={() => attemptNavigation(() => openAIProviderPanel(null))}
            >
              {t('aiProviders.addProvider')}
            </Button>
          </div>
        </div>

        <div className={cn(LIST_FILTER_STAT_ROW_CLASS, 'md:grid-cols-2 md:gap-2 lg:grid-cols-4')}>
          <ListFilterStatCard
            label={t('aiProviders.filterAll', { defaultValue: 'Total' })}
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilters.length === 0}
            onClick={() => setActiveFilters([])}
          />
          <ListFilterStatCard
            label={t('aiProviders.statusEnabled')}
            value={stats.enabled}
            dotClassName="bg-emerald-500"
            active={isFilterActive('enabled')}
            onClick={() => toggleFilter('enabled')}
          />
          <ListFilterStatCard
            label={t('aiProviders.statusDisabled')}
            value={stats.disabled}
            dotClassName="bg-amber-500"
            active={isFilterActive('disabled')}
            onClick={() => toggleFilter('disabled')}
          />
          <ListFilterStatCard
            label={t('aiProviders.keyConfigured')}
            value={stats.configured}
            dotClassName="bg-rose-500"
            active={isFilterActive('configured')}
            onClick={() => toggleFilter('configured')}
          />
        </div>

        <div className="flex flex-col gap-3">
          <ListToolbar
            selectedCount={0}
            search={
              <ListSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('aiProviders.searchPlaceholder', { count: providers.length })}
              />
            }
            trailing={
              <>
                {!isTableView ? (
                  <div className="mr-1 flex items-center gap-1">
                    <Select
                      value={primarySort}
                      onValueChange={(value) =>
                        handlePrimarySortChange(value as AIProviderSortField)
                      }
                    >
                      <SelectTrigger
                        className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                        aria-label="Sort by"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        position="item-aligned"
                        className="rounded-xl border-border/50 shadow-xl"
                      >
                        {SORT_FIELD_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className="rounded-md text-xs"
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 px-0 text-xs"
                      onClick={toggleSortOrder}
                      aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
                      title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      {sortOrder === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ) : null}
                <ListColumnLayoutToggle
                  columnCount={columnCount}
                  listViewMode={listViewMode}
                  onSelectColumns={setColumnCount}
                  onSelectTable={() => setListViewMode('table')}
                  columnAriaLabel={(count) =>
                    t(`aiProviders.columns${count}`, { defaultValue: `${count} columns` })
                  }
                  tableAriaLabel={t('common.tableView')}
                />
              </>
            }
          />

          {loading && providers.length === 0 ? (
            <div className="rounded-xl bg-white p-6 text-center text-sm text-muted-foreground shadow-sm dark:bg-slate-950">
              {t('common.loading')}
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <ListEmptyState
              message={searchTerm.trim() ? t('aiProviders.noMatch') : t('aiProviders.noYet')}
              createLabel={!searchTerm.trim() ? t('aiProviders.addProvider') : undefined}
              onCreate={
                !searchTerm.trim()
                  ? () => attemptNavigation(() => openAIProviderPanel(null))
                  : undefined
              }
            />
          ) : isTableView ? (
            <AIProvidersListTable
              providers={filteredAndSorted}
              primarySort={primarySort}
              sortOrder={sortOrder}
              onSort={handleTableSort}
              onRowClick={handleOpenForView}
              providerTitle={(provider) => providerTitle(t, provider)}
            />
          ) : (
            <div
              className={cn(
                'grid gap-3',
                effectiveColumnCount === 1 && 'grid-cols-1',
                effectiveColumnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                effectiveColumnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
              )}
            >
              {filteredAndSorted.map((provider) => (
                <AIProvidersListItem
                  key={provider.providerKey}
                  provider={provider}
                  title={providerTitle(t, provider)}
                  onClick={() => handleOpenForView(provider)}
                  columnCount={effectiveCardColumnCount}
                />
              ))}
            </div>
          )}

          <ListFooterBar
            meta={
              <>
                {t('aiProviders.showingCount', {
                  defaultValue: 'Showing {{visible}} of {{total}} providers',
                  visible: filteredAndSorted.length,
                  total: providers.length,
                })}
              </>
            }
          />
        </div>
      </div>
    </div>
  );
};
