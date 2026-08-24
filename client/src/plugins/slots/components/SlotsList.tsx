import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  Mail,
  MessageSquare,
  Plus,
  Settings,
  SlidersHorizontal,
  Trash2,
  XCircle,
} from 'lucide-react';
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
import { useQuickContextPreview } from '@/core/hooks/useQuickContextPreview';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { BulkEmailDialog, type BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog, type BulkMessageRecipient } from '@/core/ui/BulkMessageDialog';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { exportItems } from '@/core/utils/exportUtils';
import { formatDateTime, formatDateTimeShort } from '@/core/utils/dateFormat';
import { LIST_FILTER_STAT_ROW_CLASS, ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useMobileActions } from '@/core/ui/MobileActionsContext';
import { ListSearchInput } from '@/core/ui/ListSearchInput';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';

import { slotsApi } from '../api/slotsApi';
import { useSlotsContext as useSlots } from '../context/SlotsContext';
import type { Slot } from '../types/slots';
import {
  appendPublicBookingsToEmailRecipients,
  appendPublicBookingsToMessageRecipients,
  formatSlotInfoHtml,
  formatSlotInfoText,
  resolveSlotsToContacts,
  resolveSlotsToEmailContacts,
} from '../utils/slotContactUtils';
import {
  getInitialSlotColumnCount,
  resolveSlotColumnCount,
  SLOTS_COLUMN_COUNT_STORAGE_KEY,
  SLOTS_SETTINGS_KEY,
  type SlotColumnCount,
} from '../utils/slotColumnCount';
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

import { BulkPropertiesDialog } from './BulkPropertiesDialog';
import { SlotListItem } from './SlotListItem';
import { SlotListTable } from './SlotListTable';
import { SlotQuickContextPanel } from './SlotQuickContextPanel';
import { SlotsSettingsView } from './SlotsSettingsView';

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

  const [searchTerm, setSearchTerm] = useState('');
  const [primarySort, setPrimarySort] = useState<SortField>('slot_time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [activeFilters, setActiveFilters] = useState<SlotListFilterSelection>([]);
  const [columnCount, setColumnCountState] = useState<SlotColumnCount>(getInitialSlotColumnCount);
  const [listViewMode, setListViewModeState] = useState<SlotListViewMode>(
    getInitialSlotListViewMode,
  );
  const [settingsCategory, setSettingsCategory] = useState<'view' | 'categories'>('view');

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
        const next = resolveSlotColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(SLOTS_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        const nextView = resolveSlotListViewMode(settings);
        setListViewModeState(nextView);
        persistSlotListViewModeSession(nextView);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: SlotColumnCount) => {
      setColumnCountState(count);
      setListViewModeState('cards');
      persistSlotListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SLOTS_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(SLOTS_SETTINGS_KEY, { columnCount: count, listViewMode: 'cards' }).catch(
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
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);

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

  const handleOpenForView = (slot: Slot) => {
    markPendingAndOpen(slot, () => attemptNavigation(() => openSlotForView(slot)));
  };

  const handleRowActivate = (slot: Slot) => {
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
    <div className="plugin-slots min-h-full bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <div className="space-y-3">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.slots')}</h2>
            <p className="text-sm text-muted-foreground">{t('slots.listDescription')}</p>
          </div>
          <div className="flex w-full flex-shrink-0 items-center gap-2 md:w-auto md:gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 flex-1 md:flex-initial px-2.5 text-xs"
              onClick={() => openSlotSettings()}
              title={t('slots.settings')}
            >
              {t('slots.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 flex-1 md:flex-initial px-3 text-xs"
              onClick={() => attemptNavigation(() => openSlotPanel(null))}
            >
              {t('slots.addSlot')}
            </Button>
          </div>
        </div>

        <div className={cn(LIST_FILTER_STAT_ROW_CLASS, 'md:grid-cols-2 md:gap-2 lg:grid-cols-4')}>
          <ListFilterStatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilters.length === 0}
            onClick={() => setActiveFilters([])}
          />
          <ListFilterStatCard
            label="Visible"
            value={stats.visible}
            dotClassName="bg-emerald-500"
            active={isFilterActive('visible')}
            onClick={() => toggleFilter('visible')}
          />
          <ListFilterStatCard
            label="Upcoming"
            value={stats.upcoming}
            dotClassName="bg-amber-500"
            active={isFilterActive('upcoming')}
            onClick={() => toggleFilter('upcoming')}
          />
          <ListFilterStatCard
            label="With Category"
            value={stats.withCategory}
            dotClassName="bg-violet-500"
            active={isFilterActive('withCategory')}
            onClick={() => toggleFilter('withCategory')}
          />
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

        <div className="flex items-start gap-4">
          {showQuickContext && previewSlot ? (
            <aside className="w-[min(100%,36rem)] shrink-0 self-start lg:sticky lg:top-4">
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
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <ListToolbar
              selectedCount={selectedCount}
              showSelectAll={filteredAndSorted.length > 0}
              selectAll={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                  icon={CheckSquare}
                  onClick={onToggleAllVisible}
                >
                  {t('common.selectAll')}
                </Button>
              }
              search={
                <ListSearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder={t('slots.searchPlaceholder', { count: slots.length })}
                />
              }
              trailing={
                <>
                  {!isTableView ? (
                    <div className="mr-1 flex items-center gap-1">
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
                  ) : null}
                  <ListColumnLayoutToggle
                    columnCount={columnCount}
                    listViewMode={listViewMode}
                    onSelectColumns={setColumnCount}
                    onSelectTable={() => setListViewMode('table')}
                    columnAriaLabel={(count) => t(`slots.columns${count}`)}
                    tableAriaLabel={t('common.tableView')}
                  />
                </>
              }
              bulkActions={
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={XCircle}
                    className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                    onClick={clearSlotSelection}
                    type="button"
                  >
                    {t('common.clearSelection')}
                  </Button>
                  <span className="inline-flex h-9 items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[10px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                    {t('bulk.selected', { count: selectedCount })}
                  </span>
                  {canSendMessages ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={MessageSquare}
                      onClick={openBulkMessageDialog}
                      className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                    >
                      {t('bulk.sendMessageTitle')}
                    </Button>
                  ) : null}
                  {canSendEmail ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Mail}
                      onClick={openBulkEmailDialog}
                      className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                    >
                      {t('bulk.sendEmailTitle')}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={SlidersHorizontal}
                    onClick={() => setShowBulkPropertiesDialog(true)}
                    className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                  >
                    {t('slots.properties')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={FileSpreadsheet}
                    onClick={handleBulkExportCSV}
                    className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                  >
                    {t('common.exportCsv')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                  >
                    {t('common.delete')}
                  </Button>
                </>
              }
            />

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
                        <input
                          type="checkbox"
                          checked={selected}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(slot.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={selected ? t('common.deselect') : t('common.select')}
                        />
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
