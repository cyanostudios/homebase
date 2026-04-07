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
    <div className="plugin-pulses min-h-full bg-background">
      <div className="flex flex-shrink-0 flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="mr-0 flex min-w-0 flex-1 flex-col gap-3 sm:mr-4 sm:flex-row sm:items-center">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('nav.pulses')}
          </h2>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('pulses.searchPlaceholder')}
              className="h-9 bg-background pl-9 text-xs"
            />
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          <Badge
            variant="secondary"
            className="border-transparent bg-secondary/50 font-medium text-[10px] text-secondary-foreground"
          >
            {totalCount} {t('pulses.total')}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              'font-medium text-[10px]',
              statusBadge.isOk
                ? 'border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300',
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

      <div className="space-y-4 px-6 pb-6">
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

        <Card className="shadow-none plugin-pulses">
          {loading && pulseHistory.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t('pulses.emptyHistory')}
            </div>
          ) : (
            <Table>
              <TableHeader>
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
                      'transition-colors hover:bg-muted/50',
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
                    <TableCell className="max-w-[240px] truncate text-xs" title={entry.body || ''}>
                      {entry.body || '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {entry.status || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {entry.pluginSource ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-medium capitalize',
                            entry.pluginSource === 'notes' &&
                              'plugin-notes border-plugin-subtle bg-plugin-subtle text-plugin',
                            entry.pluginSource === 'contacts' &&
                              'plugin-contacts border-plugin-subtle bg-plugin-subtle text-plugin',
                            entry.pluginSource === 'tasks' &&
                              'plugin-tasks border-plugin-subtle bg-plugin-subtle text-plugin',
                            entry.pluginSource === 'estimates' &&
                              'plugin-estimates border-plugin-subtle bg-plugin-subtle text-plugin',
                            entry.pluginSource === 'invoices' &&
                              'plugin-invoices border-plugin-subtle bg-plugin-subtle text-plugin',
                            entry.pluginSource === 'files' &&
                              'plugin-files border-plugin-subtle bg-plugin-subtle text-plugin',
                            entry.pluginSource === 'ingest' &&
                              'plugin-ingest border-plugin-subtle bg-plugin-subtle text-plugin',
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
        </Card>
      </div>
    </div>
  );
};
