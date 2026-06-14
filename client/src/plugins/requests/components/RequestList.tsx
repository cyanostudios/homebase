import {
  ArrowDown,
  ArrowUp,
  Grid3x3,
  Inbox,
  List as ListIcon,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useRequestTeams } from '../hooks/useRequestTeams';
import { useRequests } from '../hooks/useRequests';
import {
  formatRequestStatusForDisplay,
  getTypeLabel,
  REQUEST_PRIORITY_COLORS,
  REQUEST_SOURCE_COLORS,
  REQUEST_STATUS_COLORS,
} from '../types/requests';
import type { Request, RequestStatus } from '../types/requests';

import { RequestCard } from './RequestCard';
import { RequestQuickAdd } from './RequestQuickAdd';
import { RequestsSettingsView } from './RequestsSettingsView';

const HIGHLIGHT_CLASS = 'bg-green-50 dark:bg-green-950/30';

type StatusFilter = 'all' | 'active' | RequestStatus;
type TypeFilter = 'all' | string;
type TeamFilter = 'all' | 'unlinked';
type SortField = 'title' | 'status' | 'priority' | 'type' | 'updated_at' | 'created_at';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

const REQUESTS_VIEW_MODE_STORAGE_KEY = 'requests:viewMode';

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  return window.sessionStorage.getItem(REQUESTS_VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

function StatCard({
  label,
  value,
  dotClassName,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  dotClassName: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        'rounded-xl border-0 bg-card p-4 shadow-sm transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        active && 'ring-1 ring-border/70',
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} aria-hidden />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
    </Card>
  );
}

