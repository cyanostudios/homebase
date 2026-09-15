import {
  AlertCircle,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  LayoutGrid,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { useTimeFormat } from '@/core/settings/useTimeFormat';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListFilterChipsToggle } from '@/core/ui/ListFilterChipsToggle';
import { PluginSettingsPageShell } from '@/core/ui/PluginSettingsPageShell';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { usePulses } from '../hooks/usePulses';
import {
  pulseHistoryMatchesListFilters,
  togglePulseHistoryListFilter,
  type PulseHistoryListFilter,
} from '../utils/pulseHistoryListFilter';

const ALL_PLUGINS_VALUE = '__all__';
const PULSES_HISTORY_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.pulses.history.filtersVisible';
const headerDropdownTriggerClass =
  'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';
const headerDropdownTriggerDangerClass =
  'gap-1.5 border-0 bg-red-600/10 px-3.5 text-sm font-extrabold text-red-700 shadow-none hover:bg-red-600 hover:text-white dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white';

export const PulseHistoryView: React.FC = () => {
  useTimeFormat();
  const { t } = useTranslation();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const {
    pulseHistory,
    providers,
    routing,
    loading,
    loadHistory,
    closePulseSettingsView,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelected,
    clearSelection,
    replaceSelectedIds,
    mergeIntoSelection,
    deleteHistory,
  } = usePulses();
  const { searchTerm, setSearchTerm } = usePersistedListSearch('pulses-history');
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    PULSES_HISTORY_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const [pluginFilter, setPluginFilter] = useState('');
  const [activeFilters, setActiveFilters] = useState<PulseHistoryListFilter[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    attemptNavigation(closePulseSettingsView);
  }, [attemptNavigation, closePulseSettingsView]);

  const isFilterActive = (filter: PulseHistoryListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: PulseHistoryListFilter) => {
    setActiveFilters((prev) => togglePulseHistoryListFilter(prev, filter));
  };

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    let failed = 0;
    let todayCount = 0;
    for (const entry of pulseHistory) {
      if (String(entry.status || '').toLowerCase() === 'failed') {
        failed += 1;
      }
      if (entry.sentAt && new Date(entry.sentAt).toDateString() === today) {
        todayCount += 1;
      }
    }
    return { total: pulseHistory.length, failed, today: todayCount };
  }, [pulseHistory]);

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const baseFiltered = pulseHistory.filter((entry) => {
      const matchSearch =
        !needle ||
        entry.recipient.toLowerCase().includes(needle) ||
        (entry.body || '').toLowerCase().includes(needle);
      const matchPlugin = !pluginFilter || entry.pluginSource === pluginFilter;
      return matchSearch && matchPlugin;
    });
    return baseFiltered.filter((entry) => pulseHistoryMatchesListFilters(entry, activeFilters));
  }, [pulseHistory, searchTerm, pluginFilter, activeFilters]);

  const pluginSources = useMemo(
    () =>
      Array.from(
        new Set(pulseHistory.map((e) => e.pluginSource).filter((ps): ps is string => !!ps)),
      ),
    [pulseHistory],
  );

  const statusBadge = useMemo(() => {
    const key = routing?.global?.providerKey;
    if (!key) {
      return { label: t('pulses.notConfigured'), isOk: false };
    }
    const provider = providers.find((p) => p.providerKey === key);
    const label = t(`pulses.providers.${key}.title`, { defaultValue: key });
    const isOk = Boolean(provider?.enabled && provider?.configured);
    return { label, isOk };
  }, [providers, routing, t]);

  const visibleIds = useMemo(() => filtered.map((e) => String(e.id)), [filtered]);

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection,
      toggleOne: toggleSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id)),
    [visibleIds, selectedIds],
  );

  const someVisibleSelected = useMemo(
    () => visibleIds.some((id) => selectedIds.includes(id)),
    [visibleIds, selectedIds],
  );

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const onToggleAllVisible = useCallback(() => {
    const visibleSet = new Set(visibleIds);
    if (allVisibleSelected) {
      replaceSelectedIds(selectedIds.filter((id) => !visibleSet.has(id)));
    } else {
      replaceSelectedIds(Array.from(new Set([...selectedIds, ...visibleIds])));
    }
  }, [allVisibleSelected, visibleIds, selectedIds, replaceSelectedIds]);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteHistory(selectedIds);
      setShowBulkDeleteModal(false);
    } catch (err) {
      console.error('Failed to delete pulse history:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearSelection();
    setSelectionMode(false);
  };

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    return [
      {
        key: 'delete',
        label: t('common.delete'),
        icon: Trash2,
        disabled: selectedCount === 0,
        tone: 'destructive',
        onClick: () => setShowBulkDeleteModal(true),
      },
    ];
  }, [selectedCount, t]);

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
    if (filtered.length === 0) {
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
        label: t('pulses.history.categories.all', { defaultValue: 'All' }),
        count: stats.total,
        onClick: () => setActiveFilters([]),
      },
      {
        key: 'failed',
        active: isFilterActive('failed'),
        icon: AlertCircle,
        label: t('pulses.history.categories.failed', { defaultValue: 'Failed' }),
        count: stats.failed,
        onClick: () => toggleFilter('failed'),
      },
      {
        key: 'today',
        active: isFilterActive('today'),
        icon: CalendarDays,
        label: t('pulses.history.categories.today', { defaultValue: 'Today' }),
        count: stats.today,
        onClick: () => toggleFilter('today'),
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

  const renderPluginDropdown = (triggerClassName: string) => {
    if (pluginSources.length === 0) {
      return null;
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(headerDropdownTriggerClass, triggerClassName)}
            aria-label={t('pulses.allPlugins')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>{pluginFilter ? pluginFilter : t('pulses.allPlugins')}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[14rem] rounded-xl border-border/50 shadow-xl"
        >
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
            {t('pulses.source')}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={pluginFilter || ALL_PLUGINS_VALUE}
            onValueChange={(value) => setPluginFilter(value === ALL_PLUGINS_VALUE ? '' : value)}
          >
            <DropdownMenuRadioItem
              value={ALL_PLUGINS_VALUE}
              className="rounded-md text-xs"
              onSelect={(event) => event.preventDefault()}
            >
              {t('pulses.allPlugins')}
            </DropdownMenuRadioItem>
            {pluginSources.map((ps) => (
              <DropdownMenuRadioItem
                key={ps}
                value={ps}
                className="rounded-md text-xs capitalize"
                onSelect={(event) => event.preventDefault()}
              >
                {ps}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="plugin-pulses flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="px-4 py-4 md:px-6">
        <PluginSettingsPageShell
          title={t('pulses.historyTitle', { defaultValue: 'Pulse – Sent SMS' })}
          subtitle={t('pulses.historyDescription', {
            defaultValue: 'Monitor SMS and message traffic from plugins.',
          })}
          onClose={handleClose}
          trailing={
            <>
              <RoundIconLabelButton
                type="button"
                icon={RefreshCw}
                label={t('pulses.refresh')}
                variant="secondary"
                alwaysExpanded
                onClick={() => loadHistory()}
                disabled={loading}
                className={cn(loading && '[&>svg]:animate-spin')}
              />
              <RoundIconLabelButton
                type="button"
                icon={X}
                label={t('common.close')}
                variant="secondary"
                alwaysExpanded
                onClick={handleClose}
              />
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <Badge
                  className={cn(
                    BADGE_CHIP_CLASS,
                    statusBadge.isOk
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                  )}
                >
                  {statusBadge.label}
                </Badge>
                {renderPluginDropdown('h-11 rounded-full')}
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
                  placeholder={t('pulses.searchPlaceholder')}
                />
              </div>
            </div>

            {filtersVisible ? (
              <div className={LIST_FILTER_AND_SORT_ROW_CLASS}>{renderFilterChips()}</div>
            ) : null}

            {renderBulkActionBar('py-3')}

            <BulkDeleteModal
              isOpen={showBulkDeleteModal}
              onClose={() => setShowBulkDeleteModal(false)}
              onConfirm={handleBulkDelete}
              itemCount={selectedCount}
              itemLabel="pulses"
              isLoading={deleting}
            />

            {loading && pulseHistory.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('common.loading')}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('pulses.emptyHistory')}
              </div>
            ) : (
              <Table rowBorders={false}>
                <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
                  <TableRow>
                    {selectionMode ? (
                      <TableHead className="hidden w-12 text-xs md:table-cell">
                        <input
                          ref={headerCheckboxRef}
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer"
                          aria-label={allVisibleSelected ? 'Unselect all' : 'Select all'}
                          checked={allVisibleSelected}
                          onChange={onToggleAllVisible}
                        />
                      </TableHead>
                    ) : null}
                    <TableHead className="text-xs">{t('pulses.date')}</TableHead>
                    <TableHead className="text-xs">{t('pulses.recipient')}</TableHead>
                    <TableHead className="text-xs">{t('pulses.body')}</TableHead>
                    <TableHead className="text-xs">{t('pulses.status')}</TableHead>
                    <TableHead className="text-xs">{t('pulses.source')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry, index) => (
                    <TableRow
                      key={entry.id}
                      className={cn(
                        'bg-white transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80',
                        selectionMode && isSelected(entry.id) && 'bg-plugin-subtle',
                      )}
                    >
                      {selectionMode ? (
                        <TableCell
                          className="hidden w-12 text-xs md:table-cell"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer"
                            checked={isSelected(entry.id)}
                            onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                            onChange={() => onVisibleRowCheckboxChange(entry.id)}
                            aria-label={isSelected(entry.id) ? 'Deselect row' : 'Select row'}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.sentAt ? formatDateTimeShort(entry.sentAt) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs" title={entry.recipient}>
                        {entry.recipient}
                      </TableCell>
                      <TableCell
                        className="max-w-[240px] truncate text-xs"
                        title={entry.body || ''}
                      >
                        {entry.body || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          className={cn(
                            BADGE_CHIP_CLASS,
                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                          )}
                        >
                          {entry.status || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.pluginSource ? (
                          <Badge
                            className={cn(
                              BADGE_CHIP_CLASS,
                              'capitalize',
                              entry.pluginSource === 'notes' &&
                                'plugin-notes bg-plugin-subtle text-plugin',
                              entry.pluginSource === 'contacts' &&
                                'plugin-contacts bg-plugin-subtle text-plugin',
                              entry.pluginSource === 'tasks' &&
                                'plugin-tasks bg-plugin-subtle text-plugin',
                              entry.pluginSource === 'estimates' &&
                                'plugin-estimates bg-plugin-subtle text-plugin',
                              entry.pluginSource === 'invoices' &&
                                'plugin-invoices bg-plugin-subtle text-plugin',
                              entry.pluginSource === 'files' &&
                                'plugin-files bg-plugin-subtle text-plugin',
                              entry.pluginSource === 'ingest' &&
                                'plugin-ingest bg-plugin-subtle text-plugin',
                            )}
                          >
                            {entry.pluginSource}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="border-t border-border/60 pt-2 text-xs text-muted-foreground">
              Showing {filtered.length} of {pulseHistory.length} Pulses
            </div>
          </div>
        </PluginSettingsPageShell>
      </div>
    </div>
  );
};
