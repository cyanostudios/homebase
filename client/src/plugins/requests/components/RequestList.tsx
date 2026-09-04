import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Circle,
  Inbox,
  LayoutGrid,
  Link2Off,
  Plus,
  Settings,
  SlidersHorizontal,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableQuickAdd } from '@/components/ui/round-expandable-quick-add';
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
import { nextListTableSort } from '@/core/list/listViewMode';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useRequests } from '../hooks/useRequests';
import { useRequestTeams } from '../hooks/useRequestTeams';
import { getTypeLabel, isRequestUnopened } from '../types/requests';
import type { Request, RequestPriority, RequestStatus } from '../types/requests';
import {
  getInitialRequestColumnCount,
  REQUESTS_COLUMN_COUNT_STORAGE_KEY,
  type RequestColumnCount,
} from '../utils/requestColumnCount';
import {
  REQUEST_LIST_FILTER_INITIAL,
  requestMatchesListFilters,
  toggleRequestListFilter,
  type RequestListFilter,
  type RequestListFilterSelection,
} from '../utils/requestListFilter';
import {
  buildRequestListPrioritySavePayload,
  buildRequestListStatusSavePayload,
  buildRequestResponseDueSavePayload,
  buildRequestTypeSavePayload,
} from '../utils/requestListSave';
import {
  compareRequestsByField,
  isRequestAscDefaultField,
  type RequestSortField,
  type RequestSortOrder,
} from '../utils/requestListSort';
import {
  getInitialRequestListViewMode,
  persistRequestListViewModeSession,
  type RequestListViewMode,
} from '../utils/requestListViewMode';
import {
  resolveVisibleRequestTableColumns,
  type RequestTableColumnId,
} from '../utils/requestTableColumns';

import { RequestBulkStatusDialog } from './RequestBulkStatusDialog';
import { RequestListItem } from './RequestListItem';
import { RequestListTable } from './RequestListTable';
import { RequestQuickContextPanel } from './RequestQuickContextPanel';
import { RequestsSettingsView, type RequestsSettingsCategory } from './RequestsSettingsView';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';

type TypeFilter = 'all' | string;
type TeamFilter = 'all' | 'unlinked';
type SortField = RequestSortField;
type SortOrder = RequestSortOrder;

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'updated_at', labelKey: 'common.updated' },
  { value: 'responseDueAt', labelKey: 'requests.responseDue.label' },
  { value: 'created_at', labelKey: 'requests.view.created' },
  { value: 'title', labelKey: 'requests.form.title' },
  { value: 'status', labelKey: 'requests.form.status' },
  { value: 'priority', labelKey: 'requests.form.priority' },
  { value: 'type', labelKey: 'requests.form.requestType' },
];

