import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Inbox,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useRequests } from '../hooks/useRequests';
import { useRequestTeams } from '../hooks/useRequestTeams';
import { getTypeLabel } from '../types/requests';
import type { Request, RequestPriority, RequestStatus } from '../types/requests';
import {
  getInitialRequestColumnCount,
  REQUESTS_COLUMN_COUNT_STORAGE_KEY,
  type RequestColumnCount,
} from '../utils/requestColumnCount';
import {
  buildRequestListPrioritySavePayload,
  buildRequestListStatusSavePayload,
} from '../utils/requestListSave';
import {
  compareRequestsByField,
  isRequestStringSortField,
  type RequestSortField,
  type RequestSortOrder,
} from '../utils/requestListSort';

import { RequestBulkStatusDialog } from './RequestBulkStatusDialog';
import { RequestListItem } from './RequestListItem';
import { RequestQuickAdd } from './RequestQuickAdd';
import { RequestsSettingsView } from './RequestsSettingsView';

type StatusFilter = 'all' | 'active' | RequestStatus;
type TypeFilter = 'all' | string;
type TeamFilter = 'all' | 'unlinked';
type SortField = RequestSortField;
type SortOrder = RequestSortOrder;

const COLUMN_OPTIONS: RequestColumnCount[] = [1, 2, 3];

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'updated_at', labelKey: 'common.updated' },
  { value: 'created_at', labelKey: 'requests.view.created' },
  { value: 'title', labelKey: 'requests.form.title' },
  { value: 'status', labelKey: 'requests.form.status' },
  { value: 'priority', labelKey: 'requests.form.priority' },
  { value: 'type', labelKey: 'requests.form.requestType' },
  { value: 'source', labelKey: 'requests.view.source' },
];

