import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  History,
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
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('mail.searchProviders', {
      defaultValue: 'Search providers ({{count}})',
      count: providers.length,
    }),
  });
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
        const resolved = resolveMailColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as MailColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(MAIL_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(MAIL_SETTINGS_KEY, { columnCount: next }).catch(() => {});
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
    (_count: MailColumnCount) => {
      const next = 3 as MailColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistMailListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(MAIL_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(MAIL_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
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
    <div className={cn('plugin-mail', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
                  {t('nav.mail', { defaultValue: 'Mail' })}
                </h2>
                <ExpandableIconButton
                  icon={History}
                  label={t('mail.historyTitle', { defaultValue: 'Mail history' })}
                  variant="soft"
                  onClick={() => attemptNavigation(openHistoryView)}
                />
                <ExpandableIconButton
                  icon={Route}
                  label={t('mail.routing.open', { defaultValue: 'Routing' })}
                  variant="soft"
                  onClick={() => attemptNavigation(openRoutingView)}
                />
              </div>
            </div>
            <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
              <RoundExpandableSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('mail.searchProviders', {
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
                  t(`mail.columns${count}`, { defaultValue: `${count} columns` })
                }
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('mail.addProvider', { defaultValue: 'Add provider' })}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openMailPanel(null))}
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
                {t('mail.total', { defaultValue: 'Total' })}{' '}
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
                {t('mail.statusEnabled', { defaultValue: 'Enabled' })}{' '}
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
                {t('mail.statusDisabled', { defaultValue: 'Disabled' })}{' '}
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
                {t('mail.keyConfigured', { defaultValue: 'Configured' })}{' '}
                <span className="tabular-nums font-semibold">({stats.configured})</span>
              </span>
            </Button>
          </div>
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
            <Select
              value={primarySort}
              onValueChange={(value) => handlePrimarySortChange(value as MailProviderSortField)}
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
