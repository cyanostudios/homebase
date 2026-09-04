import {
  Calendar,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Eye,
  FileSpreadsheet,
  LayoutGrid,
  Mail,
  MessageSquare,
  Plus,
  Settings,
  SlidersHorizontal,
  Tag,
  Trash2,
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
import { useQuickContextPreview } from '@/core/hooks/useQuickContextPreview';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { BulkEmailDialog, type BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog, type BulkMessageRecipient } from '@/core/ui/BulkMessageDialog';
import {
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { formatDateTime, formatDateTimeShort } from '@/core/utils/dateFormat';
import { exportItems } from '@/core/utils/exportUtils';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';

import { slotsApi } from '../api/slotsApi';
import { useSlotsContext as useSlots } from '../context/SlotsContext';
import type { Slot } from '../types/slots';
import {
  getInitialSlotColumnCount,
  resolveSlotColumnCount,
  SLOTS_COLUMN_COUNT_STORAGE_KEY,
  SLOTS_SETTINGS_KEY,
  type SlotColumnCount,
} from '../utils/slotColumnCount';
import {
  appendPublicBookingsToEmailRecipients,
  appendPublicBookingsToMessageRecipients,
  formatSlotInfoHtml,
  formatSlotInfoText,
  resolveSlotsToContacts,
  resolveSlotsToEmailContacts,
} from '../utils/slotContactUtils';
import {
  slotHasCategory,
  slotIsUpcoming,
  slotIsVisible,
  slotMatchesListFilters,
  toggleSlotListFilter,
  type SlotListFilter,
  type SlotListFilterSelection,
} from '../utils/slotListFilter';
import {
  compareSlotsByField,
  isSlotAscDefaultField,
  nextSlotTableSort,
  type SlotSortField,
  type SlotSortOrder,
} from '../utils/slotListSort';
import {
  getInitialSlotListViewMode,
  persistSlotListViewModeSession,
  resolveSlotListViewMode,
  type SlotListViewMode,
} from '../utils/slotListViewMode';
import { resolveVisibleSlotTableColumns, type SlotTableColumnId } from '../utils/slotTableColumns';

import { BulkPropertiesDialog } from './BulkPropertiesDialog';
import { SlotListItem } from './SlotListItem';
import { SlotListTable } from './SlotListTable';
import { SlotQuickContextPanel } from './SlotQuickContextPanel';
import { SlotsSettingsView, type SlotsSettingsCategory } from './SlotsSettingsView';

import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';

type SortField = SlotSortField;
type SortOrder = SlotSortOrder;

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'slot_time', label: 'Time' },
  { value: 'name', label: 'Name' },
  { value: 'location', label: 'Location' },
  { value: 'category', label: 'Category' },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'visible', label: 'Visible' },
  { value: 'booked_count', label: 'Bookings' },
];