export function RequestList() {
  const { t } = useTranslation();
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
  } = useRequests();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [recentlyQuickAddedId, setRecentlyQuickAddedId] = useState<string | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const teamById = useMemo(() => {
    const map = new Map<number, string>();
    for (const team of teams) {
      map.set(Number(team.id), team.name);
    }
    return map;
  }, [teams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((req) => {
      if (statusFilter === 'active') {
        if (req.status !== 'not started' && req.status !== 'in progress') return false;
      } else if (statusFilter !== 'all' && req.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== 'all' && req.requestType !== typeFilter) return false;
      if (teamFilter === 'unlinked' && req.teamId != null) return false;
      if (!q) return true;
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
    list.sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';
      switch (sortField) {
        case 'title':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'priority': {
          const order = { High: 3, Medium: 2, Low: 1 };
          aValue = order[a.priority] ?? 0;
          bValue = order[b.priority] ?? 0;
          break;
        }
        case 'type':
          aValue = a.requestType;
          bValue = b.requestType;
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'updated_at':
        default:
          aValue = new Date(a.updated_at || a.created_at).getTime();
          bValue = new Date(b.updated_at || b.created_at).getTime();
          break;
      }
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortOrder === 'asc'
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue);
    });
    return list;
  }, [filtered, sortField, sortOrder]);

  const visibleIds = useMemo(() => sorted.map((r) => r.id), [sorted]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(REQUESTS_VIEW_MODE_STORAGE_KEY, mode);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
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
          <StatCard
            label={t('requests.filterAll')}
            value={stats.all}
            dotClassName="bg-slate-400"
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <StatCard
            label={t('requests.statActive')}
            value={stats.active}
            dotClassName="bg-blue-500"
            active={statusFilter === 'active'}
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          />
          <StatCard
            label={t('requests.statCompleted')}
            value={stats.completed}
            dotClassName="bg-emerald-500"
            active={statusFilter === 'completed'}
            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'active' : 'completed')}
          />
          <StatCard
            label={t('requests.statExternal')}
            value={stats.external}
            dotClassName="bg-purple-500"
            active={false}
          />
          <StatCard
            label={t('requests.statNotRelated')}
            value={stats.unlinked}
            dotClassName="bg-slate-500"
            active={teamFilter === 'unlinked'}
            onClick={() => setTeamFilter(teamFilter === 'unlinked' ? 'all' : 'unlinked')}
          />
        </div>

        {requestTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {requestTypes.map((type) => {
              const isActive = typeFilter === type;
              return (
                <Button
                  key={type}
                  type="button"
                  variant="ghost"
                  onClick={() => setTypeFilter(isActive ? 'all' : type)}
                  className={cn(
                    'group h-auto rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:px-5 sm:py-3 sm:text-sm',
                    'flex items-center gap-1.5 sm:gap-2',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary'
                      : 'border-transparent bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary',
                  )}
                >
                  <Inbox className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>
                    {getTypeLabel(type, t)}{' '}
                    <span
                      className={cn(
                        'tabular-nums font-semibold',
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-primary',
                      )}
                    >
                      ({typeCounts[type] ?? 0})
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        )}

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearRequestSelection}
            actions={[
              {
                label: t('common.delete'),
                icon: Trash2,
                variant: 'destructive',
                onClick: () => setShowBulkDeleteModal(true),
              },
            ]}
          />
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

        <Card
          className={cn(
            'rounded-xl border-0',
            viewMode === 'grid'
              ? 'overflow-visible bg-transparent shadow-none'
              : 'overflow-hidden bg-white shadow-sm dark:bg-slate-950',
          )}
        >
          <div
            className={cn(
              'flex flex-shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3',
              viewMode === 'grid' && 'mx-1 mt-1 rounded-xl bg-white dark:bg-slate-950',
            )}
          >
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('requests.searchPlaceholder', { count: requests.length })}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={XCircle}
                  className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:text-red-300"
                  onClick={clearAllFilters}
                >
                  {t('common.clearFilters')}
                </Button>
              )}
              <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Grid3x3}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'grid'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setViewMode('grid')}
                >
                  {t('slots.grid')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={ListIcon}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'list'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setViewMode('list')}
                >
                  {t('slots.list')}
                </Button>
              </div>
            </div>
          </div>

          {sorted.length === 0 ? (
            <Card className="border-0 shadow-none">
              <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
                <Inbox className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">
                  {requests.length === 0 ? t('requests.noYet') : t('requests.noMatchTitle')}
                </p>
                {requests.length > 0 && <p className="mt-1 text-xs">{t('requests.noMatch')}</p>}
              </div>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 px-1 pb-1 pt-4 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((request, index) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  selected={isSelected(request.id)}
                  highlighted={recentlyQuickAddedId === String(request.id)}
                  teamName={request.teamId ? teamById.get(request.teamId) || null : null}
                  onClick={() => handleOpenForView(request)}
                  checkbox={
                    <input
                      type="checkbox"
                      checked={isSelected(request.id)}
                      onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                      onChange={() => onVisibleRowCheckboxChange(request.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 cursor-pointer"
                      aria-label={isSelected(request.id) ? 'Unselect request' : 'Select request'}
                    />
                  }
                />
              ))}
              <RequestQuickAdd
                viewMode="grid"
                onCreate={handleQuickCreate}
                className="col-span-full"
              />
            </div>
          ) : (
            <Card className="border-0 shadow-none">
              <Table rowBorders={false}>
                <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-12 text-xs">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={handleHeaderCheckboxChange}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={
                          allVisibleSelected ? 'Deselect all requests' : 'Select all requests'
                        }
                      />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('requests.form.title')}</span>
                        {sortField === 'title' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('requests.form.requestType')}</span>
                        {sortField === 'type' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('requests.form.status')}</span>
                        {sortField === 'status' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('priority')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('requests.form.priority')}</span>
                        {sortField === 'priority' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">{t('requests.form.team')}</TableHead>
                    <TableHead className="text-xs">{t('requests.view.source')}</TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('updated_at')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('common.updated')}</span>
                        {sortField === 'updated_at' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((request, index) => {
                    const requestIsSelected = isSelected(request.id);
                    return (
                      <TableRow
                        key={request.id}
                        className={cn(
                          'cursor-pointer bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80',
                          requestIsSelected && 'bg-plugin-subtle',
                          recentlyQuickAddedId === String(request.id) && HIGHLIGHT_CLASS,
                        )}
                        tabIndex={0}
                        data-list-item={JSON.stringify(request)}
                        data-plugin-name="requests"
                        role="button"
                        aria-label={`Open request ${request.title}`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                            return;
                          }
                          e.preventDefault();
                          handleOpenForView(request);
                        }}
                      >
                        <TableCell className="w-12 text-xs" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={requestIsSelected}
                            onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                            onChange={() => onVisibleRowCheckboxChange(request.id)}
                            className="h-4 w-4 cursor-pointer"
                            aria-label={requestIsSelected ? 'Unselect request' : 'Select request'}
                          />
                        </TableCell>
                        <TableCell className="max-w-[240px] font-semibold">
                          <span className="line-clamp-1">{request.title}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {getTypeLabel(request.requestType, t)}
                        </TableCell>
                        <TableCell>
                          <Badge className={REQUEST_STATUS_COLORS[request.status]}>
                            {formatRequestStatusForDisplay(request.status, t)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={REQUEST_PRIORITY_COLORS[request.priority]}>
                            {request.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {request.teamId ? teamById.get(request.teamId) || '—' : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'border-transparent text-xs font-medium',
                              REQUEST_SOURCE_COLORS[request.source],
                            )}
                          >
                            {request.source === 'external'
                              ? t('requests.sourceExternal')
                              : t('requests.sourceInternal')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {request.updated_at
                            ? new Date(request.updated_at).toLocaleDateString()
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <RequestQuickAdd viewMode="list" onCreate={handleQuickCreate} />
            </Card>
          )}

          {sorted.length === 0 ? (
            <div className="px-1 pt-3">
              <RequestQuickAdd viewMode="grid" onCreate={handleQuickCreate} />
            </div>
          ) : null}

          <div
            className={cn(
              'px-4 py-2 text-xs text-muted-foreground',
              viewMode === 'grid'
                ? 'mx-1 mb-1 mt-3 rounded-xl bg-white dark:bg-slate-950'
                : 'border-t border-border/60',
            )}
          >
            {t('requests.showingCount', { shown: sorted.length, total: requests.length })}
          </div>
        </Card>
      </div>
    </div>
  );
}
