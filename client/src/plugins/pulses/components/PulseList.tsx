import { format } from 'date-fns';
import { RefreshCw, Search, Settings, Trash2, X } from 'lucide-react';
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
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { cn } from '@/lib/utils';

import { usePulses } from '../hooks/usePulses';

import { PulseSettingsView } from './PulseSettingsView';

function StatCard({
  label,
  value,
  dotClassName,
}: {
  label: string;
  value: number;
  dotClassName: string;
}) {
  return (
    <Card className="rounded-xl border-0 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} aria-hidden />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
    </Card>
  );
}

export const PulseList: React.FC = () => {
  const { t } = useTranslation();
  const {
    pulseHistory,
    totalCount,
    settings,
    loading,
    loadHistory,
    openPulsesSettings,
    closePulseSettingsView,
    pulsesContentView,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelected,
    clearSelection,
    replaceSelectedIds,
    mergeIntoSelection,
    deleteHistory,
  } = usePulses();
  const [searchTerm, setSearchTerm] = useState('');
  const [pluginFilter, setPluginFilter] = useState<string>('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return pulseHistory.filter((entry) => {
      const matchSearch =
        !needle ||
        entry.recipient.toLowerCase().includes(needle) ||
        (entry.body || '').toLowerCase().includes(needle);
      const matchPlugin = !pluginFilter || entry.pluginSource === pluginFilter;
      return matchSearch && matchPlugin;
    });
  }, [pulseHistory, searchTerm, pluginFilter]);

  const pluginSources = useMemo(
    () =>
      Array.from(
        new Set(pulseHistory.map((e) => e.pluginSource).filter((ps): ps is string => !!ps)),
      ),
    [pulseHistory],
  );
  const stats = useMemo(
    () => ({
      total: pulseHistory.length,
      filtered: filtered.length,
      failed: pulseHistory.filter((p) => String(p.status || '').toLowerCase() === 'failed').length,
      today: pulseHistory.filter((p) => {
        if (!p.sentAt) {
          return false;
        }
        return new Date(p.sentAt).toDateString() === new Date().toDateString();
      }).length,
    }),
    [pulseHistory, filtered.length],
  );

  const statusBadge = useMemo(() => {
    if (!settings) {
      return { label: t('pulses.notConfigured'), isOk: false };
    }
    const provider = settings.activeProvider;
    if (provider === 'mock') {
      return { label: 'Mock', isOk: true };
    }
    if (provider === 'apple-messages' && settings.configured?.appleMessages) {
      return { label: t('pulses.appleMessages'), isOk: true };
    }
    if (provider === 'apple-messages') {
      return { label: t('pulses.appleMessages'), isOk: false };
    }
    if (provider === 'twilio' && settings.configured?.twilio) {
      return { label: 'Twilio', isOk: true };
    }
    return { label: 'Twilio', isOk: false };
  }, [settings, t]);

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

  if (pulsesContentView === 'settings') {
    return (
      <div className="plugin-pulses min-h-full bg-background">
        <div className="px-6 py-4">
          <div className="space-y-4">
            <div className="flex flex-shrink-0 items-center justify-between">
              <h2 className="truncate shrink-0 text-lg font-semibold tracking-tight">
                {t('pulses.settingsTitle')}
              </h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closePulseSettingsView}
              >
                {t('common.close')}
              </Button>
            </div>
            <PulseSettingsView />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-pulses min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.pulses')}</h2>
            <p className="text-sm text-muted-foreground">{t('pulses.listDescription')}</p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
            <Badge
              variant="secondary"
              className="border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-secondary/50 text-secondary-foreground"
            >
              {totalCount} {t('pulses.total')}
            </Badge>
            <Badge
              className={cn(
                'border-0 rounded-md px-2 py-0.5 text-xs font-semibold',
                statusBadge.isOk
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
              )}
            >
              {statusBadge.label}
            </Badge>
            {pluginSources.length > 0 && (
              <select
                value={pluginFilter}
                onChange={(e) => setPluginFilter(e.target.value)}
                className="h-9 min-w-[120px] rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">{t('pulses.allPlugins')}</option>
                {pluginSources.map((ps: string) => (
                  <option key={ps} value={ps}>
                    {ps}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              onClick={() => openPulsesSettings()}
              title={t('common.settings')}
              className="h-9 px-3 text-xs"
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              onClick={() => loadHistory()}
              disabled={loading}
              className={cn('h-9 px-3 text-xs', loading && '[&>svg]:animate-spin')}
            >
              {t('pulses.refresh')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total" value={stats.total} dotClassName="bg-blue-500" />
          <StatCard label="Filtered" value={stats.filtered} dotClassName="bg-emerald-500" />
          <StatCard label="Failed" value={stats.failed} dotClassName="bg-rose-500" />
          <StatCard label="Sent Today" value={stats.today} dotClassName="bg-violet-500" />
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
          itemLabel="pulses"
          isLoading={deleting}
        />

        <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950">
          <div className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3">
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('pulses.searchPlaceholder')}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
          </div>
          {loading && pulseHistory.length === 0 ? (
            <Card className="shadow-none">
              <div className="p-6 text-center text-sm text-muted-foreground">
                {t('common.loading')}
              </div>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="shadow-none">
              <div className="p-6 text-center text-sm text-muted-foreground">
                {t('pulses.emptyHistory')}
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
                        {entry.sentAt ? format(new Date(entry.sentAt), 'yyyy-MM-dd HH:mm') : '—'}
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
                        <Badge className="border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {entry.status || '—'}
                        </Badge>
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
        </Card>
      </div>
    </div>
  );
};
