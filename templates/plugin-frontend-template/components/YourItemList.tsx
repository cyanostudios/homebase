/**
 * Contacts-class mail-layout list shell — see docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md
 * and client/src/plugins/contacts/components/ContactList.tsx.
 */
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  ChevronDown,
  Plus,
  Settings,
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
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { InlinePanelFormActions } from '@/core/ui/InlinePanelFormActions';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { useYourItems } from '../hooks/useYourItems';
import type { YourItem } from '../types/your-items';
import {
  compareYourItemsByField,
  isYourItemAscDefaultField,
  type YourItemSortField,
  type YourItemSortOrder,
} from '../utils/yourItemListSort';

import { YourItemForm } from './YourItemForm';
import { YourItemListTable } from './YourItemListTable';
import { YourItemsSettingsView } from './YourItemsSettingsView';
import { YourItemsStatisticsView } from './YourItemsStatisticsView';
import { YourItemView } from './YourItemView';

type SortField = YourItemSortField;
type SortOrder = YourItemSortOrder;

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'createdAt', label: 'Created' },
];

let pendingQuickContextItemId: string | null = null;

export const YourItemList: React.FC = () => {
  const { t } = useTranslation();
  const {
    yourItems,
    yourItemsContentView,
    openYourItemPanel,
    openYourItemForView,
    openYourItemsSettings,
    closeYourItemsSettingsView,
    deleteYourItems,
    isYourItemPanelOpen,
    panelMode,
    currentYourItem,
    saveYourItem,
    closeYourItemPanel,
    validationErrors,
  } = useYourItems();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openYourItemPanel(null)),
    onSettings: () => openYourItemsSettings(),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;
  const { searchTerm, setSearchTerm } = usePersistedListSearch('your-items');

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: 'Search by title or id…',
  });

  const [primarySort, setPrimarySort] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [previewItem, setPreviewItem] = useState<YourItem | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const restoredPendingItemRef = useRef(false);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);

  const inlineForm =
    showDesktopSplit && isYourItemPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isYourItemPanelOpen && panelMode === 'view' && currentYourItem != null;
  const detailItem = inlinePanelView ? currentYourItem : previewItem;
  const activeListItemId =
    (inlineForm || inlinePanelView) && currentYourItem != null
      ? currentYourItem.id
      : (previewItem?.id ?? null);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isYourItemAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isYourItemAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = yourItems.filter((item) => {
      if (!needle) {
        return true;
      }
      return (
        item.title.toLowerCase().includes(needle) || String(item.id).toLowerCase().includes(needle)
      );
    });
    return [...filtered].sort((a, b) => compareYourItemsByField(a, b, primarySort, sortOrder));
  }, [yourItems, searchTerm, primarySort, sortOrder]);

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
    if (restoredPendingItemRef.current || !pendingQuickContextItemId) {
      return;
    }
    const restored = yourItems.find((item) => String(item.id) === pendingQuickContextItemId);
    if (restored) {
      setPreviewItem(restored);
      restoredPendingItemRef.current = true;
      pendingQuickContextItemId = null;
    }
  }, [yourItems]);

  useEffect(() => {
    if (!previewItem) {
      return;
    }
    const next = yourItems.find((item) => String(item.id) === String(previewItem.id));
    if (!next) {
      setPreviewItem(null);
      return;
    }
    if (next !== previewItem) {
      setPreviewItem(next);
    }
  }, [yourItems, previewItem]);

  useEffect(() => {
    if (!showDesktopSplit || !isYourItemPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentYourItem) {
      setPreviewItem(currentYourItem);
    }
  }, [showDesktopSplit, isYourItemPanelOpen, panelMode, currentYourItem]);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteYourItems(selectedIds);
      clearSelection();
      setShowBulkDeleteModal(false);
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenForView = (item: YourItem) => {
    pendingQuickContextItemId = String(item.id);
    attemptNavigation(() => openYourItemForView(item));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (item: YourItem) => {
    if (isCompactViewport) {
      handleOpenForView(item);
      return;
    }
    if (selectionMode) {
      toggleOne(String(item.id));
      return;
    }
    if (
      isYourItemPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeYourItemPanel();
        setPreviewItem(item);
      });
      return;
    }
    setPreviewItem((current) =>
      current && String(current.id) === String(item.id) ? null : item,
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
    closeYourItemPanel();
  }, [closeYourItemPanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Parameters<typeof saveYourItem>[0]) => {
      return saveYourItem(data);
    },
    [saveYourItem],
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
        onClick: () => setShowBulkDeleteModal(true),
      },
    ];
  }, [selectedCount, t]);

  const headerDropdownTriggerClass =
    'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

  const headerDropdownTriggerDangerClass =
    'gap-1.5 border-0 bg-red-600/10 px-3.5 text-sm font-extrabold text-red-700 shadow-none hover:bg-red-600 hover:text-white dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white';

  const primarySortLabel =
    SORT_FIELD_OPTIONS.find((option) => option.value === primarySort)?.label ??
    SORT_FIELD_OPTIONS[0].label;

  const renderSortDropdown = (triggerClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label="Sort"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>Sort</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem] rounded-xl border-border/50 shadow-xl">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {primarySortLabel}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={primarySort}
          onValueChange={(value) => handlePrimarySortChange(value as SortField)}
        >
          {SORT_FIELD_OPTIONS.map((option) => (
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
          {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
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
            Ascending
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            Descending
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

  if (yourItemsContentView === 'settings') {
    return (
      <div className="plugin-your-items min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          <YourItemsSettingsView onClose={closeYourItemsSettingsView} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'plugin-your-items flex min-h-0 flex-1 flex-col',
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
              <h2 className={PLUGIN_PAGE_TITLE_CLASS}>Your items</h2>
              <ExpandableIconButton
                icon={Settings}
                label={t('common.settings')}
                variant="soft"
                onClick={openYourItemsSettings}
              />
              {renderSortDropdown('h-11 rounded-full')}
              {renderSelectControls('h-11 rounded-full')}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <RoundExpandableSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by title or id…"
              />
              <ExpandableIconButton
                icon={Plus}
                label="Add item"
                variant="soft"
                onClick={() => attemptNavigation(() => openYourItemPanel(null))}
              />
            </div>
          </div>
          {renderBulkActionBar('py-3')}
        </div>

        {selectionMode ? <div className="shrink-0 py-3 md:hidden">{renderBulkActionBar()}</div> : null}

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="items"
          isLoading={deleting}
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
                  message={searchTerm ? 'No items match your search.' : 'No items yet.'}
                  createLabel={!searchTerm ? 'Add item' : undefined}
                  onCreate={
                    !searchTerm ? () => attemptNavigation(() => openYourItemPanel(null)) : undefined
                  }
                />
              ) : (
                <YourItemListTable
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
                    Showing {filteredAndSorted.length} of {yourItems.length} items
                  </>
                }
              />
            </div>
          </div>

          {showDesktopSplit ? (
            <aside
              className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
              role="region"
              aria-label="Item preview"
              aria-live="polite"
            >
              {inlineForm ? (
                <div className="flex min-h-0 flex-col gap-3">
                  <div className="flex shrink-0 justify-end">
                    <InlinePanelFormActions
                      mode={panelMode === 'edit' ? 'edit' : 'create'}
                      hasBlockingErrors={inlineFormHasBlockingErrors}
                      onClose={handleInlineFormClose}
                      onSave={() => {
                        void handleInlineFormSave();
                      }}
                      t={t}
                    />
                  </div>
                  <YourItemForm
                    ref={inlineFormRef}
                    currentItem={currentYourItem ?? undefined}
                    onSave={handleInlineFormOnSave}
                    onCancel={closeYourItemPanel}
                    stacked
                  />
                </div>
              ) : detailItem ? (
                <YourItemView item={detailItem} stacked />
              ) : (
                <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                  <YourItemsStatisticsView />
                </Card>
              )}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
};
