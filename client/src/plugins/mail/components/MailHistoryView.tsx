import { ArrowLeft, RefreshCw, Search, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useTimeFormat } from '@/core/settings/useTimeFormat';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useMail } from '../hooks/useMail';
import {
  mailHistoryMatchesListFilters,
  toggleMailHistoryListFilter,
  type MailHistoryListFilter,
} from '../utils/mailHistoryListFilter';

export const MailHistoryView: React.FC = () => {
  useTimeFormat();
  const { t } = useTranslation();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const {
    mailHistory,
    totalCount,
    loading,
    loadHistory,
    closeMailSettingsView,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelected,
    clearSelection,
    replaceSelectedIds,
    mergeIntoSelection,
    deleteHistory,
  } = useMail();
  const [searchTerm, setSearchTerm] = useState('');
  const [pluginFilter, setPluginFilter] = useState('');
  const [activeFilters, setActiveFilters] = useState<MailHistoryListFilter[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const baseFiltered = mailHistory.filter((entry) => {
      const matchSearch =
        !needle ||
        entry.to.toLowerCase().includes(needle) ||
        (entry.subject || '').toLowerCase().includes(needle);
      const matchPlugin = !pluginFilter || entry.pluginSource === pluginFilter;
      return matchSearch && matchPlugin;
    });
    return baseFiltered.filter((entry) => mailHistoryMatchesListFilters(entry, activeFilters));
  }, [mailHistory, searchTerm, pluginFilter, activeFilters]);

  const isFilterActive = (filter: MailHistoryListFilter) => activeFilters.includes(filter);
  const onToggleFilter = (filter: MailHistoryListFilter | 'all') => {
    setActiveFilters((prev) => toggleMailHistoryListFilter(prev, filter));
  };

  const pluginSources = useMemo(
    () =>
      Array.from(
        new Set(mailHistory.map((e) => e.pluginSource).filter((ps): ps is string => !!ps)),
      ),
    [mailHistory],
  );

  const stats = useMemo(
    () => ({
      total: mailHistory.length,
      filtered: filtered.length,
      withSource: mailHistory.filter((m) => Boolean(m.pluginSource)).length,
      today: mailHistory.filter((m) => {
        if (!m.sentAt) {
          return false;
        }
        return new Date(m.sentAt).toDateString() === new Date().toDateString();
      }).length,
    }),
    [mailHistory, filtered.length],
  );

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
      console.error('Failed to delete mail history:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="plugin-mail min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {t('mail.historyTitle', { defaultValue: 'Mail history' })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('mail.historyDescription', {
                defaultValue: 'Monitor email traffic from plugins.',
              })}
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
            <Badge
              variant="secondary"
              className="border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-secondary/50 text-secondary-foreground"
            >
              {totalCount} {t('mail.total', { defaultValue: 'Total' })}
            </Badge>
            {pluginSources.length > 0 && (
              <select
                value={pluginFilter}
                onChange={(e) => setPluginFilter(e.target.value)}
                className="h-9 min-w-[120px] rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">{t('mail.allPlugins', { defaultValue: 'All plugins' })}</option>
                {pluginSources.map((ps: string) => (
                  <option key={ps} value={ps}>
                    {ps}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowLeft}
              onClick={() => attemptNavigation(closeMailSettingsView)}
              className="h-9 px-3 text-xs"
            >
              {t('mail.backToProviders', { defaultValue: 'Providers' })}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={() => loadHistory()}
              disabled={loading}
              className={cn('h-9 px-3 text-xs', loading && '[&>svg]:animate-spin')}
            >
              {t('mail.refresh', { defaultValue: 'Refresh' })}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <ListFilterStatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilters.length === 0}
            onClick={() => setActiveFilters([])}
          />
          <ListFilterStatCard
            label="Filtered"
            value={stats.filtered}
            dotClassName="bg-emerald-500"
            active={activeFilters.length === 0}
            onClick={() => setActiveFilters([])}
          />
          <ListFilterStatCard
            label="With Source"
            value={stats.withSource}
            dotClassName="bg-amber-500"
            active={isFilterActive('withSource')}
            onClick={() => onToggleFilter('withSource')}
          />
          <ListFilterStatCard
            label="Sent Today"
            value={stats.today}
            dotClassName="bg-violet-500"
            active={isFilterActive('today')}
            onClick={() => onToggleFilter('today')}
          />
        </div>

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearSelection}
            actions={[
              {
                label: t('common.delete'),
                icon: Trash2,
                onClick: () => setShowBulkDeleteModal(true),
                variant: 'destructive',
              },
            ]}
          />
        )}

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="mail"
          isLoading={deleting}
        />

        <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950">
          <div className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3">
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('mail.searchPlaceholder', {
                  defaultValue: 'Search by recipient or subject...',
                })}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
          </div>
          {loading && mailHistory.length === 0 ? (
            <Card className="shadow-none">
              <div className="p-6 text-center text-sm text-muted-foreground">
                {t('common.loading')}
              </div>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="shadow-none">
              <div className="p-6 text-center text-sm text-muted-foreground">
                {t('mail.emptyHistory', { defaultValue: 'No sent emails yet.' })}
              </div>
            </Card>
          ) : (
            <Card className="shadow-none">
              <Table rowBorders={false}>
                <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-12 text-xs">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer"
                        aria-label={allVisibleSelected ? 'Unselect all' : 'Select all'}
                        checked={allVisibleSelected}
                        onChange={onToggleAllVisible}
                      />
                    </TableHead>
                    <TableHead className="text-xs">
                      {t('mail.date', { defaultValue: 'Date' })}
                    </TableHead>
                    <TableHead className="text-xs">
                      {t('mail.to', { defaultValue: 'To' })}
                    </TableHead>
                    <TableHead className="text-xs">
                      {t('mail.subject', { defaultValue: 'Subject' })}
                    </TableHead>
                    <TableHead className="text-xs">
                      {t('mail.source', { defaultValue: 'Source' })}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry, index) => (
                    <TableRow
                      key={entry.id}
                      className={cn(
                        'bg-white transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80',
                        isSelected(entry.id) && 'bg-plugin-subtle',
                      )}
                    >
                      <TableCell className="w-12 text-xs" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer"
                          checked={isSelected(entry.id)}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(entry.id)}
                          aria-label={isSelected(entry.id) ? 'Deselect row' : 'Select row'}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.sentAt ? formatDateTimeShort(entry.sentAt) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs" title={entry.to}>
                        {entry.to}
                      </TableCell>
                      <TableCell
                        className="max-w-[280px] truncate text-xs"
                        title={entry.subject || ''}
                      >
                        {entry.subject || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.pluginSource ? (
                          <Badge
                            className={cn(
                              'border-0 rounded-md px-2 py-0.5 text-xs font-semibold capitalize',
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
            </Card>
          )}
          <div className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
            {t('mail.showingHistoryCount', {
              defaultValue: 'Showing {{visible}} of {{total}} emails',
              visible: filtered.length,
              total: mailHistory.length,
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};