export function RequestList() {
  const { t } = useTranslation();
  const { contacts } = useApp();
  const teams = useRequestTeams();
  const {
    requests,
    requestTypes,
    requestsContentView,
    openRequestPanel,
    openRequestForView,
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
  } = useRequests();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [columnCount, setColumnCountState] = useState<RequestColumnCount>(
    getInitialRequestColumnCount,
  );
  const [primarySort, setPrimarySort] = useState<SortField>('updated_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [recentlyQuickAddedId, setRecentlyQuickAddedId] = useState<string | null>(null);

  const setColumnCount = useCallback((count: RequestColumnCount) => {
    setColumnCountState(count);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(REQUESTS_COLUMN_COUNT_STORAGE_KEY, String(count));
    }
  }, []);

  const teamById = useMemo(() => {
    const map = new Map<number, string>();
    for (const team of teams) {
      map.set(Number(team.id), team.name);
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
      if (statusFilter === 'active') {
        if (req.status !== 'not started' && req.status !== 'in progress') {
          return false;
        }
      } else if (statusFilter !== 'all' && req.status !== statusFilter) {
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
  }, [requests, search, statusFilter, typeFilter, teamFilter, teamById]);

  const stats = useMemo(
    () => ({
      all: requests.length,
      active: requests.filter((r) => r.status === 'not started' || r.status === 'in progress')
        .length,
      completed: requests.filter((r) => r.status === 'completed').length,
      external: requests.filter((r) => r.source === 'external').length,
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
    setSortOrder(isRequestStringSortField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const allVisibleSelected = sorted.length > 0 && sorted.every((request) => isSelected(request.id));

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearRequestSelection();
    } else {
      mergeIntoRequestSelection(sorted.map((r) => r.id));
    }
  };

  const handleOpenForView = (request: Request) => {
    attemptNavigation(() => openRequestForView(request));
  };

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

  const hasActiveFilters = Boolean(
    search || statusFilter !== 'active' || typeFilter !== 'all' || teamFilter !== 'all',
  );

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilter('active');
    setTypeFilter('all');
    setTeamFilter('all');
  };

  if (requestsContentView === 'settings') {
    return (
      <div className="plugin-requests min-h-full bg-background">
        <div className="px-6 py-4">
          <RequestsSettingsView
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeRequestSettingsView}
              >
                {t('common.close')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-requests min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.requests')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('requests.listDescription', { count: requests.length })}
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={openRequestSettings}
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openRequestPanel(null))}
            >
              {t('requests.addRequest')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ListFilterStatCard
            label={t('requests.filterAll')}
            value={stats.all}
            dotClassName="bg-slate-400"
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <ListFilterStatCard
            label={t('requests.statActive')}
            value={stats.active}
            dotClassName="bg-blue-500"
            active={statusFilter === 'active'}
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          />
          <ListFilterStatCard
            label={t('requests.statCompleted')}
            value={stats.completed}
            dotClassName="bg-emerald-500"
            active={statusFilter === 'completed'}
            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'active' : 'completed')}
          />
          <ListFilterStatCard
            label={t('requests.statExternal')}
            value={stats.external}
            dotClassName="bg-purple-500"
            active={false}
          />
          <ListFilterStatCard
            label={t('requests.statNotRelated')}
            value={stats.unlinked}
            dotClassName="bg-slate-500"
            active={teamFilter === 'unlinked'}
            onClick={() => setTeamFilter(teamFilter === 'unlinked' ? 'all' : 'unlinked')}
          />
        </div>

        {requestTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            {requestTypes.map((type) => {
              const isActive = typeFilter === type;
              return (
                <Button
                  key={type}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTypeFilter(isActive ? 'all' : type)}
                  className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
                >
                  <Inbox className="h-3.5 w-3.5" />
                  <span>
                    {getTypeLabel(type, t)}{' '}
                    <span className="tabular-nums font-semibold">({typeCounts[type] ?? 0})</span>
                  </span>
                </Button>
              );
            })}
          </div>
        )}

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
          <ListToolbar
            selectedCount={selectedCount}
            showSelectAll={sorted.length > 0}
            selectAll={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                icon={CheckSquare}
                onClick={handleHeaderCheckboxChange}
              >
                {t('common.selectAll')}
              </Button>
            }
            search={
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('requests.searchPlaceholder', { count: requests.length })}
                  className="h-8 bg-background pl-9 text-xs"
                />
              </div>
            }
            trailing={
              <>
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={XCircle}
                    className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                    onClick={clearAllFilters}
                  >
                    {t('common.clearFilters')}
                  </Button>
                )}
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
                <div
                  className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5"
                  role="group"
                  aria-label={t('requests.columnsLabel')}
                >
                  {COLUMN_OPTIONS.map((count) => (
                    <Button
                      key={count}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-7 min-w-7 rounded-[6px] px-2 text-xs',
                        columnCount === count
                          ? 'bg-background text-foreground shadow-sm hover:bg-background'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => setColumnCount(count)}
                      aria-label={t(`requests.columns${count}`)}
                      aria-pressed={columnCount === count}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </>
            }
            bulkActions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={XCircle}
                  className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                  onClick={clearRequestSelection}
                  type="button"
                >
                  {t('common.clearSelection')}
                </Button>
                <span className="inline-flex h-9 items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[10px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                  {t('bulk.selected', { count: selectedCount })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={SlidersHorizontal}
                  onClick={() => setShowBulkStatusDialog(true)}
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                >
                  {t('requests.bulkStatusAction')}
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
          ) : (
            <div
              className={cn(
                'grid gap-3',
                columnCount === 1 && 'grid-cols-1',
                columnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                columnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
              )}
            >
              {sorted.map((request, index) => {
                const requestIsSelected = isSelected(request.id);
                return (
                  <RequestListItem
                    key={request.id}
                    request={request}
                    selected={requestIsSelected}
                    highlighted={recentlyQuickAddedId === String(request.id)}
                    teamName={request.teamId ? teamById.get(request.teamId) || null : null}
                    assignedNames={getAssignedNames(request)}
                    onClick={() => handleOpenForView(request)}
                    onStatusChange={(status) => void handleListStatusChange(request, status)}
                    onPriorityChange={(priority) =>
                      void handleListPriorityChange(request, priority)
                    }
                    columnCount={columnCount}
                    checkbox={
                      <input
                        type="checkbox"
                        checked={requestIsSelected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(request.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={requestIsSelected ? 'Unselect request' : 'Select request'}
                      />
                    }
                  />
                );
              })}
              <RequestQuickAdd
                viewMode="grid"
                onCreate={handleQuickCreate}
                className="col-span-full"
              />
            </div>
          )}

          {sorted.length === 0 ? (
            <RequestQuickAdd viewMode="grid" onCreate={handleQuickCreate} />
          ) : null}

          <ListFooterBar
            meta={t('requests.showingCount', { shown: sorted.length, total: requests.length })}
          />
        </div>
      </div>
    </div>
  );
}
