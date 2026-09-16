import {
  Calendar,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Eye,
  FileSpreadsheet,
  LayoutGrid,
  Mail,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  SlidersHorizontal,
  Tag,
  Trash2,
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
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { BulkEmailDialog, type BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog, type BulkMessageRecipient } from '@/core/ui/BulkMessageDialog';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDateTime, formatDateTimeShort } from '@/core/utils/dateFormat';
import { exportItems } from '@/core/utils/exportUtils';
import { InlinePanelFormActions } from '@/core/ui/InlinePanelFormActions';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFilterChipsToggle } from '@/core/ui/ListFilterChipsToggle';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';

import { slotsApi } from '../api/slotsApi';
import { useSlotsContext as useSlots } from '../context/SlotsContext';
import type { Slot } from '../types/slots';
import { SLOTS_SETTINGS_KEY } from '../utils/slotColumnCount';
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
import { resolveVisibleSlotTableColumns, type SlotTableColumnId } from '../utils/slotTableColumns';

import { BulkPropertiesDialog } from './BulkPropertiesDialog';
import { SlotForm } from './SlotForm';
import { SlotListTable } from './SlotListTable';
import { SlotView } from './SlotView';
import { SlotsSettingsView, type SlotsSettingsCategory } from './SlotsSettingsView';
import { SlotsStatisticsView } from './SlotsStatisticsView';

type SortField = SlotSortField;
type SortOrder = SlotSortOrder;

const SLOTS_TOOLBAR_COLLAPSED_STORAGE_KEY = 'homebase.slots.toolbar.collapsed';
const SLOTS_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.slots.toolbar.filtersVisible';

function readSlotsToolbarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(SLOTS_TOOLBAR_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSlotsToolbarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(SLOTS_TOOLBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'slot_time', labelKey: 'slots.timeLabel' },
  { value: 'name', labelKey: 'slots.nameLabel' },
  { value: 'location', labelKey: 'slots.locationLabel' },
  { value: 'category', labelKey: 'slots.categoryLabel' },
  { value: 'updatedAt', labelKey: 'common.updated' },
  { value: 'visible', labelKey: 'common.visible' },
  { value: 'booked_count', labelKey: 'slots.publicBookings' },
];

