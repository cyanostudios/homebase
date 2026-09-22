import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  ChevronDown,
  LayoutGrid,
  Menu,
  Plus,
  Settings,
  Shirt,
  Tag,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

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
import { nextListTableSort } from '@/core/list/listViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
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
import { pathToNavPage } from '@/core/routing/routeMap';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { ListFilterChipsToggle } from '@/core/ui/ListFilterChipsToggle';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import { usePersistedToolbarCollapsed } from '@/core/ui/usePersistedToolbarCollapsed';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useGarments } from '../hooks/useGarments';
import type { GarmentList as GarmentListModel, InventoryItem } from '../types/garments';
import { GARMENTS_SETTINGS_KEY } from '../utils/garmentColumnCount';
import {
  countInventoryItemsWithTag,
  garmentListMatchesSearch,
  inventoryItemMatchesSearch,
  inventoryItemMatchesTagFilter,
} from '../utils/garmentListFilter';
import { normalizeInventoryTags } from '../utils/inventoryTags';
import {
  compareGarmentListsByField,
  compareInventoryByField,
  isGarmentAscDefaultField,
  isInventoryAscDefaultField,
  type GarmentSortField,
  type GarmentSortOrder,
  type InventorySortField,
} from '../utils/garmentListSort';
import {
  resolveVisibleInventoryTableColumns,
  type InventoryTableColumnId,
} from '../utils/inventoryTableColumns';

import { GarmentForm } from './GarmentForm';
import { GarmentListTable } from './GarmentListTable';
import {
  GarmentsInventorySettingsView,
  type GarmentsInventorySettingsCategory,
} from './GarmentsInventorySettingsView';
import {
  GarmentsListsSettingsView,
  type GarmentsListsSettingsCategory,
} from './GarmentsListsSettingsView';
import { GarmentsStatisticsView } from './GarmentsStatisticsView';
import { GarmentView } from './GarmentView';
import { InventoryBulkListsDialog } from './InventoryBulkListsDialog';
import { InventoryBulkTagsDialog } from './InventoryBulkTagsDialog';
import { InventoryListTable } from './InventoryListTable';

const LIST_SORT_OPTIONS: { value: GarmentSortField; labelKey: string }[] = [
  { value: 'updatedAt', labelKey: 'common.updated' },
  { value: 'name', labelKey: 'garments.name' },
  { value: 'teamId', labelKey: 'garments.team' },
  { value: 'personCount', labelKey: 'garments.persons' },
  { value: 'createdAt', labelKey: 'common.created' },
];

const INVENTORY_SORT_OPTIONS: { value: InventorySortField; labelKey: string }[] = [
  { value: 'updatedAt', labelKey: 'common.updated' },
  { value: 'articleName', labelKey: 'garments.articleName' },
  { value: 'brand', labelKey: 'garments.brand' },
  { value: 'totalQuantity', labelKey: 'garments.totalQuantity' },
  { value: 'variantCount', labelKey: 'garments.variantCount' },
];

const GARMENTS_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.garments.toolbar.filtersVisible';

