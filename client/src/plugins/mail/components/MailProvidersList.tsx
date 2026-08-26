import { ArrowDown, ArrowUp, History, Plus, Route } from 'lucide-react';
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

import { useMail } from '../hooks/useMail';
import type { MailProviderSettings } from '../types/mail';
import {
  getInitialMailColumnCount,
  MAIL_COLUMN_COUNT_STORAGE_KEY,
  MAIL_SETTINGS_KEY,
  resolveMailColumnCount,
  type MailColumnCount,
} from '../utils/mailColumnCount';
import {
  compareMailProviders,
  nextMailProviderTableSort,
  type MailProviderSortField,
  type MailProviderSortOrder,
} from '../utils/mailListSort';
import {
  getInitialMailListViewMode,
  persistMailListViewModeSession,
  resolveMailListViewMode,
  type MailListViewMode,
} from '../utils/mailListViewMode';
import {
  mailProviderMatchesListFilters,
  toggleMailProvidersListFilter,
  type MailProvidersListFilter,
  type MailProvidersListFilterSelection,
} from '../utils/mailProvidersListFilter';

import { MailProvidersListItem } from './MailProvidersListItem';
import { MailProvidersListTable } from './MailProvidersListTable';
import { MailProvidersRouting } from './MailProvidersRouting';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';

function providerTitle(
  t: (key: string, opts?: Record<string, unknown>) => string,
  provider: MailProviderSettings,
) {
  return t(`mail.providers.${provider.providerKey}.title`, {
    defaultValue: provider.providerKey,
  });
}

export const MailProvidersList: React.FC = () => {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openMailPanel(null)),
  });

  const {
    providers,
    loading,
    openMailPanel,
    openMailForView,
    openHistoryView,
    openRoutingView,
    mailContentView,
  } = useMail();

  const [searchTerm, setSearchTerm] = useState('');
  const [primarySort, setPrimarySort] = useState<MailProviderSortField>('providerKey');
  const [sortOrder, setSortOrder] = useState<MailProviderSortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<MailColumnCount>(getInitialMailColumnCount);
  const [listViewMode, setListViewModeState] = useState<MailListViewMode>(
    getInitialMailListViewMode,
  );
  const [activeFilters, setActiveFilters] = useState<MailProvidersListFilterSelection>([]);

  useEffect(() => {
    let cancelled = false;
    getSettings(MAIL_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolveMailColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(MAIL_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        const nextView = resolveMailListViewMode(settings);
        setListViewModeState(nextView);
        persistMailListViewModeSession(nextView);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: MailColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistMailListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(MAIL_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(MAIL_SETTINGS_KEY, { columnCount: count, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: MailListViewMode) => {
      setListViewModeState(mode);
      persistMailListViewModeSession(mode);
      updateSettings(MAIL_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
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
      mailProviderMatchesListFilters(provider, activeFilters),
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
      compareMailProviders(a, b, primarySort, sortOrder, (provider) => providerTitle(t, provider)),
    );
  }, [activeFilters, primarySort, providers, searchTerm, sortOrder, t]);

  const isFilterActive = (filter: MailProvidersListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: MailProvidersListFilter) => {
    setActiveFilters((prev) => toggleMailProvidersListFilter(prev, filter));
  };

  const handlePrimarySortChange = useCallback((field: MailProviderSortField) => {
    setPrimarySort(field);
    setSortOrder(field === 'updatedAt' ? 'desc' : 'asc');
  }, []);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
  }, []);

  const handleTableSort = useCallback(
    (field: MailProviderSortField) => {
      const next = nextMailProviderTableSort(primarySort, sortOrder, field);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const handleOpenForView = (provider: MailProviderSettings) =>
    attemptNavigation(() => openMailForView(provider));

  const SORT_FIELD_OPTIONS: { value: MailProviderSortField; label: string }[] = [
    { value: 'providerKey', label: t('mail.colProvider', { defaultValue: 'Provider' }) },
    { value: 'status', label: t('mail.colStatus', { defaultValue: 'Status' }) },
    { value: 'capability', label: t('mail.capability', { defaultValue: 'Capability' }) },
    { value: 'updatedAt', label: t('common.updated') },
  ];

  if (mailContentView === 'routing') {
    return <MailProvidersRouting />;
  }

  return (
    <div className="plugin-mail min-h-full bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <div className="space-y-3">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div className="min-w-0 space-y-1">
            <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.mail', { defaultValue: 'Mail' })}</h2>
            <p className="text-sm text-muted-foreground">
              {t('mail.listDescription', {
                defaultValue:
                  'Add and manage email providers. Route delivery per plugin and review send history.',
              })}
            </p>
          </div>
          <div className="flex w-full flex-shrink-0 flex-wrap items-center gap-2 md:w-auto">
            <Button
              variant="secondary"
              size="sm"
              icon={History}
              className="h-9 flex-1 md:flex-initial px-3 text-xs"
              onClick={() => attemptNavigation(openHistoryView)}
            >
              {t('mail.historyTitle', { defaultValue: 'Mail history' })}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Route}
              className="h-9 flex-1 md:flex-initial px-3 text-xs"
              onClick={() => attemptNavigation(openRoutingView)}
            >
              {t('mail.routing.open', { defaultValue: 'Routing' })}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 flex-1 md:flex-initial px-3 text-xs"
              onClick={() => attemptNavigation(() => openMailPanel(null))}
            >
              {t('mail.addProvider', { defaultValue: 'Add provider' })}
            </Button>
          </div>
        </div>

        <div className={cn(LIST_FILTER_STAT_ROW_CLASS, 'md:grid-cols-2 md:gap-2 lg:grid-cols-4')}>
          <ListFilterStatCard
            label={t('mail.total', { defaultValue: 'Total' })}
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilters.length === 0}
            onClick={() => setActiveFilters([])}
          />
          <ListFilterStatCard
            label={t('mail.statusEnabled', { defaultValue: 'Enabled' })}
            value={stats.enabled}
            dotClassName="bg-emerald-500"
            active={isFilterActive('enabled')}
            onClick={() => toggleFilter('enabled')}
          />
          <ListFilterStatCard
            label={t('mail.statusDisabled', { defaultValue: 'Disabled' })}
            value={stats.disabled}
            dotClassName="bg-amber-500"
            active={isFilterActive('disabled')}
            onClick={() => toggleFilter('disabled')}
          />
          <ListFilterStatCard
            label={t('mail.keyConfigured', { defaultValue: 'Configured' })}
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
                placeholder={t('mail.searchProviders', {
                  defaultValue: 'Search providers ({{count}})',
                  count: providers.length,
                })}
              />
            }
            trailing={
              <>
                {!isTableView ? (
                  <div className="mr-1 flex items-center gap-1">
                    <Select
                      value={primarySort}
                      onValueChange={(value) =>
                        handlePrimarySortChange(value as MailProviderSortField)
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
                    t(`mail.columns${count}`, { defaultValue: `${count} columns` })
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
                  ? t('mail.noMatch', { defaultValue: 'No matching providers' })
                  : t('mail.noYet', { defaultValue: 'No providers yet — add SMTP or Resend' })
              }
              createLabel={!searchTerm.trim() ? t('mail.addProvider') : undefined}
              onCreate={
                !searchTerm.trim() ? () => attemptNavigation(() => openMailPanel(null)) : undefined
              }
            />
          ) : isTableView ? (
            <MailProvidersListTable
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
                <MailProvidersListItem
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
                {t('mail.showingCount', {
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
