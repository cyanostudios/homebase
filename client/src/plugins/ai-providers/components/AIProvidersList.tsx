import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
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
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { ListFilterChipsToggle } from '@/core/ui/ListFilterChipsToggle';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import { usePersistedToolbarCollapsed } from '@/core/ui/usePersistedToolbarCollapsed';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { useAIProviders } from '../hooks/useAIProviders';
import type { ProviderSettings } from '../types/aiProviders';
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

import { AIProviderView } from './AIProviderView';
import { AIProvidersListTable } from './AIProvidersListTable';
import { AIProvidersRouting, type AIProvidersRoutingCategory } from './AIProvidersRouting';
import { AIProvidersSettingsForm } from './AIProvidersSettingsForm';
import { AIProvidersStatisticsView } from './AIProvidersStatisticsView';

const AI_PROVIDERS_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.ai-providers.toolbar.filtersVisible';

const SORT_FIELD_OPTIONS: { value: AIProviderSortField; labelKey: string }[] = [
  { value: 'providerKey', labelKey: 'aiProviders.colProvider' },
  { value: 'status', labelKey: 'aiProviders.colStatus' },
  { value: 'defaultModel', labelKey: 'aiProviders.defaultModel' },
  { value: 'updatedAt', labelKey: 'common.updated' },
];

let pendingPreviewProviderKey: string | null = null;

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
  const { attemptNavigation } = useGlobalNavigationGuard();

  const {
    providers,
    loading,
    openAIProviderPanel,
    openAIProviderForView,
    closeAIProviderPanel,
    saveAIProvider,
    isAIProvidersPanelOpen,
    panelMode,
    currentAIProvider,
    aiProvidersContentView,
    openRoutingView,
    closeRoutingView,
  } = useAIProviders();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openAIProviderPanel(null)),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const { searchTerm, setSearchTerm } = usePersistedListSearch('ai-providers');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('aiProviders.searchPlaceholder', { count: providers.length }),
  });

  const [primarySort, setPrimarySort] = useState<AIProviderSortField>('providerKey');
  const [sortOrder, setSortOrder] = useState<AIProviderSortOrder>('asc');
  const [activeFilters, setActiveFilters] = useState<AIProvidersListFilterSelection>([]);
  const [routingCategory, setRoutingCategory] = useState<AIProvidersRoutingCategory>('global');
  const [previewProvider, setPreviewProvider] = useState<ProviderSettings | null>(null);
  const { toolbarCollapsed, toggleToolbarCollapsed } = usePersistedToolbarCollapsed();
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    AI_PROVIDERS_FILTERS_VISIBLE_STORAGE_KEY,
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
    showDesktopSplit && isAIProvidersPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isAIProvidersPanelOpen && panelMode === 'view' && currentAIProvider != null;
  const detailProvider = inlinePanelView ? currentAIProvider : previewProvider;
  const activeListProviderId =
    (inlineForm || inlinePanelView) && currentAIProvider != null
      ? currentAIProvider.providerKey
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
    if (!showDesktopSplit || !isAIProvidersPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentAIProvider) {
      setPreviewProvider(currentAIProvider);
    }
  }, [showDesktopSplit, isAIProvidersPanelOpen, panelMode, currentAIProvider]);

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

  const handleTableSort = useCallback(
    (field: AIProviderSortField) => {
      const next = nextAIProviderTableSort(primarySort, sortOrder, field);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const handleOpenForView = (provider: ProviderSettings) => {
    pendingPreviewProviderKey = provider.providerKey;
    attemptNavigation(() => openAIProviderForView(provider));
  };

  const handleRowActivate = (provider: ProviderSettings) => {
    if (isCompactViewport) {
      handleOpenForView(provider);
      return;
    }
    if (
      isAIProvidersPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeAIProviderPanel();
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
    closeAIProviderPanel();
  }, [closeAIProviderPanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Record<string, unknown>) => {
      const ok = await saveAIProvider(data);
      return ok;
    },
    [saveAIProvider],
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
        label: t('aiProviders.filterAll', { defaultValue: 'Total' }),
        count: stats.total,
        onClick: () => setActiveFilters([]),
      },
      {
        key: 'enabled',
        active: isFilterActive('enabled'),
        icon: CheckCircle2,
        label: t('aiProviders.statusEnabled'),
        count: stats.enabled,
        onClick: () => toggleFilter('enabled'),
      },
      {
        key: 'disabled',
        active: isFilterActive('disabled'),
        icon: XCircle,
        label: t('aiProviders.statusDisabled'),
        count: stats.disabled,
        onClick: () => toggleFilter('disabled'),
      },
      {
        key: 'configured',
        active: isFilterActive('configured'),
        icon: Key,
        label: t('aiProviders.keyConfigured'),
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
          aria-label={t('aiProviders.sort', { defaultValue: 'Sort' })}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('aiProviders.sort', { defaultValue: 'Sort' })}</span>
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
          onValueChange={(value) => handlePrimarySortChange(value as AIProviderSortField)}
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
            ? t('aiProviders.sortAsc', { defaultValue: 'Ascending' })
            : t('aiProviders.sortDesc', { defaultValue: 'Descending' })}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as AIProviderSortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('aiProviders.sortAsc', { defaultValue: 'Ascending' })}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('aiProviders.sortDesc', { defaultValue: 'Descending' })}
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
                    ? t('aiProviders.expandToolbar')
                    : t('aiProviders.collapseToolbar')
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
                aria-controls="ai-providers-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  const detailColumnOpen = Boolean(detailProvider || inlineForm);

  if (aiProvidersContentView === 'routing') {
    return (
      <div className="plugin-ai-providers flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
        <div className="px-4 py-4 md:px-6">
          <AIProvidersRouting
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
          'plugin-ai-providers flex min-h-0 flex-1 flex-col',
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
                  id="ai-providers-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
                      {t('nav.ai-providers', { defaultValue: 'AI Providers' })}
                    </h2>
                    <ExpandableIconButton
                      icon={Route}
                      label={t('aiProviders.routing.open', { defaultValue: 'Routing' })}
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
                      placeholder={t('aiProviders.searchPlaceholder', { count: providers.length })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('aiProviders.addProvider')}
                      variant={detailColumnOpen ? 'soft' : 'primary'}
                      onClick={() => attemptNavigation(() => openAIProviderPanel(null))}
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
                    message={searchTerm.trim() ? t('aiProviders.noMatch') : t('aiProviders.noYet')}
                    createLabel={!searchTerm.trim() ? t('aiProviders.addProvider') : undefined}
                    onCreate={
                      !searchTerm.trim()
                        ? () => attemptNavigation(() => openAIProviderPanel(null))
                        : undefined
                    }
                  />
                ) : (
                  <AIProvidersListTable
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

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('aiProviders.quickContext.title', {
                  defaultValue: 'Provider details',
                })}
                aria-live="polite"
              >
                {inlineForm ? (
                  <AIProvidersSettingsForm
                    ref={inlineFormRef}
                    currentAIProvider={currentAIProvider}
                    onSave={handleInlineFormOnSave}
                    onCancel={closeAIProviderPanel}
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
                  <AIProviderView aiProvider={detailProvider} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <AIProvidersStatisticsView />
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
