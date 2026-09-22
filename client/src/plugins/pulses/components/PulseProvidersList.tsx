import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  CheckCircle2,
  ChevronDown,
  Key,
  LayoutGrid,
  Menu,
  Plus,
  Route,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { InlinePanelFormActions } from '@/core/ui/InlinePanelFormActions';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFilterChipsToggle } from '@/core/ui/ListFilterChipsToggle';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import { usePersistedToolbarCollapsed } from '@/core/ui/usePersistedToolbarCollapsed';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { usePulses } from '../hooks/usePulses';
import type { PulseProviderSettings } from '../types/pulse';
import {
  comparePulseProviders,
  nextPulseProviderTableSort,
  type PulseProviderSortField,
  type PulseProviderSortOrder,
} from '../utils/pulseListSort';
import {
  pulseProviderMatchesListFilters,
  togglePulseProvidersListFilter,
  type PulseProvidersListFilter,
  type PulseProvidersListFilterSelection,
} from '../utils/pulseProvidersListFilter';

import { PulseProviderView } from './PulseProviderView';
import { PulseProvidersListTable } from './PulseProvidersListTable';
import { PulseProvidersRouting, type PulseProvidersRoutingCategory } from './PulseProvidersRouting';
import { PulseProvidersStatisticsView } from './PulseProvidersStatisticsView';
import { PulseSettingsForm } from './PulseSettingsForm';

const PULSES_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.pulses.toolbar.filtersVisible';

const SORT_FIELD_OPTIONS: { value: PulseProviderSortField; labelKey: string }[] = [
  { value: 'providerKey', labelKey: 'pulses.colProvider' },
  { value: 'status', labelKey: 'pulses.colStatus' },
  { value: 'capability', labelKey: 'pulses.capability' },
  { value: 'updatedAt', labelKey: 'common.updated' },
];

