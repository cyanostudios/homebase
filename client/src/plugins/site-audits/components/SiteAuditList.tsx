/**
 * Contacts-class mail-layout list shell — see docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md
 * and client/src/plugins/contacts/components/ContactList.tsx. No Settings in etapp 1
 * (see docs/ai/design/SITE_AUDITS_UX.md "Non-goals in UI").
 */
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  ChevronDown,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { nextListTableSort } from '@/core/list/listViewMode';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { InlinePanelFormActions } from '@/core/ui/InlinePanelFormActions';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { useSiteAudits } from '../hooks/useSiteAudits';
import type { SiteAudit } from '../types/site-audits';
import {
  compareSiteAuditsByField,
  isSiteAuditAscDefaultField,
  type SiteAuditSortField,
  type SiteAuditSortOrder,
} from '../utils/siteAuditListSort';

import { SiteAuditForm } from './SiteAuditForm';
import { SiteAuditListTable } from './SiteAuditListTable';
import { SiteAuditsStatisticsView } from './SiteAuditsStatisticsView';
import { SiteAuditView } from './SiteAuditView';

type SortField = SiteAuditSortField;
type SortOrder = SiteAuditSortOrder;

let pendingQuickContextSiteAuditId: string | null = null;

export const SiteAuditList: React.FC = () => {
  const { t } = useTranslation();
  const {
    siteAudits,
    openSiteAuditPanel,
    openSiteAuditForView,
    deleteSiteAudits,
    isSiteAuditPanelOpen,
    panelMode,
    currentSiteAudit,
    saveSiteAudit,
    closeSiteAuditPanel,
    validationErrors,
  } = useSiteAudits();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openSiteAuditPanel(null)),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;
  const { searchTerm, setSearchTerm } = usePersistedListSearch('site-audits');

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('siteAudits.searchPlaceholder', { count: siteAudits.length }),
  });

  const [primarySort, setPrimarySort] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [previewItem, setPreviewItem] = useState<SiteAudit | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const restoredPendingItemRef = useRef(false);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);

  const inlineForm =
    showDesktopSplit && isSiteAuditPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isSiteAuditPanelOpen && panelMode === 'view' && currentSiteAudit !== null;
  const detailItem = inlinePanelView ? currentSiteAudit : previewItem;
  const activeListItemId =
    (inlineForm || inlinePanelView) && currentSiteAudit !== null
      ? currentSiteAudit.id
      : (previewItem?.id ?? null);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isSiteAuditAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isSiteAuditAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = siteAudits.filter((item) => {
      if (!needle) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(needle) ||
        item.url.toLowerCase().includes(needle) ||
        (item.competitorUrl || '').toLowerCase().includes(needle)
      );
    });
    return [...filtered].sort((a, b) => compareSiteAuditsByField(a, b, primarySort, sortOrder));
  }, [siteAudits, searchTerm, primarySort, sortOrder]);

  const visibleIds = useMemo(
    () => filteredAndSorted.map((item) => String(item.id)),
    [filteredAndSorted],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isSelected = useCallback((id: string) => selectedSet.has(id), [selectedSet]);
  const selectedCount = selectedIds.length;

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const mergeIntoSelection = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id)),
    [visibleIds, selectedSet],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection,
      toggleOne,
    });

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearSelection();
    } else {
      setSelectedIds(visibleIds);
    }
  };

  useEffect(() => {
    if (restoredPendingItemRef.current || !pendingQuickContextSiteAuditId) {
      return;
    }
    const restored = siteAudits.find((item) => String(item.id) === pendingQuickContextSiteAuditId);
    if (restored) {
      setPreviewItem(restored);
      restoredPendingItemRef.current = true;
      pendingQuickContextSiteAuditId = null;
    }
  }, [siteAudits]);

  useEffect(() => {
    if (!previewItem) {
      return;
    }
    const next = siteAudits.find((item) => String(item.id) === String(previewItem.id));
    if (!next) {
      setPreviewItem(null);
      return;
    }
    if (next !== previewItem) {
      setPreviewItem(next);
    }
  }, [siteAudits, previewItem]);

  useEffect(() => {
    if (!showDesktopSplit || !isSiteAuditPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentSiteAudit) {
      setPreviewItem(currentSiteAudit);
    }
  }, [showDesktopSplit, isSiteAuditPanelOpen, panelMode, currentSiteAudit]);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    setDeleting(true);
    setBulkDeleteError(null);
    try {
      await deleteSiteAudits(selectedIds);
      clearSelection();
      setBulkDeleteError(null);
      setShowBulkDeleteModal(false);
    } catch (err) {
      console.error('Bulk delete failed:', err);
      const message = err instanceof Error ? err.message.trim() : '';
      setBulkDeleteError(
        message && message !== 'Request failed' ? message : t('siteAudits.errors.deleteFailed'),
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenForView = (item: SiteAudit) => {
    pendingQuickContextSiteAuditId = String(item.id);
    attemptNavigation(() => openSiteAuditForView(item));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (item: SiteAudit) => {
    if (isCompactViewport) {
      handleOpenForView(item);
      return;
    }
    if (selectionMode) {
      toggleOne(String(item.id));
      return;
    }
    if (
      isSiteAuditPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeSiteAuditPanel();
        setPreviewItem(item);
      });
      return;
    }
    setPreviewItem((current) => (current && String(current.id) === String(item.id) ? null : item));
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    closeSiteAuditPanel();
  }, [closeSiteAuditPanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Parameters<typeof saveSiteAudit>[0]) => {
      return saveSiteAudit(data);
    },
    [saveSiteAudit],
  );

  const inlineFormHasBlockingErrors = validationErrors.some(
    (e) => !String(e?.message || '').includes('Warning'),
  );

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    return [
      {
        key: 'delete',
        label: t('common.delete'),
        icon: Trash2,
        disabled,
        tone: 'destructive',
        onClick: () => {
          setBulkDeleteError(null);
          setShowBulkDeleteModal(true);
        },
      },
    ];
  }, [selectedCount, t]);

  const headerDropdownTriggerClass =
    'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

  const headerDropdownTriggerDangerClass =
    'gap-1.5 border-0 bg-red-600/10 px-3.5 text-sm font-extrabold text-red-700 shadow-none hover:bg-red-600 hover:text-white dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white';

  const sortFieldOptions: { value: SortField; label: string }[] = [
    { value: 'name', label: t('siteAudits.table.name') },
    { value: 'lastScore', label: t('siteAudits.scoreLabel') },
    { value: 'lastRunAt', label: t('siteAudits.lastRunLabel') },
    { value: 'updatedAt', label: t('common.updated') },
    { value: 'createdAt', label: t('common.created') },
  ];

  const primarySortLabel =
    sortFieldOptions.find((option) => option.value === primarySort)?.label ??
    sortFieldOptions[0].label;

  const renderSortDropdown = (triggerClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('siteAudits.sort')}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('siteAudits.sort')}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[14rem] rounded-xl border-border/50 shadow-xl"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {primarySortLabel}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={primarySort}
          onValueChange={(value) => handlePrimarySortChange(value as SortField)}
        >
          {sortFieldOptions.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="rounded-md text-xs"
              onSelect={(event) => event.preventDefault()}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {sortOrder === 'asc' ? t('siteAudits.sortAsc') : t('siteAudits.sortDesc')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as SortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('siteAudits.sortAsc')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('siteAudits.sortDesc')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderSelectControls = (triggerClassName: string) => {
    if (filteredAndSorted.length === 0) {
      return null;
    }

    if (!selectionMode) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('common.select')}
          aria-pressed={false}
          onClick={handleEnterSelectionMode}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>{t('common.select')}</span>
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(headerDropdownTriggerDangerClass, triggerClassName)}
        aria-label={t('common.clear')}
        aria-pressed={true}
        onClick={handleExitSelectionMode}
      >
        <XCircle className="h-3.5 w-3.5" />
        <span>{t('common.clear')}</span>
      </Button>
    );
  };

  const renderBulkActionBar = (className?: string) =>
    selectionMode ? (
      <BulkActionRoundBar
        selectedCount={selectedCount}
        actions={bulkRoundActions}
        size="xs"
        className={cn('gap-1.5', className)}
      />
    ) : null;

  return (
    <div
      className={cn(
        'plugin-site-audits flex min-h-0 flex-1 flex-col',
        PLUGIN_PAGE_LIST_SHELL_CLASS,
        showDesktopSplit
          ? 'overflow-hidden px-3 pb-3 pt-3 md:px-3 md:pb-3 md:pt-3'
          : 'overflow-y-auto md:pt-3',
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="relative hidden shrink-0 md:block">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.site-audits')}</h2>
              {renderSortDropdown('h-11 rounded-full')}
              {renderSelectControls('h-11 rounded-full')}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <RoundExpandableSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('siteAudits.searchPlaceholder', { count: siteAudits.length })}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('siteAudits.add')}
                variant="soft"
                onClick={() => attemptNavigation(() => openSiteAuditPanel(null))}
              />
            </div>
          </div>
          {renderBulkActionBar('py-3')}
        </div>

        {selectionMode ? (
          <div className="shrink-0 py-3 md:hidden">{renderBulkActionBar()}</div>
        ) : null}

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => {
            setBulkDeleteError(null);
            setShowBulkDeleteModal(false);
          }}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="site-audits"
          isLoading={deleting}
          warningMessage={bulkDeleteError ?? undefined}
        />

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
              {filteredAndSorted.length === 0 ? (
                <ListEmptyState
                  message={searchTerm ? t('siteAudits.noMatch') : t('siteAudits.noYet')}
                  createLabel={!searchTerm ? t('siteAudits.add') : undefined}
                  onCreate={
                    !searchTerm
                      ? () => attemptNavigation(() => openSiteAuditPanel(null))
                      : undefined
                  }
                />
              ) : (
                <SiteAuditListTable
                  items={filteredAndSorted}
                  primarySort={primarySort}
                  sortOrder={sortOrder}
                  onSort={handleTableSort}
                  isSelected={isSelected}
                  onRowClick={handleRowActivate}
                  onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                  onCheckboxChange={onVisibleRowCheckboxChange}
                  allVisibleSelected={allVisibleSelected}
                  onHeaderCheckboxChange={handleHeaderCheckboxChange}
                  selectionEnabled={selectionMode}
                  activeItemId={activeListItemId}
                />
              )}

              <ListFooterBar
                meta={
                  <>
                    {t('siteAudits.showingOf', {
                      shown: filteredAndSorted.length,
                      total: siteAudits.length,
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
              aria-label={t('siteAudits.quickContextTitle')}
              aria-live="polite"
            >
              {inlineForm ? (
                <SiteAuditForm
                  ref={inlineFormRef}
                  currentSiteAudit={currentSiteAudit}
                  onSave={handleInlineFormOnSave}
                  onCancel={closeSiteAuditPanel}
                  stacked
                  headerTrailing={
                    <InlinePanelFormActions
                      mode={panelMode === 'edit' ? 'edit' : 'create'}
                      hasBlockingErrors={inlineFormHasBlockingErrors}
                      onClose={handleInlineFormClose}
                      onSave={() => {
                        void handleInlineFormSave();
                      }}
                      t={t}
                      className="flex shrink-0 items-center gap-1"
                    />
                  }
                />
              ) : detailItem ? (
                <SiteAuditView item={detailItem} stacked />
              ) : (
                <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                  <SiteAuditsStatisticsView />
                </Card>
              )}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
};