export function SlotsList() {
  const { t } = useTranslation();
  const {
    slots,
    slotsContentView,
    openSlotForView,
    openSlotForEdit,
    openSlotSettings,
    closeSlotSettingsView,
    deleteSlots,
    selectedSlotIds,
    toggleSlotSelected,
    mergeIntoSlotSelection,
    selectAllSlots,
    clearSlotSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedSlotId,
    refreshSlots,
    canSendMessages,
    canSendEmail,
    openSlotPanel,
  } = useSlots();
  const { getSettings, updateSettings, settingsVersion, contacts: appContacts } = useApp();
  const { contacts: hookContacts } = useContacts();
  const contacts = useMemo(() => appContacts ?? hookContacts ?? [], [appContacts, hookContacts]);
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openSlotPanel(null)),
    onSettings: () => openSlotSettings(),
  });

  const { searchTerm, setSearchTerm } = usePersistedListSearch('slots');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('slots.searchPlaceholder', { count: slots.length }),
  });
  const [selectionMode, setSelectionMode] = useState(false);
  const [primarySort, setPrimarySort] = useState<SortField>('slot_time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [activeFilters, setActiveFilters] = useState<SlotListFilterSelection>([]);
  const [columnCount, setColumnCountState] = useState<SlotColumnCount>(getInitialSlotColumnCount);
  const [listViewMode, setListViewModeState] = useState<SlotListViewMode>(
    getInitialSlotListViewMode,
  );
  const [visibleColumnIds, setVisibleColumnIds] = useState<SlotTableColumnId[]>(() =>
    resolveVisibleSlotTableColumns(null),
  );
  const [settingsCategory, setSettingsCategory] = useState<SlotsSettingsCategory>('columns');

  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkMessageDialog, setShowBulkMessageDialog] = useState(false);
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false);
  const [showBulkPropertiesDialog, setShowBulkPropertiesDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkMessageRecipients, setBulkMessageRecipients] = useState<BulkMessageRecipient[]>([]);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState<BulkEmailRecipient[]>([]);
  const [bulkEmailContextSlots, setBulkEmailContextSlots] = useState<Slot[]>([]);

  const selectedSlots = useMemo(
    () => slots.filter((s) => selectedSlotIds.includes(s.id)),
    [slots, selectedSlotIds],
  );

  useEffect(() => {
    let cancelled = false;
    getSettings(SLOTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const resolved = resolveSlotColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as SlotColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(SLOTS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(SLOTS_SETTINGS_KEY, { columnCount: next }).catch(() => {});
        }
        const nextView = resolveSlotListViewMode(settings);
        setListViewModeState(nextView);
        persistSlotListViewModeSession(nextView);
        setVisibleColumnIds(resolveVisibleSlotTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (_count: SlotColumnCount) => {
      const next = 3 as SlotColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistSlotListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SLOTS_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(SLOTS_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: SlotListViewMode) => {
      setListViewModeState(mode);
      persistSlotListViewModeSession(mode);
      updateSettings(SLOTS_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const formatDateTimeForFilter = useCallback(
    (s: string | null) => (s ? formatDateTimeShort(s) : ''),
    [],
  );

  const filteredAndSorted = useMemo(() => {
    const byFilter = slots.filter((s) => slotMatchesListFilters(s, activeFilters));

    const needle = searchTerm.trim().toLowerCase();
    const filtered = byFilter.filter((s) => {
      if (!needle) {
        return true;
      }
      const timeStr = formatDateTimeForFilter(s.slot_time ?? null).toLowerCase();
      const nameStr = (s.name ?? '').toLowerCase();
      const locationStr = (s.location ?? '').toLowerCase();
      return nameStr.includes(needle) || locationStr.includes(needle) || timeStr.includes(needle);
    });
    return [...filtered].sort((a, b) => compareSlotsByField(a, b, primarySort, sortOrder));
  }, [slots, searchTerm, primarySort, sortOrder, formatDateTimeForFilter, activeFilters]);

  const stats = useMemo(
    () => ({
      total: slots.length,
      visible: slots.filter((s) => slotIsVisible(s)).length,
      upcoming: slots.filter((s) => slotIsUpcoming(s)).length,
      withCategory: slots.filter((s) => slotHasCategory(s)).length,
    }),
    [slots],
  );

  const isFilterActive = (filter: SlotListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: SlotListFilter) => {
    setActiveFilters((prev) => toggleSlotListFilter(prev, filter));
  };

  const visibleSlotIds = useMemo(
    () => filteredAndSorted.map((s) => String(s.id)),
    [filteredAndSorted],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleSlotIds,
      mergeIntoSelection: mergeIntoSlotSelection,
      toggleOne: toggleSlotSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleSlotIds.length > 0 && visibleSlotIds.every((id) => isSelected(id)),
    [visibleSlotIds, isSelected],
  );

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleSlotIds);
      const remaining = selectedSlotIds.filter((id) => !set.has(id));
      selectAllSlots(remaining);
    } else {
      const union = Array.from(new Set([...selectedSlotIds, ...visibleSlotIds]));
      selectAllSlots(union);
    }
  }, [allVisibleSelected, visibleSlotIds, selectedSlotIds, selectAllSlots]);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isSlotAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextSlotTableSort(primarySort, sortOrder, field);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);

  const {
    previewItem: previewSlot,
    setPreviewItem: setPreviewSlot,
    showQuickContext,
    markPendingAndOpen,
    activateRow,
  } = useQuickContextPreview({
    storeKey: 'slots',
    items: slots,
    getItemId: (slot) => String(slot.id),
  });

  const quickContextOpen = Boolean(showQuickContext && previewSlot);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount, { quickContextOpen });
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount, { quickContextOpen });

  const handleOpenForView = (slot: Slot) => {
    markPendingAndOpen(slot, () => attemptNavigation(() => openSlotForView(slot)));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearSlotSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (slot: Slot) => {
    if (selectionMode) {
      toggleSlotSelected(String(slot.id));
      return;
    }
    activateRow(slot, (item) => attemptNavigation(() => openSlotForView(item)));
  };

  const handleBulkDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteSlots(selectedSlotIds);
      setShowBulkDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }, [deleteSlots, selectedSlotIds]);

  const openBulkMessageDialog = useCallback(async () => {
    const base = resolveSlotsToContacts(
      selectedSlotIds,
      slots,
      contacts as Array<{
        id: string | number;
        companyName?: string;
        phone?: string;
        phone2?: string;
      }>,
    );
    try {
      const lists = await Promise.all(selectedSlotIds.map((id) => slotsApi.getBookings(id)));
      setBulkMessageRecipients(appendPublicBookingsToMessageRecipients(base, lists.flat()));
    } catch {
      setBulkMessageRecipients(base);
    }
    setShowBulkMessageDialog(true);
  }, [selectedSlotIds, slots, contacts]);

  const openBulkEmailDialog = useCallback(async () => {
    const base = resolveSlotsToEmailContacts(
      selectedSlotIds,
      slots,
      contacts as Array<{
        id: string | number;
        companyName?: string;
        email?: string;
      }>,
    );
    try {
      const lists = await Promise.all(selectedSlotIds.map((id) => slotsApi.getBookings(id)));
      setBulkEmailRecipients(appendPublicBookingsToEmailRecipients(base, lists.flat()));
    } catch {
      setBulkEmailRecipients(base);
    }
    setBulkEmailContextSlots(selectedSlots);
    setShowBulkEmailDialog(true);
  }, [selectedSlotIds, selectedSlots, slots, contacts]);

  const closeBulkMessageDialog = useCallback(() => {
    setShowBulkMessageDialog(false);
    setBulkMessageRecipients([]);
  }, []);

  const closeBulkEmailDialog = useCallback(() => {
    setShowBulkEmailDialog(false);
    setBulkEmailRecipients([]);
    setBulkEmailContextSlots([]);
  }, []);

  const handleBulkExportCSV = useCallback(() => {
    exportItems({
      items: selectedSlots,
      format: 'csv',
      filename: `slots-export-${new Date().toISOString().split('T')[0]}`,
      config: {
        csv: {
          headers: [
            'id',
            'location',
            'slot_time',
            'capacity',
            'visible',
            'notifications_enabled',
            'mention_count',
            'created_at',
            'updated_at',
          ],
          mapItemToRow: (s: Slot) => ({
            id: s.id,
            location: s.location ?? '',
            slot_time: s.slot_time ? formatDateTime(s.slot_time) : '',
            capacity: s.capacity,
            visible: s.visible ? t('common.yes') : t('common.no'),
            notifications_enabled: s.notifications_enabled ? t('common.on') : t('common.off'),
            mention_count: s.mentions?.length ?? 0,
            created_at: s.created_at ? new Date(s.created_at).toLocaleDateString('sv-SE') : '',
            updated_at: s.updated_at ? new Date(s.updated_at).toLocaleDateString('sv-SE') : '',
          }),
        },
      },
    });
  }, [selectedSlots, t]);

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    const actions: BulkActionRoundItem[] = [];
    if (canSendMessages) {
      actions.push({
        key: 'message',
        label: t('bulk.message'),
        icon: MessageSquare,
        disabled,
        contentClassName: 'text-sky-500 dark:text-sky-400',
        onClick: () => {
          void openBulkMessageDialog();
        },
      });
    }
    if (canSendEmail) {
      actions.push({
        key: 'email',
        label: t('bulk.email'),
        icon: Mail,
        disabled,
        contentClassName: 'text-red-800 dark:text-red-500',
        onClick: () => {
          void openBulkEmailDialog();
        },
      });
    }
    actions.push(
      {
        key: 'properties',
        label: t('slots.properties'),
        icon: SlidersHorizontal,
        disabled,
        onClick: () => setShowBulkPropertiesDialog(true),
      },
      {
        key: 'csv',
        label: t('common.exportCsv'),
        icon: FileSpreadsheet,
        disabled,
        onClick: handleBulkExportCSV,
      },
      {
        key: 'delete',
        label: t('common.delete'),
        icon: Trash2,
        disabled,
        tone: 'destructive',
        onClick: () => setShowBulkDeleteModal(true),
      },
    );
    return actions;
  }, [
    selectedCount,
    canSendMessages,
    canSendEmail,
    t,
    openBulkMessageDialog,
    openBulkEmailDialog,
    handleBulkExportCSV,
  ]);

  if (slotsContentView === 'settings') {
    return (
      <div className="plugin-slots min-h-full bg-background">
        <div className="px-6 py-4">
          <SlotsSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            renderCategoryButtonsInline
            onClose={closeSlotSettingsView}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('plugin-slots', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.slots')}</h2>
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('slots.settings')}
                    variant="soft"
                    onClick={() => openSlotSettings()}
                  />
                  {filteredAndSorted.length > 0 ? (
                    selectionMode ? (
                      <ExpandableIconButton
                        icon={XCircle}
                        label={t('common.clear')}
                        variant="danger"
                        alwaysExpanded
                        onClick={handleExitSelectionMode}
                      />
                    ) : (
                      <ExpandableIconButton
                        icon={CheckSquare}
                        label={t('common.select')}
                        variant="soft"
                        alwaysExpanded
                        onClick={handleEnterSelectionMode}
                      />
                    )
                  ) : null}
                </div>
              </div>
              {selectionMode ? (
                <BulkActionRoundBar
                  selectedCount={selectedCount}
                  actions={bulkRoundActions}
                  className="gap-2"
                />
              ) : null}
            </div>
            <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
              <RoundExpandableSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('slots.searchPlaceholder', { count: slots.length })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`slots.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('slots.addSlot')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openSlotPanel(null))}
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
                Total <span className="tabular-nums font-semibold">({stats.total})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('visible')}
              className={cn(
                isFilterActive('visible') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>
                Visible <span className="tabular-nums font-semibold">({stats.visible})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('upcoming')}
              className={cn(
                isFilterActive('upcoming') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Upcoming <span className="tabular-nums font-semibold">({stats.upcoming})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('withCategory')}
              className={cn(
                isFilterActive('withCategory')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Tag className="h-3.5 w-3.5" />
              <span>
                With Category{' '}
                <span className="tabular-nums font-semibold">({stats.withCategory})</span>
              </span>
            </Button>
          </div>
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
            <Select
              value={primarySort}
              onValueChange={(value) => handlePrimarySortChange(value as SortField)}
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

        <BulkMessageDialog
          isOpen={showBulkMessageDialog}
          onClose={closeBulkMessageDialog}
          recipients={bulkMessageRecipients}
          pluginSource="slots"
          showRecipientSelection
        />
        <BulkEmailDialog
          isOpen={showBulkEmailDialog}
          onClose={closeBulkEmailDialog}
          recipients={bulkEmailRecipients}
          pluginSource="slots"
          showRecipientSelection
          additionalText={
            bulkEmailContextSlots.length > 0
              ? bulkEmailContextSlots.map((s) => formatSlotInfoText(s)).join('\n\n')
              : undefined
          }
          additionalHtml={
            bulkEmailContextSlots.length > 0
              ? bulkEmailContextSlots.map((s) => formatSlotInfoHtml(s)).join('')
              : undefined
          }
        />

        <BulkPropertiesDialog
          isOpen={showBulkPropertiesDialog}
          onClose={() => setShowBulkPropertiesDialog(false)}
          selectedSlots={selectedSlots}
          onSuccess={async () => {
            await refreshSlots();
            clearSlotSelection();
          }}
        />

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="slots"
          isLoading={deleting}
        />

        <div
          className={cn(
            'grid items-start gap-4',
            showQuickContext && previewSlot ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
          )}
        >
          {showQuickContext && previewSlot ? (
            <aside className="min-w-0 self-start lg:sticky lg:top-4 lg:z-10">
              <SlotQuickContextPanel
                slot={previewSlot}
                onClose={() => setPreviewSlot(null)}
                onOpenFullProfile={() => handleOpenForView(previewSlot)}
                onEdit={() => {
                  markPendingAndOpen(previewSlot, () =>
                    attemptNavigation(() => openSlotForEdit(previewSlot)),
                  );
                }}
              />
            </aside>
          ) : null}
          <div className="flex min-w-0 flex-col gap-3">
            {filteredAndSorted.length === 0 ? (
              <ListEmptyState
                message={searchTerm ? t('slots.noSlotsMatch') : t('slots.noSlotsYet')}
                createLabel={!searchTerm ? t('slots.addSlot') : undefined}
                onCreate={
                  !searchTerm ? () => attemptNavigation(() => openSlotPanel(null)) : undefined
                }
              />
            ) : isTableView ? (
              <SlotListTable
                slots={filteredAndSorted}
                primarySort={primarySort}
                sortOrder={sortOrder}
                onSort={handleTableSort}
                isSelected={isSelected}
                onRowClick={handleRowActivate}
                activeSlotId={previewSlot?.id ?? null}
                onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                onCheckboxChange={onVisibleRowCheckboxChange}
                allVisibleSelected={allVisibleSelected}
                onHeaderCheckboxChange={onToggleAllVisible}
                recentlyDuplicatedSlotId={recentlyDuplicatedSlotId}
                selectionEnabled={selectionMode}
                visibleColumnIds={visibleColumnIds}
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
                {filteredAndSorted.map((slot, index) => {
                  const selected = isSelected(slot.id);
                  return (
                    <SlotListItem
                      key={slot.id}
                      slot={slot}
                      selected={selected}
                      highlighted={recentlyDuplicatedSlotId === String(slot.id)}
                      active={previewSlot !== null && String(previewSlot.id) === String(slot.id)}
                      onClick={() => handleRowActivate(slot)}
                      columnCount={effectiveCardColumnCount}
                      checkbox={
                        selectionMode ? (
                          <input
                            type="checkbox"
                            checked={selected}
                            onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                            onChange={() => onVisibleRowCheckboxChange(slot.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 cursor-pointer"
                            aria-label={selected ? t('common.deselect') : t('common.select')}
                          />
                        ) : undefined
                      }
                    />
                  );
                })}
              </div>
            )}

            <ListFooterBar
              meta={
                <>
                  Showing {filteredAndSorted.length} of {slots.length} Slots
                </>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