let pendingPreviewProviderKey: string | null = null;

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
  const { attemptNavigation } = useGlobalNavigationGuard();

  const {
    providers,
    loading,
    openPulsePanel,
    openPulseForView,
    closePulsePanel,
    savePulse,
    isPulsesPanelOpen,
    panelMode,
    currentPulse,
    openHistoryView,
    openRoutingView,
    closeRoutingView,
    pulsesContentView,
  } = usePulses();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openPulsePanel(null)),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const { searchTerm, setSearchTerm } = usePersistedListSearch('pulses-providers');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('pulses.searchProviders', {
      defaultValue: 'Search providers ({{count}})',
      count: providers.length,
    }),
  });

  const [routingCategory, setRoutingCategory] = useState<PulseProvidersRoutingCategory>('global');
  const [primarySort, setPrimarySort] = useState<PulseProviderSortField>('providerKey');
  const [sortOrder, setSortOrder] = useState<PulseProviderSortOrder>('asc');
  const [activeFilters, setActiveFilters] = useState<PulseProvidersListFilterSelection>([]);
  const [previewProvider, setPreviewProvider] = useState<PulseProviderSettings | null>(null);
  const { toolbarCollapsed, toggleToolbarCollapsed } = usePersistedToolbarCollapsed();
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    PULSES_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const restoredPendingProviderRef = useRef(false);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inlineForm =
    showDesktopSplit && isPulsesPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isPulsesPanelOpen && panelMode === 'view' && currentPulse != null;
  const detailProvider = inlinePanelView ? currentPulse : previewProvider;
  const activeListProviderId =
    (inlineForm || inlinePanelView) && currentPulse != null
      ? currentPulse.providerKey
      : (previewProvider?.providerKey ?? null);

  const updateToolbarToggleBox = useCallback(() => {
    const el = pageShellRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const sidebarToggle = document.querySelector<HTMLElement>('[aria-controls="left-sidebar-nav"]');
    const sidebarTop = sidebarToggle?.getBoundingClientRect().top;
    setToolbarToggleBox({
      top: typeof sidebarTop === 'number' ? sidebarTop : rect.top + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    updateToolbarToggleBox();
    window.addEventListener('resize', updateToolbarToggleBox);
    const scrollParent = pageShellRef.current?.closest('.overflow-y-auto, .overflow-auto');
    scrollParent?.addEventListener('scroll', updateToolbarToggleBox, { passive: true });
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateToolbarToggleBox) : null;
    if (pageShellRef.current && ro) {
      ro.observe(pageShellRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateToolbarToggleBox);
      scrollParent?.removeEventListener('scroll', updateToolbarToggleBox);
      ro?.disconnect();
    };
  }, [updateToolbarToggleBox]);

  useEffect(() => {
    if (restoredPendingProviderRef.current || !pendingPreviewProviderKey) {
      return;
    }
    const restored = providers.find(
      (provider) => provider.providerKey === pendingPreviewProviderKey,
    );
    if (restored) {
      setPreviewProvider(restored);
      restoredPendingProviderRef.current = true;
      pendingPreviewProviderKey = null;
    }
  }, [providers]);

  useEffect(() => {
    if (!previewProvider) {
      return;
    }
    const next = providers.find((provider) => provider.providerKey === previewProvider.providerKey);
    if (!next) {
      setPreviewProvider(null);
      return;
    }
    if (next !== previewProvider) {
      setPreviewProvider(next);
    }
  }, [providers, previewProvider]);

  useEffect(() => {
    if (!showDesktopSplit || !isPulsesPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentPulse) {
      setPreviewProvider(currentPulse);
    }
  }, [showDesktopSplit, isPulsesPanelOpen, panelMode, currentPulse]);

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

  const handleTableSort = useCallback(
    (field: PulseProviderSortField) => {
      const next = nextPulseProviderTableSort(primarySort, sortOrder, field);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const handleOpenForView = (provider: PulseProviderSettings) => {
    pendingPreviewProviderKey = provider.providerKey;
    attemptNavigation(() => openPulseForView(provider));
  };

  const handleRowActivate = (provider: PulseProviderSettings) => {
    if (isCompactViewport) {
      handleOpenForView(provider);
      return;
    }
    if (
      isPulsesPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closePulsePanel();
        setPreviewProvider(provider);
      });
      return;
    }
    setPreviewProvider((current) =>
      current && current.providerKey === provider.providerKey ? null : provider,
    );
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    closePulsePanel();
  }, [closePulsePanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Record<string, unknown>) => {
      const ok = await savePulse(data);
      return ok;
    },
    [savePulse],
  );

  const headerDropdownTriggerClass =
    'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

  const renderFilterChips = () => {
    const chips: Array<{
      key: string;
      active: boolean;
      icon: typeof LayoutGrid;
      label: string;
      count: number;
      onClick: () => void;
    }> = [
      {
        key: 'all',
        active: activeFilters.length === 0,
        icon: LayoutGrid,
        label: t('pulses.total', { defaultValue: 'Total' }),
        count: stats.total,
        onClick: () => setActiveFilters([]),
      },
      {
        key: 'enabled',
        active: isFilterActive('enabled'),
        icon: CheckCircle2,
        label: t('pulses.statusEnabled', { defaultValue: 'Enabled' }),
        count: stats.enabled,
        onClick: () => toggleFilter('enabled'),
      },
      {
        key: 'disabled',
        active: isFilterActive('disabled'),
        icon: XCircle,
        label: t('pulses.statusDisabled', { defaultValue: 'Disabled' }),
        count: stats.disabled,
        onClick: () => toggleFilter('disabled'),
      },
      {
        key: 'configured',
        active: isFilterActive('configured'),
        icon: Key,
        label: t('pulses.keyConfigured', { defaultValue: 'Configured' }),
        count: stats.configured,
        onClick: () => toggleFilter('configured'),
      },
    ];

    return (
      <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <Button
              key={chip.key}
              type="button"
              variant="ghost"
              size="sm"
              onClick={chip.onClick}
              className={cn(chip.active ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>
                {chip.label} <span className="tabular-nums font-semibold">({chip.count})</span>
              </span>
            </Button>
          );
        })}
      </div>
    );
  };

  const primarySortLabel =
    SORT_FIELD_OPTIONS.find((option) => option.value === primarySort)?.labelKey ??
    SORT_FIELD_OPTIONS[0].labelKey;

  const renderSortDropdown = (triggerClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('pulses.sort', { defaultValue: 'Sort' })}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('pulses.sort', { defaultValue: 'Sort' })}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[14rem] rounded-xl border-border/50 shadow-xl"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {t(primarySortLabel)}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={primarySort}
          onValueChange={(value) => handlePrimarySortChange(value as PulseProviderSortField)}
        >
          {SORT_FIELD_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="rounded-md text-xs"
              onSelect={(event) => event.preventDefault()}
            >
              {t(option.labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {sortOrder === 'asc'
            ? t('pulses.sortAsc', { defaultValue: 'Ascending' })
            : t('pulses.sortDesc', { defaultValue: 'Descending' })}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as PulseProviderSortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('pulses.sortAsc', { defaultValue: 'Ascending' })}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('pulses.sortDesc', { defaultValue: 'Descending' })}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const toolbarEdgeToggle =
    typeof document !== 'undefined' && toolbarToggleBox
      ? createPortal(
          <div
            className="pointer-events-none fixed z-40 hidden justify-center md:flex"
            style={{
              top: toolbarToggleBox.top,
              left: toolbarToggleBox.left,
              width: toolbarToggleBox.width,
            }}
          >
            <div className="pointer-events-auto">
              <RoundIconLabelButton
                icon={Menu}
                label={
                  toolbarCollapsed
                    ? t('pulses.expandToolbar', { defaultValue: 'Show toolbar' })
                    : t('pulses.collapseToolbar', { defaultValue: 'Hide toolbar' })
                }
                variant={toolbarCollapsed ? 'primary' : 'secondary'}
                size="xs"
                expandOnHover={false}
                className={
                  toolbarCollapsed
                    ? undefined
                    : 'bg-white text-primary shadow-sm hover:bg-primary hover:text-primary-foreground dark:bg-white dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground'
                }
                aria-expanded={!toolbarCollapsed}
                aria-controls="pulses-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  const detailColumnOpen = Boolean(detailProvider || inlineForm);

  if (pulsesContentView === 'routing') {
    return (
      <div className="plugin-pulses flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
        <div className="px-4 py-4 md:px-6">
          <PulseProvidersRouting
            selectedCategory={routingCategory}
            onSelectedCategoryChange={setRoutingCategory}
            onClose={closeRoutingView}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {toolbarEdgeToggle}
      <div
        ref={pageShellRef}
        className={cn(
          'plugin-pulses flex min-h-0 flex-1 flex-col',
          PLUGIN_PAGE_LIST_SHELL_CLASS,
          showDesktopSplit
            ? 'overflow-hidden px-3 pb-3 pt-3 md:px-3 md:pb-3 md:pt-3'
            : 'overflow-y-auto md:pt-3',
        )}
      >
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            showDesktopSplit && toolbarCollapsed ? 'gap-0' : 'gap-3',
          )}
        >
          <div className="relative hidden shrink-0 md:block">
            <div
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                toolbarCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
              )}
              aria-hidden={toolbarCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  id="pulses-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
                      {t('nav.pulses', { defaultValue: 'Pulse' })}
                    </h2>
                    <ExpandableIconButton
                      icon={Bell}
                      label={t('pulses.historyTitle', { defaultValue: 'SMS history' })}
                      variant="soft"
                      alwaysExpanded
                      onClick={() => attemptNavigation(openHistoryView)}
                    />
                    <ExpandableIconButton
                      icon={Route}
                      label={t('pulses.routing.open', { defaultValue: 'Routing' })}
                      variant="soft"
                      alwaysExpanded
                      onClick={() => attemptNavigation(openRoutingView)}
                    />
                    {renderSortDropdown('h-11 rounded-full')}
                    <ListFilterChipsToggle
                      visible={filtersVisible}
                      onVisibleChange={setFiltersVisible}
                      className="h-11 rounded-full"
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RoundExpandableSearch
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder={t('pulses.searchProviders', {
                        defaultValue: 'Search providers ({{count}})',
                        count: providers.length,
                      })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('pulses.addProvider', { defaultValue: 'Add provider' })}
                      variant={detailColumnOpen ? 'soft' : 'primary'}
                      onClick={() => attemptNavigation(() => openPulsePanel(null))}
                    />
                  </div>
                </div>
                {filtersVisible ? (
                  <div
                    className={cn(
                      LIST_FILTER_AND_SORT_ROW_CLASS,
                      'pt-2',
                      toolbarCollapsed && 'pointer-events-none',
                    )}
                  >
                    {renderFilterChips()}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={cn(LIST_FILTER_AND_SORT_ROW_CLASS, 'shrink-0 md:hidden')}>
            {filtersVisible ? renderFilterChips() : null}
            <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
              <ListFilterChipsToggle
                visible={filtersVisible}
                onVisibleChange={setFiltersVisible}
                className="h-7 rounded-md"
              />
              {renderSortDropdown('h-7 rounded-md')}
            </div>
          </div>

          <div
            className={cn(
              'grid min-h-0 min-w-0 gap-2',
              showDesktopSplit
                ? 'flex-1 grid-cols-[minmax(220px,20%)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch'
                : 'grid-cols-1 items-start',
            )}
          >
            <div
              className={cn(
                'min-w-0',
                showDesktopSplit && 'h-full min-h-0 overflow-y-auto overscroll-contain',
              )}
            >
              <div className="flex min-w-0 flex-col gap-3">
                {loading && providers.length === 0 ? (
                  <div className="rounded-xl bg-white p-6 text-center text-sm text-muted-foreground shadow-sm dark:bg-slate-950">
                    {t('common.loading')}
                  </div>
                ) : filteredAndSorted.length === 0 ? (
                  <ListEmptyState
                    message={
                      searchTerm.trim()
                        ? t('pulses.noMatch', { defaultValue: 'No matching providers' })
                        : t('pulses.noYet', {
                            defaultValue: 'No providers yet — add Twilio or Mock',
                          })
                    }
                    createLabel={!searchTerm.trim() ? t('pulses.addProvider') : undefined}
                    onCreate={
                      !searchTerm.trim()
                        ? () => attemptNavigation(() => openPulsePanel(null))
                        : undefined
                    }
                  />
                ) : (
                  <PulseProvidersListTable
                    providers={filteredAndSorted}
                    primarySort={primarySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSort}
                    onRowClick={handleRowActivate}
                    providerTitle={(provider) => providerTitle(t, provider)}
                    activeProviderId={activeListProviderId}
                  />
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

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('pulses.quickContext.title', { defaultValue: 'Provider details' })}
                aria-live="polite"
              >
                {inlineForm ? (
                  <PulseSettingsForm
                    ref={inlineFormRef}
                    currentPulse={currentPulse}
                    onSave={handleInlineFormOnSave}
                    onCancel={closePulsePanel}
                    stacked
                    headerTrailing={
                      <InlinePanelFormActions
                        mode={panelMode === 'edit' ? 'edit' : 'create'}
                        hasBlockingErrors={false}
                        onClose={handleInlineFormClose}
                        onSave={() => {
                          void handleInlineFormSave();
                        }}
                        t={t}
                        className="flex shrink-0 items-center gap-1"
                      />
                    }
                  />
                ) : detailProvider ? (
                  <PulseProviderView pulse={detailProvider} />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <PulseProvidersStatisticsView />
                  </Card>
                )}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
