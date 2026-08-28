import {
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  Key,
  LayoutGrid,
  Plus,
  Route,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
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
import {
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { usePulses } from '../hooks/usePulses';
import type { PulseProviderSettings } from '../types/pulse';
import {
  getInitialPulseColumnCount,
  PULSES_COLUMN_COUNT_STORAGE_KEY,
  PULSES_SETTINGS_KEY,
  resolvePulseColumnCount,
  type PulseColumnCount,
} from '../utils/pulseColumnCount';
import {
  comparePulseProviders,
  nextPulseProviderTableSort,
  type PulseProviderSortField,
  type PulseProviderSortOrder,
} from '../utils/pulseListSort';
import {
  getInitialPulseListViewMode,
  persistPulseListViewModeSession,
  resolvePulseListViewMode,
  type PulseListViewMode,
} from '../utils/pulseListViewMode';
import {
  pulseProviderMatchesListFilters,
  togglePulseProvidersListFilter,
  type PulseProvidersListFilter,
  type PulseProvidersListFilterSelection,
} from '../utils/pulseProvidersListFilter';

import { PulseProvidersListItem } from './PulseProvidersListItem';
import { PulseProvidersListTable } from './PulseProvidersListTable';
import { PulseProvidersRouting } from './PulseProvidersRouting';

function providerTitle(
  t: (key: string, opts?: Record<string, unknown>) => string,
  provider: PulseProviderSettings,
) {
  return t(`pulses.providers.${provider.providerKey}.title`, {
    defaultValue: provider.providerKey,
  });
}

export const PulseProvidersList: React.FC = () => {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openPulsePanel(null)),
  });

  const {
    providers,
    loading,
    openPulsePanel,
    openPulseForView,
    openHistoryView,
    openRoutingView,
    pulsesContentView,
  } = usePulses();

  const [searchTerm, setSearchTerm] = useState('');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('pulses.searchProviders', {
      defaultValue: 'Search providers ({{count}})',
      count: providers.length,
    }),
  });
  const [primarySort, setPrimarySort] = useState<PulseProviderSortField>('providerKey');
  const [sortOrder, setSortOrder] = useState<PulseProviderSortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<PulseColumnCount>(getInitialPulseColumnCount);
  const [listViewMode, setListViewModeState] = useState<PulseListViewMode>(
    getInitialPulseListViewMode,
  );
  const [activeFilters, setActiveFilters] = useState<PulseProvidersListFilterSelection>([]);

  useEffect(() => {
    let cancelled = false;
    getSettings(PULSES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const resolved = resolvePulseColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as PulseColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(PULSES_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(PULSES_SETTINGS_KEY, { columnCount: next }).catch(() => {});
        }
        const nextView = resolvePulseListViewMode(settings);
        setListViewModeState(nextView);
        persistPulseListViewModeSession(nextView);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (_count: PulseColumnCount) => {
      const next = 3 as PulseColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistPulseListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(PULSES_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(PULSES_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: PulseListViewMode) => {
      setListViewModeState(mode);
      persistPulseListViewModeSession(mode);
      updateSettings(PULSES_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
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
      configured: providers.filter((p) => p.configured).length,
    }),
    [providers],
  );

  const filteredAndSorted = useMemo(() => {
    const byFilter = providers.filter((provider) =>
      pulseProviderMatchesListFilters(provider, activeFilters),
    );

    const needle = searchTerm.trim().toLowerCase();
    const filtered = byFilter.filter((provider) => {
      if (!needle) {
        return true;
      }
      const title = providerTitle(t, provider).toLowerCase();
      return provider.providerKey.toLowerCase().includes(needle) || title.includes(needle);
    });

    return [...filtered].sort((a, b) =>
      comparePulseProviders(a, b, primarySort, sortOrder, (provider) => providerTitle(t, provider)),
    );
  }, [activeFilters, primarySort, providers, searchTerm, sortOrder, t]);

  const isFilterActive = (filter: PulseProvidersListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: PulseProvidersListFilter) => {
    setActiveFilters((prev) => togglePulseProvidersListFilter(prev, filter));
  };

  const handlePrimarySortChange = useCallback((field: PulseProviderSortField) => {
    setPrimarySort(field);
    setSortOrder(field === 'updatedAt' ? 'desc' : 'asc');
  }, []);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
  }, []);

  const handleTableSort = useCallback(
    (field: PulseProviderSortField) => {
      const next = nextPulseProviderTableSort(primarySort, sortOrder, field);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const handleOpenForView = (provider: PulseProviderSettings) =>
    attemptNavigation(() => openPulseForView(provider));

  const SORT_FIELD_OPTIONS: { value: PulseProviderSortField; label: string }[] = [
    { value: 'providerKey', label: t('pulses.colProvider', { defaultValue: 'Provider' }) },
    { value: 'status', label: t('pulses.colStatus', { defaultValue: 'Status' }) },
    { value: 'capability', label: t('pulses.capability', { defaultValue: 'Capability' }) },
    { value: 'updatedAt', label: t('common.updated') },
  ];

  if (pulsesContentView === 'routing') {
    return <PulseProvidersRouting />;
  }

  return (
    <div className={cn('plugin-pulses', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
                  {t('nav.pulses', { defaultValue: 'Pulse' })}
                </h2>
                <ExpandableIconButton
                  icon={Bell}
                  label={t('pulses.historyTitle', { defaultValue: 'SMS history' })}
                  variant="soft"
                  onClick={() => attemptNavigation(openHistoryView)}
                />
                <ExpandableIconButton
                  icon={Route}
                  label={t('pulses.routing.open', { defaultValue: 'Routing' })}
                  variant="soft"
                  onClick={() => attemptNavigation(openRoutingView)}
                />
              </div>
            </div>
            <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
              <RoundExpandableSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('pulses.searchProviders', {
                  defaultValue: 'Search providers ({{count}})',
                  count: providers.length,
                })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) =>
                  t(`pulses.columns${count}`, { defaultValue: `${count} columns` })
                }
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('pulses.addProvider', { defaultValue: 'Add provider' })}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openPulsePanel(null))}
              />
            </div>
          </div>
        </div>

        <div className={LIST_FILTER_AND_SORT_ROW_CLASS}>
          <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilters([])}
              className={cn(
                activeFilters.length === 0 ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>
                {t('pulses.total', { defaultValue: 'Total' })}{' '}
                <span className="tabular-nums font-semibold">({stats.total})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('enabled')}
              className={cn(
                isFilterActive('enabled') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {t('pulses.statusEnabled', { defaultValue: 'Enabled' })}{' '}
                <span className="tabular-nums font-semibold">({stats.enabled})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('disabled')}
              className={cn(
                isFilterActive('disabled') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>
                {t('pulses.statusDisabled', { defaultValue: 'Disabled' })}{' '}
                <span className="tabular-nums font-semibold">({stats.disabled})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('configured')}
              className={cn(
                isFilterActive('configured')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Key className="h-3.5 w-3.5" />
              <span>
                {t('pulses.keyConfigured', { defaultValue: 'Configured' })}{' '}
                <span className="tabular-nums font-semibold">({stats.configured})</span>
              </span>
            </Button>
          </div>
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
            <Select
              value={primarySort}
              onValueChange={(value) => handlePrimarySortChange(value as PulseProviderSortField)}
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
        </div>

        <div className="flex flex-col gap-3">
          {loading && providers.length === 0 ? (
            <div className="rounded-xl bg-white p-6 text-center text-sm text-muted-foreground shadow-sm dark:bg-slate-950">
              {t('common.loading')}
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <ListEmptyState
              message={
                searchTerm.trim()
                  ? t('pulses.noMatch', { defaultValue: 'No matching providers' })
                  : t('pulses.noYet', { defaultValue: 'No providers yet — add Twilio or Mock' })
              }
              createLabel={!searchTerm.trim() ? t('pulses.addProvider') : undefined}
              onCreate={
                !searchTerm.trim() ? () => attemptNavigation(() => openPulsePanel(null)) : undefined
              }
            />
          ) : isTableView ? (
            <PulseProvidersListTable
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
                <PulseProvidersListItem
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
                {t('pulses.showingCount', {
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