export function RequestList() {
  const { t } = useTranslation();
  const { contacts, getSettings, settingsVersion } = useApp();
  const teams = useRequestTeams();
  const {
    requests,
    requestTypes,
    requestsContentView,
    openRequestPanel,
    openRequestForView,
    openRequestForEdit,
    openRequestSettings,
    closeRequestSettingsView,
    selectedRequestIds,
    mergeIntoRequestSelection,
    clearRequestSelection,
    isSelected,
    toggleRequestSelected,
    deleteRequests,
    selectedCount,
    createRequest,
    saveRequest,
    markRequestViewed,
  } = useRequests();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openRequestPanel(null)),
    onSettings: openRequestSettings,
  });

  const { searchTerm: search, setSearchTerm: setSearch } = usePersistedListSearch('requests');
  useRegisterMobileSearch({
    value: search,
    onChange: setSearch,
    placeholder: t('requests.searchPlaceholder', { count: requests.length }),
  });
  const [selectionMode, setSelectionMode] = useState(false);
  const [activeFilters, setActiveFilters] = useState<RequestListFilterSelection>(
    REQUEST_LIST_FILTER_INITIAL,
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [columnCount, setColumnCountState] = useState<RequestColumnCount>(() => {
    const initial = getInitialRequestColumnCount();
    return (initial === 1 || initial === 2 ? 3 : initial) as RequestColumnCount;
  });
  const [listViewMode, setListViewModeState] = useState<RequestListViewMode>(
    getInitialRequestListViewMode,
  );
  const [visibleColumnIds, setVisibleColumnIds] = useState<RequestTableColumnId[]>(() =>
    resolveVisibleRequestTableColumns(null),
  );
  const [settingsCategory, setSettingsCategory] = useState<RequestsSettingsCategory>('types');
  const [primarySort, setPrimarySort] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [recentlyQuickAddedId, setRecentlyQuickAddedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings('requests')
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setVisibleColumnIds(resolveVisibleRequestTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback((_count: RequestColumnCount) => {
    const next = 3 as RequestColumnCount;
    setColumnCountState(next);
    setListViewModeState('cards');
    persistRequestListViewModeSession('cards');
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(REQUESTS_COLUMN_COUNT_STORAGE_KEY, String(next));
    }
  }, []);

  const setListViewMode = useCallback((mode: RequestListViewMode) => {
    setListViewModeState(mode);
    persistRequestListViewModeSession(mode);
  }, []);

  const isTableView = useIsEffectiveTableView(listViewMode);

  const teamById = useMemo(() => {
    const map = new Map<number, string>();
    for (const team of teams) {
      map.set(Number(team.id), formatTeamLabel(team) || team.name);
    }
    return map;
  }, [teams]);

  const getAssignedNames = useCallback(
    (request: Request) => {
      const ids = Array.isArray(request.assignedToIds) ? request.assignedToIds : [];
      return ids
        .map((id) => {
          const contact = contacts.find(
            (c: { id: string | number; companyName?: string }) => String(c.id) === String(id),
          );
          return contact?.companyName || '';
        })
        .filter(Boolean);
    },
    [contacts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((req) => {
      if (!requestMatchesListFilters(req, activeFilters)) {
        return false;
      }
      if (typeFilter !== 'all' && req.requestType !== typeFilter) {
        return false;
      }
      if (teamFilter === 'unlinked' && req.teamId != null) {
        return false;
      }
      if (!q) {
        return true;
      }
      const teamName = req.teamId ? teamById.get(req.teamId) || '' : '';
      return [req.title, req.description, req.submitterName, teamName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [requests, search, activeFilters, typeFilter, teamFilter, teamById]);

  const isFilterActive = (filter: RequestListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: RequestListFilter) => {
    setActiveFilters((prev) => toggleRequestListFilter(prev, filter));
  };

  const stats = useMemo(
    () => ({
      all: requests.length,
      active: requests.filter((r) => r.status === 'not started' || r.status === 'in progress')
        .length,
      unlinked: requests.filter((r) => r.teamId == null).length,
    }),
    [requests],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: requests.length };
    for (const request of requests) {
      if (request.requestType) {
        counts[request.requestType] = (counts[request.requestType] ?? 0) + 1;
      }
    }
    return counts;
  }, [requests]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => compareRequestsByField(a, b, primarySort, sortOrder));
    return list;
  }, [filtered, primarySort, sortOrder]);

  const visibleIds = useMemo(() => sorted.map((r) => r.id), [sorted]);

  const selectedRequests = useMemo(
    () => requests.filter((r) => selectedRequestIds.includes(r.id)),
    [requests, selectedRequestIds],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isRequestAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isRequestAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const allVisibleSelected = sorted.length > 0 && sorted.every((request) => isSelected(request.id));

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearRequestSelection();
    } else {
      mergeIntoRequestSelection(sorted.map((r) => r.id));
    }
  };

  const {
    previewItem: previewRequest,
    setPreviewItem: setPreviewRequest,
    showQuickContext,
    markPendingAndOpen,
    activateRow,
  } = useQuickContextPreview({
    storeKey: 'requests',
    items: requests,
    getItemId: (request) => String(request.id),
  });

  const quickContextOpen = Boolean(showQuickContext && previewRequest);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount, { quickContextOpen });
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount, { quickContextOpen });

  const handleOpenForView = (request: Request) => {
    markPendingAndOpen(request, () => attemptNavigation(() => openRequestForView(request)));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearRequestSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (request: Request) => {
    if (selectionMode) {
      toggleRequestSelected(String(request.id));
      return;
    }
    activateRow(request, (item) => attemptNavigation(() => openRequestForView(item)));
  };

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    return [
      {
        key: 'status',
        label: t('requests.bulkStatusAction'),
        icon: SlidersHorizontal,
        disabled,
        onClick: () => setShowBulkStatusDialog(true),
      },
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

  useEffect(() => {
    if (previewRequest && showQuickContext) {
      void markRequestViewed(previewRequest.id);
    }
  }, [markRequestViewed, previewRequest, showQuickContext]);

  const isRequestHighlighted = useCallback(
    (request: Request) => isRequestUnopened(request) || recentlyQuickAddedId === String(request.id),
    [recentlyQuickAddedId],
  );

  const handleListStatusChange = useCallback(
    async (request: Request, newStatus: RequestStatus) => {
      if (request.status === newStatus) {
        return;
      }
      await saveRequest(buildRequestListStatusSavePayload(request, newStatus), request.id);
    },
    [saveRequest],
  );

  const handleListPriorityChange = useCallback(
    async (request: Request, newPriority: RequestPriority) => {
      if (request.priority === newPriority) {
        return;
      }
      await saveRequest(buildRequestListPrioritySavePayload(request, newPriority), request.id);
    },
    [saveRequest],
  );

  const handleListTypeChange = useCallback(
    async (request: Request, newType: string) => {
      if (request.requestType === newType) {
        return;
      }
      await saveRequest(buildRequestTypeSavePayload(request, newType), request.id);
    },
    [saveRequest],
  );

  const handleListResponseDueChange = useCallback(
    async (request: Request, _days: number, responseDueAt: string) => {
      if (request.responseDueAt === responseDueAt) {
        return;
      }
      await saveRequest(buildRequestResponseDueSavePayload(request, responseDueAt), request.id);
    },
    [saveRequest],
  );

  const handleQuickCreate = useCallback(
    async (title: string) => {
      const request = await createRequest({ title });
      setRecentlyQuickAddedId(String(request.id));
    },
    [createRequest],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoRequestSelection,
      toggleOne: toggleRequestSelected,
    });

  if (requestsContentView === 'settings') {
    return (
      <div className="plugin-requests min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          <RequestsSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            onClose={closeRequestSettingsView}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('plugin-requests', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.requests')}</h2>
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('common.settings')}
                    variant="soft"
                    onClick={openRequestSettings}
                  />
                  {sorted.length > 0 ? (
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
                  <RoundExpandableQuickAdd
                    label={t('requests.quickAdd')}
                    placeholder={t('requests.quickAddPlaceholder')}
                    onCreate={handleQuickCreate}
                    defaultExpanded
                    variant={quickContextOpen ? 'soft' : 'primary'}
                  />
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
                value={search}
                onChange={setSearch}
                placeholder={t('requests.searchPlaceholder', { count: requests.length })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`requests.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('requests.addRequest')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openRequestPanel(null))}
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
                {t('requests.filterAll')}{' '}
                <span className="tabular-nums font-semibold">({stats.all})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('active')}
              className={cn(
                isFilterActive('active') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Circle className="h-3.5 w-3.5" />
              <span>
                {t('requests.statActive')}{' '}
                <span className="tabular-nums font-semibold">({stats.active})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTeamFilter(teamFilter === 'unlinked' ? 'all' : 'unlinked')}
              className={cn(
                teamFilter === 'unlinked' ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Link2Off className="h-3.5 w-3.5" />
              <span>
                {t('requests.statNotRelated')}{' '}
                <span className="tabular-nums font-semibold">({stats.unlinked})</span>
              </span>
            </Button>
            {requestTypes.map((type) => {
              const typeKey = type.key;
              const isActive = typeFilter === typeKey;
              return (
                <Button
                  key={typeKey}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTypeFilter(isActive ? 'all' : typeKey)}
                  className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
                >
                  <Inbox className="h-3.5 w-3.5" />
                  <span>
                    {getTypeLabel(typeKey, t)}{' '}
                    <span className="tabular-nums font-semibold">({typeCounts[typeKey] ?? 0})</span>
                  </span>
                </Button>
              );
            })}
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
                    {t(option.labelKey)}
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

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={async () => {
            await deleteRequests(selectedRequestIds);
            setShowBulkDeleteModal(false);
          }}
          itemCount={selectedCount}
          itemLabel={selectedCount === 1 ? t('requests.itemSingular') : t('requests.itemPlural')}
        />
        <RequestBulkStatusDialog
          isOpen={showBulkStatusDialog}
          onClose={() => setShowBulkStatusDialog(false)}
          selectedRequests={selectedRequests}
          saveRequest={saveRequest}
          onSuccess={clearRequestSelection}
        />

        <div className="flex flex-col gap-3">
          <div
            className={cn(
              'grid items-start gap-4',
              showQuickContext && previewRequest ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
            )}
          >
            {showQuickContext && previewRequest ? (
              <aside className="min-w-0 self-start lg:sticky lg:top-4 lg:z-10">
                <RequestQuickContextPanel
                  request={previewRequest}
                  onClose={() => setPreviewRequest(null)}
                  onOpenFullProfile={() => handleOpenForView(previewRequest)}
                  onEdit={() => {
                    markPendingAndOpen(previewRequest, () =>
                      attemptNavigation(() => openRequestForEdit(previewRequest)),
                    );
                  }}
                  onStatusChange={(status) => void handleListStatusChange(previewRequest, status)}
                  onPriorityChange={(priority) =>
                    void handleListPriorityChange(previewRequest, priority)
                  }
                  onTypeChange={(requestType) =>
                    void handleListTypeChange(previewRequest, requestType)
                  }
                  onResponseDueChange={(days, responseDueAt) =>
                    void handleListResponseDueChange(previewRequest, days, responseDueAt)
                  }
                />
              </aside>
            ) : null}
            <div className="flex min-w-0 flex-col gap-3">
              {sorted.length === 0 ? (
                <ListEmptyState
                  message={requests.length === 0 ? t('requests.noYet') : t('requests.noMatchTitle')}
                  createLabel={requests.length === 0 ? t('requests.addRequest') : undefined}
                  onCreate={
                    requests.length === 0
                      ? () => attemptNavigation(() => openRequestPanel(null))
                      : undefined
                  }
                />
              ) : isTableView ? (
                <RequestListTable
                  requests={sorted}
                  primarySort={primarySort}
                  sortOrder={sortOrder}
                  onSort={handleTableSort}
                  isSelected={isSelected}
                  onRowClick={handleRowActivate}
                  onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                  onCheckboxChange={onVisibleRowCheckboxChange}
                  allVisibleSelected={allVisibleSelected}
                  onHeaderCheckboxChange={handleHeaderCheckboxChange}
                  recentlyQuickAddedId={recentlyQuickAddedId}
                  isRequestHighlighted={isRequestHighlighted}
                  selectionEnabled={selectionMode}
                  activeRequestId={previewRequest?.id ?? null}
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
                  {sorted.map((request, index) => {
                    const requestIsSelected = isSelected(request.id);
                    return (
                      <RequestListItem
                        key={request.id}
                        request={request}
                        selected={requestIsSelected}
                        highlighted={isRequestHighlighted(request)}
                        active={
                          previewRequest != null && String(previewRequest.id) === String(request.id)
                        }
                        teamName={request.teamId ? teamById.get(request.teamId) || null : null}
                        assignedNames={getAssignedNames(request)}
                        onClick={() => handleRowActivate(request)}
                        onStatusChange={(status) => void handleListStatusChange(request, status)}
                        onPriorityChange={(priority) =>
                          void handleListPriorityChange(request, priority)
                        }
                        columnCount={effectiveCardColumnCount}
                        checkbox={
                          selectionMode ? (
                            <input
                              type="checkbox"
                              checked={requestIsSelected}
                              onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                              onChange={() => onVisibleRowCheckboxChange(request.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 cursor-pointer"
                              aria-label={requestIsSelected ? 'Unselect request' : 'Select request'}
                            />
                          ) : undefined
                        }
                      />
                    );
                  })}
                </div>
              )}

              <ListFooterBar
                meta={t('requests.showingCount', {
                  shown: sorted.length,
                  total: requests.length,
                })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
