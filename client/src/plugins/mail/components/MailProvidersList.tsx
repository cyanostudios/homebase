import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  History,
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

import { useMail } from '../hooks/useMail';
import type { MailProviderSettings } from '../types/mail';
import {
  compareMailProviders,
  nextMailProviderTableSort,
  type MailProviderSortField,
  type MailProviderSortOrder,
} from '../utils/mailListSort';
import {
  mailProviderMatchesListFilters,
  toggleMailProvidersListFilter,
  type MailProvidersListFilter,
  type MailProvidersListFilterSelection,
} from '../utils/mailProvidersListFilter';

import { MailProviderView } from './MailProviderView';
import { MailProvidersListTable } from './MailProvidersListTable';
import { MailProvidersRouting, type MailProvidersRoutingCategory } from './MailProvidersRouting';
import { MailProvidersStatisticsView } from './MailProvidersStatisticsView';
import { MailSettingsForm } from './MailSettingsForm';

const MAIL_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.mail.toolbar.filtersVisible';

const SORT_FIELD_OPTIONS: { value: MailProviderSortField; labelKey: string }[] = [
  { value: 'providerKey', labelKey: 'mail.colProvider' },
  { value: 'status', labelKey: 'mail.colStatus' },
  { value: 'capability', labelKey: 'mail.capability' },
  { value: 'updatedAt', labelKey: 'common.updated' },
];

let pendingPreviewProviderKey: string | null = null;

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
  const { attemptNavigation } = useGlobalNavigationGuard();

  const {
    providers,
    loading,
    isMailPanelOpen,
    panelMode,
    currentMail,
    closeMailPanel,
    saveMail,
    openMailPanel,
    openMailForView,
    openHistoryView,
    openRoutingView,
    closeRoutingView,
    mailContentView,
  } = useMail();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openMailPanel(null)),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const { searchTerm, setSearchTerm } = usePersistedListSearch('mail-providers');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('mail.searchProviders', {
      defaultValue: 'Search providers ({{count}})',
      count: providers.length,
    }),
  });

  const [routingCategory, setRoutingCategory] = useState<MailProvidersRoutingCategory>('global');
  const [primarySort, setPrimarySort] = useState<MailProviderSortField>('providerKey');
  const [sortOrder, setSortOrder] = useState<MailProviderSortOrder>('asc');
  const [activeFilters, setActiveFilters] = useState<MailProvidersListFilterSelection>([]);
  const [previewProvider, setPreviewProvider] = useState<MailProviderSettings | null>(null);
  const { toolbarCollapsed, toggleToolbarCollapsed } = usePersistedToolbarCollapsed();
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    MAIL_FILTERS_VISIBLE_STORAGE_KEY,
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
    showDesktopSplit && isMailPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isMailPanelOpen && panelMode === 'view' && currentMail != null;
  const detailProvider = inlinePanelView ? currentMail : previewProvider;
  const activeListProviderId =
    (inlineForm || inlinePanelView) && currentMail != null
      ? currentMail.providerKey
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
    if (!showDesktopSplit || !isMailPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentMail) {
      setPreviewProvider(currentMail);
    }
  }, [showDesktopSplit, isMailPanelOpen, panelMode, currentMail]);

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

  const handleTableSort = useCallback(
    (field: MailProviderSortField) => {
      const next = nextMailProviderTableSort(primarySort, sortOrder, field);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const handleOpenForView = (provider: MailProviderSettings) => {
    pendingPreviewProviderKey = provider.providerKey;
    attemptNavigation(() => openMailForView(provider));
  };

  const handleRowActivate = (provider: MailProviderSettings) => {
    if (isCompactViewport) {
      handleOpenForView(provider);
      return;
    }
    if (
      isMailPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeMailPanel();
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
    closeMailPanel();
  }, [closeMailPanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Record<string, unknown>) => {
      const ok = await saveMail(data);
      return ok;
    },
    [saveMail],
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
        label: t('mail.total', { defaultValue: 'Total' }),
        count: stats.total,
        onClick: () => setActiveFilters([]),
      },
      {
        key: 'enabled',
        active: isFilterActive('enabled'),
        icon: CheckCircle2,
        label: t('mail.statusEnabled', { defaultValue: 'Enabled' }),
        count: stats.enabled,
        onClick: () => toggleFilter('enabled'),
      },
      {
        key: 'disabled',
        active: isFilterActive('disabled'),
        icon: XCircle,
        label: t('mail.statusDisabled', { defaultValue: 'Disabled' }),
        count: stats.disabled,
        onClick: () => toggleFilter('disabled'),
      },
      {
        key: 'configured',
        active: isFilterActive('configured'),
        icon: Key,
        label: t('mail.keyConfigured', { defaultValue: 'Configured' }),
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
          aria-label={t('mail.sort', { defaultValue: 'Sort' })}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('mail.sort', { defaultValue: 'Sort' })}</span>
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
          onValueChange={(value) => handlePrimarySortChange(value as MailProviderSortField)}
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
            ? t('mail.sortAsc', { defaultValue: 'Ascending' })
            : t('mail.sortDesc', { defaultValue: 'Descending' })}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as MailProviderSortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('mail.sortAsc', { defaultValue: 'Ascending' })}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('mail.sortDesc', { defaultValue: 'Descending' })}
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
                    ? t('mail.expandToolbar', { defaultValue: 'Show toolbar' })
                    : t('mail.collapseToolbar', { defaultValue: 'Hide toolbar' })
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
                aria-controls="mail-providers-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  const detailColumnOpen = Boolean(detailProvider || inlineForm);

  if (mailContentView === 'routing') {
    return (
      <div className="plugin-mail flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
        <div className="px-4 py-4 md:px-6">
          <MailProvidersRouting
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
          'plugin-mail flex min-h-0 flex-1 flex-col',
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
                  id="mail-providers-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
                      {t('nav.mail', { defaultValue: 'Mail' })}
                    </h2>
                    <ExpandableIconButton
                      icon={History}
                      label={t('mail.historyTitle', { defaultValue: 'Mail history' })}
                      variant="soft"
                      alwaysExpanded
                      onClick={() => attemptNavigation(openHistoryView)}
                    />
                    <ExpandableIconButton
                      icon={Route}
                      label={t('mail.routing.open', { defaultValue: 'Routing' })}
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
                      placeholder={t('mail.searchProviders', {
                        defaultValue: 'Search providers ({{count}})',
                        count: providers.length,
                      })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('mail.addProvider', { defaultValue: 'Add provider' })}
                      variant={detailColumnOpen ? 'soft' : 'primary'}
                      onClick={() => attemptNavigation(() => openMailPanel(null))}
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
                        ? t('mail.noMatch', { defaultValue: 'No matching providers' })
                        : t('mail.noYet', { defaultValue: 'No providers yet — add SMTP or Resend' })
                    }
                    createLabel={!searchTerm.trim() ? t('mail.addProvider') : undefined}
                    onCreate={
                      !searchTerm.trim()
                        ? () => attemptNavigation(() => openMailPanel(null))
                        : undefined
                    }
                  />
                ) : (
                  <MailProvidersListTable
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

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('mail.quickContext.title', { defaultValue: 'Provider details' })}
                aria-live="polite"
              >
                {inlineForm ? (
                  <MailSettingsForm
                    ref={inlineFormRef}
                    currentMail={currentMail}
                    onSave={handleInlineFormOnSave}
                    onCancel={closeMailPanel}
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
                  <MailProviderView mail={detailProvider} />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <MailProvidersStatisticsView />
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