export function SlotsList() {
  const { t } = useTranslation();
  const {
    slots,
    slotsContentView,
    openSlotForView,
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
    isSlotsPanelOpen,
    panelMode,
    currentSlot,
    closeSlotPanel,
    saveSlot,
    validationErrors,
  } = useSlots();
  const { getSettings, settingsVersion, contacts: appContacts } = useApp();
  const { contacts: hookContacts } = useContacts();
  const contacts = useMemo(() => appContacts ?? hookContacts ?? [], [appContacts, hookContacts]);
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openSlotPanel(null)),
    onSettings: () => openSlotSettings(),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

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
  const [visibleColumnIds, setVisibleColumnIds] = useState<SlotTableColumnId[]>(() =>
    resolveVisibleSlotTableColumns(null),
  );
  const [settingsCategory, setSettingsCategory] = useState<SlotsSettingsCategory>('categories');
  const [previewSlot, setPreviewSlot] = useState<Slot | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(readSlotsToolbarCollapsed);
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    SLOTS_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkMessageDialog, setShowBulkMessageDialog] = useState(false);
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false);
  const [showBulkPropertiesDialog, setShowBulkPropertiesDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkMessageRecipients, setBulkMessageRecipients] = useState<BulkMessageRecipient[]>([]);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState<BulkEmailRecipient[]>([]);
  const [bulkEmailContextSlots, setBulkEmailContextSlots] = useState<Slot[]>([]);

  const inlineForm =
    showDesktopSplit && isSlotsPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isSlotsPanelOpen && panelMode === 'view' && currentSlot != null;
  const detailSlot = inlinePanelView ? currentSlot : previewSlot;
  const activeSlotId =
    (inlineForm || inlinePanelView) && currentSlot != null
      ? currentSlot.id
      : (previewSlot?.id ?? null);

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
        setVisibleColumnIds(resolveVisibleSlotTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  useEffect(() => {
    if (!previewSlot) {
      return;
    }
    const next = slots.find((slot) => String(slot.id) === String(previewSlot.id));
    if (!next) {
      setPreviewSlot(null);
      return;
    }
    if (next !== previewSlot) {
      setPreviewSlot(next);
    }
  }, [slots, previewSlot]);

  useEffect(() => {
    if (!showDesktopSplit || !isSlotsPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentSlot) {
      setPreviewSlot(currentSlot);
    }
  }, [showDesktopSplit, isSlotsPanelOpen, panelMode, currentSlot]);

  const toggleToolbarCollapsed = useCallback(() => {
    setToolbarCollapsed((prev) => {
      const next = !prev;
      writeSlotsToolbarCollapsed(next);
      return next;
    });
  }, []);

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

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextSlotTableSort(primarySort, sortOrder, field);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearSlotSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (slot: Slot) => {
    if (isCompactViewport) {
      attemptNavigation(() => openSlotForView(slot));
      return;
    }
    if (selectionMode) {
      toggleSlotSelected(String(slot.id));
      return;
    }
    if (
      isSlotsPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeSlotPanel();
        setPreviewSlot(slot);
      });
      return;
    }
    setPreviewSlot((current) => (current && String(current.id) === String(slot.id) ? null : slot));
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    closeSlotPanel();
  }, [closeSlotPanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Record<string, unknown>) => {
      const ok = await saveSlot(data, currentSlot?.id);
      return ok;
    },
    [saveSlot, currentSlot?.id],
  );

  const inlineFormHasBlockingErrors = validationErrors.some(
    (e) => !String(e?.message || '').includes('Warning'),
  );

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

  const headerDropdownTriggerClass =
    'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

  const headerDropdownTriggerDangerClass =
    'gap-1.5 border-0 bg-red-600/10 px-3.5 text-sm font-extrabold text-red-700 shadow-none hover:bg-red-600 hover:text-white dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white';

  const renderFilterChips = () => (
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
          {t('slots.stats.total', { defaultValue: 'Total' })}{' '}
          <span className="tabular-nums font-semibold">({stats.total})</span>
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
          {t('slots.stats.visible', { defaultValue: 'Visible' })}{' '}
          <span className="tabular-nums font-semibold">({stats.visible})</span>
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
          {t('slots.stats.upcoming', { defaultValue: 'Upcoming' })}{' '}
          <span className="tabular-nums font-semibold">({stats.upcoming})</span>
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => toggleFilter('withCategory')}
        className={cn(
          isFilterActive('withCategory') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
        )}
      >
        <Tag className="h-3.5 w-3.5" />
        <span>
          {t('slots.stats.withCategory', { defaultValue: 'With category' })}{' '}
          <span className="tabular-nums font-semibold">({stats.withCategory})</span>
        </span>
      </Button>
    </div>
  );

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
          aria-label={t('slots.sort')}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('slots.sort')}</span>
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
          onValueChange={(value) => handlePrimarySortChange(value as SortField)}
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
          {sortOrder === 'asc' ? t('slots.sortAsc') : t('slots.sortDesc')}
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
            {t('slots.sortAsc')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('slots.sortDesc')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderBulkActionBar = (className?: string) =>
    selectionMode ? (
      <BulkActionRoundBar
        selectedCount={selectedCount}
        actions={bulkRoundActions}
        size="xs"
        className={cn('gap-1.5', className)}
      />
    ) : null;

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

  if (slotsContentView === 'settings') {
    return (
      <div className="plugin-slots min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
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
                label={toolbarCollapsed ? t('slots.expandToolbar') : t('slots.collapseToolbar')}
                variant={toolbarCollapsed ? 'primary' : 'secondary'}
                size="xs"
                expandOnHover={false}
                className={
                  toolbarCollapsed
                    ? undefined
                    : 'bg-white text-primary shadow-sm hover:bg-primary hover:text-primary-foreground dark:bg-white dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground'
                }
                aria-expanded={!toolbarCollapsed}
                aria-controls="slots-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {toolbarEdgeToggle}
      <div
        ref={pageShellRef}
        className={cn(
          'plugin-slots flex min-h-0 flex-1 flex-col',
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
                  id="slots-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.slots')}</h2>
                    <ExpandableIconButton
                      icon={Settings}
                      label={t('slots.settings')}
                      variant="soft"
                      onClick={() => openSlotSettings()}
                    />
                    {renderSortDropdown('h-11 rounded-full')}
                    <ListFilterChipsToggle
                      visible={filtersVisible}
                      onVisibleChange={setFiltersVisible}
                      className="h-11 rounded-full"
                    />
                    {renderSelectControls('h-11 rounded-full')}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RoundExpandableSearch
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder={t('slots.searchPlaceholder', { count: slots.length })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('slots.addSlot')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openSlotPanel(null))}
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
                {renderBulkActionBar('py-3')}
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

          {selectionMode ? (
            <div className="shrink-0 py-3 md:hidden">{renderBulkActionBar()}</div>
          ) : null}

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
                    message={searchTerm ? t('slots.noMatch') : t('slots.noYet')}
                    createLabel={!searchTerm ? t('slots.addSlot') : undefined}
                    onCreate={
                      !searchTerm ? () => attemptNavigation(() => openSlotPanel(null)) : undefined
                    }
                  />
                ) : (
                  <SlotListTable
                    slots={filteredAndSorted}
                    primarySort={primarySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSort}
                    isSelected={isSelected}
                    onRowClick={handleRowActivate}
                    activeSlotId={activeSlotId}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={onToggleAllVisible}
                    recentlyDuplicatedSlotId={recentlyDuplicatedSlotId}
                    selectionEnabled={selectionMode}
                    visibleColumnIds={visibleColumnIds}
                  />
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

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('slots.quickContext.title')}
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
                    <SlotForm
                      ref={inlineFormRef}
                      currentSlot={currentSlot}
                      onSave={handleInlineFormOnSave}
                      onCancel={closeSlotPanel}
                      stacked
                    />
                  </div>
                ) : detailSlot ? (
                  <SlotView slot={detailSlot} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <SlotsStatisticsView />
                  </Card>
                )}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