export const GarmentList: React.FC = () => {
  const { t } = useTranslation();
  const {
    garmentLists,
    inventoryItems,
    openGarmentPanel,
    openGarmentForView,
    openInventoryPanel,
    openInventoryForView,
    deleteGarments,
    deleteInventoryItems,
    assignInventoryItemToList,
    unassignInventoryItemFromList,
    applyTagToInventoryItem,
    clearTagsFromInventoryItem,
    recentlyDuplicatedInventoryId,
    recentlyDuplicatedListId,
    garmentsContentView,
    openGarmentsSettings,
    settingsListsInitialListId,
    closeGarmentsSettingsView,
    isGarmentPanelOpen,
    panelMode,
    panelKind,
    currentGarment,
    currentInventoryItem,
    saveGarment,
    closeGarmentPanel,
    validationErrors,
    refreshGarmentList,
  } = useGarments();
  const location = useLocation();
  const garmentsNavPage = pathToNavPage(location.pathname);
  const { getSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const enabledPlugins = useEnabledPlugins();
  const hasTeams = enabledPlugins.has('teams');
  const { teams } = useTeams();

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (!hasTeams) {
      return map;
    }
    for (const team of teams) {
      map.set(String(team.id), formatTeamLabel(team) || team.name || '');
    }
    return map;
  }, [hasTeams, teams]);

  const listSortOptions = useMemo(
    () => LIST_SORT_OPTIONS.filter((option) => option.value !== 'teamId' || hasTeams),
    [hasTeams],
  );

  const isInventory = garmentsNavPage === 'garments-inventory';

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const [inventorySettingsCategory, setInventorySettingsCategory] =
    useState<GarmentsInventorySettingsCategory>('tags');
  const [listsSettingsCategory, setListsSettingsCategory] =
    useState<GarmentsListsSettingsCategory>('customColumns');

  useMobileActions({
    onAdd: () =>
      attemptNavigation(() => (isInventory ? openInventoryPanel(null) : openGarmentPanel(null))),
    onSettings: () =>
      attemptNavigation(() => openGarmentsSettings(isInventory ? 'inventory' : 'lists')),
  });

  const { searchTerm, setSearchTerm } = usePersistedListSearch('garments');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: isInventory ? t('garments.searchInventory') : t('garments.searchLists'),
  });

  const [selectionMode, setSelectionMode] = useState(false);
  const [listSort, setListSort] = useState<GarmentSortField>('name');
  const [inventorySort, setInventorySort] = useState<InventorySortField>('articleName');
  const [sortOrder, setSortOrder] = useState<GarmentSortOrder>('asc');

  useEffect(() => {
    if (!hasTeams && listSort === 'teamId') {
      setListSort('name');
      setSortOrder('asc');
    }
  }, [hasTeams, listSort]);

  const [visibleColumnIds, setVisibleColumnIds] = useState<InventoryTableColumnId[]>(() =>
    resolveVisibleInventoryTableColumns(null),
  );
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [inventoryTagFilter, setInventoryTagFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkListsDialog, setShowBulkListsDialog] = useState(false);
  const [showBulkTagsDialog, setShowBulkTagsDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewList, setPreviewList] = useState<GarmentListModel | null>(null);
  const [previewInventory, setPreviewInventory] = useState<InventoryItem | null>(null);
  const { toolbarCollapsed, toggleToolbarCollapsed } = usePersistedToolbarCollapsed();
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    GARMENTS_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const modeMatchesPanel =
    (isInventory && panelKind === 'inventory') || (!isInventory && panelKind === 'list');
  const inlineForm =
    showDesktopSplit &&
    isGarmentPanelOpen &&
    modeMatchesPanel &&
    (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isGarmentPanelOpen && modeMatchesPanel && panelMode === 'view';
  const detailList = inlinePanelView && panelKind === 'list' ? currentGarment : previewList;
  const detailInventory =
    inlinePanelView && panelKind === 'inventory' ? currentInventoryItem : previewInventory;
  const detailOpen = Boolean(isInventory ? detailInventory : detailList);
  const activeListItemId =
    (inlineForm || inlinePanelView) && modeMatchesPanel
      ? isInventory
        ? (currentInventoryItem?.id ?? null)
        : (currentGarment?.id ?? null)
      : isInventory
        ? (previewInventory?.id ?? null)
        : (previewList?.id ?? null);

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
    setSelectedIds([]);
    setSearchTerm('');
    setInventoryTagFilter(null);
    setPreviewList(null);
    setPreviewInventory(null);
  }, [garmentsNavPage, setSearchTerm]);

  useEffect(() => {
    if (inventoryTagFilter && !availableTags.includes(inventoryTagFilter)) {
      setInventoryTagFilter(null);
    }
  }, [availableTags, inventoryTagFilter]);

  useEffect(() => {
    let cancelled = false;
    getSettings(GARMENTS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setAvailableTags(normalizeInventoryTags(settings?.tags));
        setVisibleColumnIds(resolveVisibleInventoryTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  useEffect(() => {
    if (isInventory) {
      if (!previewInventory) {
        return;
      }
      const next = inventoryItems.find((item) => String(item.id) === String(previewInventory.id));
      if (!next) {
        setPreviewInventory(null);
        return;
      }
      if (next !== previewInventory) {
        setPreviewInventory(next);
      }
      return;
    }
    // Keep previewList in sync with index updates for the SAME id only.
    // Never copy persons/checkboxColumns from a previously selected list.
    setPreviewList((current) => {
      if (!current) {
        return current;
      }
      const next = garmentLists.find((list) => String(list.id) === String(current.id));
      if (!next) {
        return null;
      }
      if (next === current) {
        return current;
      }
      if (Array.isArray(next.persons)) {
        return next;
      }
      if (!Array.isArray(current.persons)) {
        return next;
      }
      return {
        ...next,
        persons: current.persons,
        checkboxColumns:
          (next.checkboxColumns?.length ?? 0) > 0 ? next.checkboxColumns : current.checkboxColumns,
      };
    });
  }, [garmentLists, inventoryItems, isInventory, previewInventory]);

  // Soft-selected lists need a full getList payload for PersonMatrix (index omits persons).
  // Refresh into garmentLists too so person PATCH/optimistic updates reach the preview.
  useEffect(() => {
    if (isInventory || !previewList?.id) {
      return;
    }
    if (Array.isArray(previewList.persons)) {
      return;
    }
    const listId = previewList.id;
    let cancelled = false;
    void refreshGarmentList(listId)
      .then((full) => {
        if (cancelled || !full) {
          return;
        }
        setPreviewList((current) =>
          current && String(current.id) === String(full.id) ? full : current,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isInventory, previewList?.id, previewList?.persons, refreshGarmentList]);

  useEffect(() => {
    if (!showDesktopSplit || !isGarmentPanelOpen || !modeMatchesPanel) {
      return;
    }
    if (panelMode === 'edit' || panelMode === 'view') {
      if (isInventory && currentInventoryItem) {
        setPreviewInventory(currentInventoryItem);
      } else if (!isInventory && currentGarment) {
        setPreviewList(currentGarment);
      }
    }
  }, [
    showDesktopSplit,
    isGarmentPanelOpen,
    modeMatchesPanel,
    panelMode,
    isInventory,
    currentInventoryItem,
    currentGarment,
  ]);

  const handleListSortChange = (field: GarmentSortField) => {
    setListSort(field);
    setSortOrder(isGarmentAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleInventorySortChange = (field: InventorySortField) => {
    setInventorySort(field);
    setSortOrder(isInventoryAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleTableSortList = useCallback(
    (field: GarmentSortField) => {
      const next = nextListTableSort(listSort, sortOrder, field, isGarmentAscDefaultField);
      setListSort(next.field);
      setSortOrder(next.order);
    },
    [listSort, sortOrder],
  );

  const handleTableSortInventory = useCallback(
    (field: InventorySortField) => {
      const next = nextListTableSort(inventorySort, sortOrder, field, isInventoryAscDefaultField);
      setInventorySort(next.field);
      setSortOrder(next.order);
    },
    [inventorySort, sortOrder],
  );

  const filteredLists = useMemo(() => {
    const filtered = garmentLists.filter((item) => garmentListMatchesSearch(item, searchTerm));
    return [...filtered].sort((a, b) =>
      compareGarmentListsByField(a, b, listSort, sortOrder, teamNameById),
    );
  }, [garmentLists, searchTerm, listSort, sortOrder, teamNameById]);

  const filteredInventory = useMemo(() => {
    const filtered = inventoryItems.filter(
      (item) =>
        inventoryItemMatchesTagFilter(item, inventoryTagFilter) &&
        inventoryItemMatchesSearch(item, searchTerm),
    );
    return [...filtered].sort((a, b) => compareInventoryByField(a, b, inventorySort, sortOrder));
  }, [inventoryItems, inventorySort, inventoryTagFilter, searchTerm, sortOrder]);

  const inventoryTagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tag of availableTags) {
      counts[tag] = countInventoryItemsWithTag(inventoryItems, tag);
    }
    return counts;
  }, [availableTags, inventoryItems]);

  const visibleIds = useMemo(
    () => (isInventory ? filteredInventory : filteredLists).map((item) => String(item.id)),
    [filteredInventory, filteredLists, isInventory],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isSelected = useCallback((id: string) => selectedSet.has(id), [selectedSet]);
  const selectedCount = selectedIds.length;

  const selectedInventoryItems = useMemo(
    () => inventoryItems.filter((item) => selectedSet.has(String(item.id))),
    [inventoryItems, selectedSet],
  );

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

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      if (isInventory) {
        await deleteInventoryItems(selectedIds);
      } else {
        await deleteGarments(selectedIds);
      }
      clearSelection();
      setShowBulkDeleteModal(false);
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleListRowActivate = (list: GarmentListModel) => {
    if (isCompactViewport) {
      attemptNavigation(() => openGarmentForView(list));
      return;
    }
    if (selectionMode) {
      toggleOne(String(list.id));
      return;
    }
    if (isGarmentPanelOpen && modeMatchesPanel) {
      if (panelMode === 'view' && currentGarment && String(currentGarment.id) === String(list.id)) {
        attemptNavigation(() => {
          closeGarmentPanel();
          setPreviewList(null);
        });
        return;
      }
      attemptNavigation(() => openGarmentForView(list));
      return;
    }
    // Lists need a full getList payload (PersonMatrix). Soft-select a stub without
    // persons, then hydrate — never reuse another list's persons array.
    setPreviewList((current) => {
      if (current && String(current.id) === String(list.id)) {
        return null;
      }
      return { ...list, persons: undefined };
    });
  };

  const handleInventoryRowActivate = (item: InventoryItem) => {
    if (isCompactViewport) {
      attemptNavigation(() => openInventoryForView(item));
      return;
    }
    if (selectionMode) {
      toggleOne(String(item.id));
      return;
    }
    if (isGarmentPanelOpen && modeMatchesPanel) {
      if (
        panelMode === 'view' &&
        currentInventoryItem &&
        String(currentInventoryItem.id) === String(item.id)
      ) {
        attemptNavigation(() => {
          closeGarmentPanel();
          setPreviewInventory(null);
        });
        return;
      }
      attemptNavigation(() => openInventoryForView(item));
      return;
    }
    setPreviewInventory((current) =>
      current && String(current.id) === String(item.id) ? null : item,
    );
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearSelection();
    setSelectionMode(false);
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormCancel = useCallback(() => {
    if (panelMode === 'edit') {
      if (isInventory && currentInventoryItem) {
        openInventoryForView(currentInventoryItem);
        return;
      }
      if (!isInventory && currentGarment) {
        openGarmentForView(currentGarment);
        return;
      }
    }
    closeGarmentPanel();
  }, [
    closeGarmentPanel,
    currentGarment,
    currentInventoryItem,
    isInventory,
    openGarmentForView,
    openInventoryForView,
    panelMode,
  ]);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    handleInlineFormCancel();
  }, [handleInlineFormCancel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Parameters<typeof saveGarment>[0]) => saveGarment(data),
    [saveGarment],
  );

  const inlineFormHasBlockingErrors = validationErrors.some(
    (e) => !String(e?.message || '').includes('Warning'),
  );

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    const actions: BulkActionRoundItem[] = [];
    if (isInventory) {
      actions.push({
        key: 'tags',
        label: t('garments.bulkTagsAction'),
        icon: Tag,
        disabled,
        onClick: () => setShowBulkTagsDialog(true),
      });
      actions.push({
        key: 'lists',
        label: t('garments.bulkListsAction'),
        icon: Shirt,
        disabled,
        onClick: () => setShowBulkListsDialog(true),
      });
    }
    actions.push({
      key: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      disabled,
      tone: 'destructive',
      onClick: () => setShowBulkDeleteModal(true),
    });
    return actions;
  }, [isInventory, selectedCount, t]);

  const totalCount = isInventory ? inventoryItems.length : garmentLists.length;
  const filteredCount = isInventory ? filteredInventory.length : filteredLists.length;
  const primarySort = isInventory ? inventorySort : listSort;
  const sortOptions = isInventory ? INVENTORY_SORT_OPTIONS : listSortOptions;

  const handlePrimarySortChange = (field: string) => {
    if (isInventory) {
      handleInventorySortChange(field as InventorySortField);
    } else {
      handleListSortChange(field as GarmentSortField);
    }
  };

  const headerDropdownTriggerClass =
    'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

  const headerDropdownTriggerDangerClass =
    'gap-1.5 border-0 bg-red-600/10 px-3.5 text-sm font-extrabold text-red-700 shadow-none hover:bg-red-600 hover:text-white dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white';

  const primarySortLabel =
    sortOptions.find((option) => option.value === primarySort)?.labelKey ?? sortOptions[0].labelKey;

  const renderSortDropdown = (triggerClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('garments.sort', { defaultValue: 'Sort' })}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('garments.sort', { defaultValue: 'Sort' })}</span>
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
          onValueChange={(value) => handlePrimarySortChange(value)}
        >
          {sortOptions.map((option) => (
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
            ? t('garments.sortAsc', { defaultValue: 'Ascending' })
            : t('garments.sortDesc', { defaultValue: 'Descending' })}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as GarmentSortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('garments.sortAsc', { defaultValue: 'Ascending' })}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('garments.sortDesc', { defaultValue: 'Descending' })}
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
    if (filteredCount === 0) {
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

  const renderFilterChips = () => {
    if (!isInventory) {
      return null;
    }

    return (
      <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setInventoryTagFilter(null)}
          className={cn(
            inventoryTagFilter == null ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>
            {t('garments.filterAll', { defaultValue: 'All' })}{' '}
            <span className="tabular-nums font-semibold">({inventoryItems.length})</span>
          </span>
        </Button>
        {availableTags.map((tag) => {
          const isActive = inventoryTagFilter === tag;
          return (
            <Button
              key={tag}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setInventoryTagFilter(isActive ? null : tag)}
              className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
            >
              <Tag className="h-3.5 w-3.5" />
              <span>
                {tag}{' '}
                <span className="tabular-nums font-semibold">({inventoryTagCounts[tag] ?? 0})</span>
              </span>
            </Button>
          );
        })}
      </div>
    );
  };

  if (garmentsContentView === 'settings') {
    return (
      <div className="plugin-garments min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          {isInventory ? (
            <GarmentsInventorySettingsView
              selectedCategory={inventorySettingsCategory}
              onSelectedCategoryChange={setInventorySettingsCategory}
              onClose={closeGarmentsSettingsView}
            />
          ) : (
            <GarmentsListsSettingsView
              selectedCategory={listsSettingsCategory}
              onSelectedCategoryChange={setListsSettingsCategory}
              onClose={closeGarmentsSettingsView}
              initialListId={settingsListsInitialListId}
            />
          )}
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
                label={
                  toolbarCollapsed
                    ? t('garments.expandToolbar', { defaultValue: 'Show toolbar' })
                    : t('garments.collapseToolbar', { defaultValue: 'Hide toolbar' })
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
                aria-controls="garments-mail-toolbar"
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
          'plugin-garments flex min-h-0 flex-1 flex-col',
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
                  id="garments-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
                      {t(isInventory ? 'nav.garments-inventory' : 'nav.garments-lists')}
                    </h2>
                    <ExpandableIconButton
                      icon={Settings}
                      label={t('common.settings')}
                      variant="soft"
                      onClick={() =>
                        attemptNavigation(() =>
                          openGarmentsSettings(isInventory ? 'inventory' : 'lists'),
                        )
                      }
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
                      placeholder={
                        isInventory ? t('garments.searchInventory') : t('garments.searchLists')
                      }
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={isInventory ? t('garments.addInventory') : t('garments.addList')}
                      variant="soft"
                      onClick={() =>
                        attemptNavigation(() =>
                          isInventory ? openInventoryPanel(null) : openGarmentPanel(null),
                        )
                      }
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

          <BulkDeleteModal
            isOpen={showBulkDeleteModal}
            onClose={() => setShowBulkDeleteModal(false)}
            onConfirm={handleBulkDelete}
            itemCount={selectedCount}
            itemLabel={isInventory ? t('garments.inventoryItems') : t('garments.lists')}
            isLoading={deleting}
          />

          {isInventory ? (
            <>
              <InventoryBulkTagsDialog
                isOpen={showBulkTagsDialog}
                onClose={() => setShowBulkTagsDialog(false)}
                selectedItems={selectedInventoryItems}
                availableTags={availableTags}
                applyTagToInventoryItem={applyTagToInventoryItem}
                clearTagsFromInventoryItem={clearTagsFromInventoryItem}
                onSuccess={clearSelection}
              />
              <InventoryBulkListsDialog
                isOpen={showBulkListsDialog}
                onClose={() => setShowBulkListsDialog(false)}
                selectedItems={selectedInventoryItems}
                garmentLists={garmentLists}
                assignInventoryItemToList={assignInventoryItemToList}
                unassignInventoryItemFromList={unassignInventoryItemFromList}
                onSuccess={clearSelection}
              />
            </>
          ) : null}

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
                {filteredCount === 0 ? (
                  <ListEmptyState
                    message={
                      searchTerm
                        ? t('garments.noSearchResults')
                        : isInventory
                          ? t('garments.noInventoryYet')
                          : t('garments.noListsYet')
                    }
                    createLabel={
                      !searchTerm
                        ? isInventory
                          ? t('garments.addInventory')
                          : t('garments.addList')
                        : undefined
                    }
                    onCreate={
                      !searchTerm
                        ? () =>
                            attemptNavigation(() =>
                              isInventory ? openInventoryPanel(null) : openGarmentPanel(null),
                            )
                        : undefined
                    }
                  />
                ) : isInventory ? (
                  <InventoryListTable
                    items={filteredInventory}
                    primarySort={inventorySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSortInventory}
                    isSelected={isSelected}
                    onRowClick={handleInventoryRowActivate}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={handleHeaderCheckboxChange}
                    selectionEnabled={selectionMode}
                    activeInventoryId={activeListItemId}
                    recentlyDuplicatedInventoryId={recentlyDuplicatedInventoryId}
                    visibleColumnIds={visibleColumnIds}
                  />
                ) : (
                  <GarmentListTable
                    items={filteredLists}
                    primarySort={listSort}
                    sortOrder={sortOrder}
                    onSort={handleTableSortList}
                    isSelected={isSelected}
                    onRowClick={handleListRowActivate}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={handleHeaderCheckboxChange}
                    recentlyDuplicatedListId={recentlyDuplicatedListId}
                    selectionEnabled={selectionMode}
                    activeListId={activeListItemId}
                  />
                )}

                <ListFooterBar
                  meta={<>{t('garments.showingOf', { shown: filteredCount, total: totalCount })}</>}
                />
              </div>
            </div>

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('garments.quickContext.title', { defaultValue: 'Quick context' })}
                aria-live="polite"
              >
                {inlineForm ? (
                  <GarmentForm
                    ref={inlineFormRef}
                    currentGarment={isInventory ? null : currentGarment}
                    currentItem={isInventory ? null : currentGarment}
                    onSave={handleInlineFormOnSave}
                    onCancel={handleInlineFormCancel}
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
                ) : detailOpen ? (
                  isInventory ? (
                    <GarmentView inventoryItem={detailInventory} stacked />
                  ) : (
                    <GarmentView garment={detailList} stacked />
                  )
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <GarmentsStatisticsView />
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
