import { ArrowDown, ArrowUp, Bell, Plus, Route, Search } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
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

import { PulseProvidersListItem } from './PulseProvidersListItem';
import { PulseProvidersListTable } from './PulseProvidersListTable';
import { PulseProvidersRouting } from './PulseProvidersRouting';

type ProviderFilter = 'all' | 'enabled' | 'disabled' | 'configured';

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
  const [primarySort, setPrimarySort] = useState<PulseProviderSortField>('providerKey');
  const [sortOrder, setSortOrder] = useState<PulseProviderSortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<PulseColumnCount>(getInitialPulseColumnCount);
  const [listViewMode, setListViewModeState] = useState<PulseListViewMode>(
    getInitialPulseListViewMode,
  );
  const [activeFilter, setActiveFilter] = useState<ProviderFilter>('all');

  useEffect(() => {
    let cancelled = false;
    getSettings(PULSES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolvePulseColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(PULSES_COLUMN_COUNT_STORAGE_KEY, String(next));
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
    (count: PulseColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistPulseListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(PULSES_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(PULSES_SETTINGS_KEY, { columnCount: count, listViewMode: 'cards' }).catch(
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

  const isTableView = listViewMode === 'table';

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
    const byFilter = providers.filter((provider) => {
      if (activeFilter === 'enabled') {
        return provider.enabled;
      }
      if (activeFilter === 'disabled') {
        return !provider.enabled;
      }
      if (activeFilter === 'configured') {
        return provider.configured;
      }
      return true;
    });

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
  }, [activeFilter, primarySort, providers, searchTerm, sortOrder, t]);

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
    <div className="plugin-pulses min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {t('nav.pulses', { defaultValue: 'Pulse' })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('pulses.listDescription', {
                defaultValue:
                  'Add and manage SMS providers. Route delivery per plugin and review send history.',
              })}
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Bell}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(openHistoryView)}
            >
              {t('pulses.historyTitle', { defaultValue: 'SMS history' })}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Route}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(openRoutingView)}
            >
              {t('pulses.routing.open', { defaultValue: 'Routing' })}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openPulsePanel(null))}
            >
              {t('pulses.addProvider', { defaultValue: 'Add provider' })}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <ListFilterStatCard
            label={t('pulses.total', { defaultValue: 'Total' })}
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <ListFilterStatCard
            label={t('pulses.statusEnabled', { defaultValue: 'Enabled' })}
            value={stats.enabled}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'enabled'}
            onClick={() => setActiveFilter('enabled')}
          />
          <ListFilterStatCard
            label={t('pulses.statusDisabled', { defaultValue: 'Disabled' })}
            value={stats.disabled}
            dotClassName="bg-amber-500"
            active={activeFilter === 'disabled'}
            onClick={() => setActiveFilter('disabled')}
          />
          <ListFilterStatCard
            label={t('pulses.keyConfigured', { defaultValue: 'Configured' })}
            value={stats.configured}
            dotClassName="bg-rose-500"
            active={activeFilter === 'configured'}
            onClick={() => setActiveFilter('configured')}
          />
        </div>

        <div className="flex flex-col gap-3">
          <ListToolbar
            selectedCount={0}
            search={
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t('pulses.searchProviders', {
                    defaultValue: 'Search providers ({{count}})',
                    count: providers.length,
                  })}
                  className="h-8 bg-background pl-9 text-xs"
                />
              </div>
            }
            trailing={
              <>
                {!isTableView ? (
                  <div className="mr-1 flex items-center gap-1">
                    <Select
                      value={primarySort}
                      onValueChange={(value) =>
                        handlePrimarySortChange(value as PulseProviderSortField)
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
                    t(`pulses.columns${count}`, { defaultValue: `${count} columns` })
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
                columnCount === 1 && 'grid-cols-1',
                columnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                columnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
              )}
            >
              {filteredAndSorted.map((provider) => (
                <PulseProvidersListItem
                  key={provider.providerKey}
                  provider={provider}
                  title={providerTitle(t, provider)}
                  onClick={() => handleOpenForView(provider)}
                  columnCount={columnCount}
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
