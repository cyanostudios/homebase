import { format } from 'date-fns';
import { Smartphone, Settings, RefreshCw, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { cn } from '@/lib/utils';

import { usePulses } from '../hooks/usePulses';

export const PulseList: React.FC = () => {
  const { t } = useTranslation();
  const {
    pulseHistory,
    totalCount,
    settings,
    loading,
    loadHistory,
    openPulsePanel,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelected,
    clearSelection,
    deleteHistory,
  } = usePulses();
  const { setHeaderTrailing } = useContentLayout();
  const [searchTerm, setSearchTerm] = useState('');
  const [pluginFilter, setPluginFilter] = useState<string>('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = pulseHistory.filter((entry) => {
    const matchSearch =
      !searchTerm ||
      entry.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.body || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchPlugin = !pluginFilter || entry.pluginSource === pluginFilter;
    return matchSearch && matchPlugin;
  });

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
    if (provider === 'twilio' && settings.configured?.twilio) {
      return { label: 'Twilio', isOk: true };
    }
    return { label: 'Twilio', isOk: false };
  }, [settings, t]);

  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('pulses.searchPlaceholder')}
        rightActions={
          <div className="flex items-center gap-2">
            {pluginSources.length > 0 && (
              <select
                value={pluginFilter}
                onChange={(e) => setPluginFilter(e.target.value)}
                className="h-7 rounded-md border border-input bg-background px-2 py-1 text-[10px]"
              >
                <option value="">{t('pulses.allPlugins')}</option>
                {pluginSources.map((ps: string) => (
                  <option key={ps} value={ps}>
                    {ps}
                  </option>
                ))}
              </select>
            )}
            <Badge
              variant="outline"
              className={cn(
                'font-medium text-[10px]',
                statusBadge.isOk
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
              )}
            >
              {statusBadge.label}
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              icon={Settings}
              onClick={() => openPulsePanel()}
              title={t('pulses.settingsButton')}
              className="h-7 text-[10px] px-2"
            >
              {t('pulses.settingsButton')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadHistory()}
              disabled={loading}
              className="h-7 text-[10px] px-2"
            >
              <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
              {t('pulses.refresh')}
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [
    searchTerm,
    pluginFilter,
    pluginSources,
    statusBadge,
    loading,
    setHeaderTrailing,
    loadHistory,
    openPulsePanel,
    t,
  ]);

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

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((e) => selectedIds.includes(e.id));

  const handleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      clearSelection();
    } else {
      filtered.forEach((e) => {
        if (!selectedIds.includes(e.id)) {
          toggleSelected(e.id);
        }
      });
    }
  };

  return (
    <div className="space-y-4">
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
      <Card className="shadow-none plugin-pulses">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-plugin" />
          <span className="font-medium text-sm">{t('pulses.historyTitle')}</span>
          <Badge
            variant="secondary"
            className="bg-secondary/50 text-secondary-foreground border-transparent font-medium text-[10px]"
          >
            {totalCount} {t('pulses.total')}
          </Badge>
        </div>
        {loading && pulseHistory.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {t('pulses.emptyHistory')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    checked={allFilteredSelected}
                    onChange={handleSelectAllFiltered}
                  />
                </TableHead>
                <TableHead>{t('pulses.date')}</TableHead>
                <TableHead>{t('pulses.recipient')}</TableHead>
                <TableHead>{t('pulses.body')}</TableHead>
                <TableHead>{t('pulses.status')}</TableHead>
                <TableHead>{t('pulses.source')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow
                  key={entry.id}
                  className={cn(
                    'hover:bg-muted/50 plugin-pulses hover:bg-plugin-subtle/50 transition-colors',
                    isSelected(entry.id) && 'bg-blue-50 dark:bg-blue-950/30',
                  )}
                >
                  <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer"
                      checked={isSelected(entry.id)}
                      onChange={() => toggleSelected(entry.id)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {entry.sentAt ? format(new Date(entry.sentAt), 'yyyy-MM-dd HH:mm') : '—'}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate font-medium" title={entry.recipient}>
                    {entry.recipient}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-sm" title={entry.body || ''}>
                    {entry.body || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {entry.status || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.pluginSource ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          'capitalize font-medium text-[10px]',
                          entry.pluginSource === 'notes' &&
                            'plugin-notes bg-plugin-subtle text-plugin border-plugin-subtle',
                          entry.pluginSource === 'contacts' &&
                            'plugin-contacts bg-plugin-subtle text-plugin border-plugin-subtle',
                          entry.pluginSource === 'tasks' &&
                            'plugin-tasks bg-plugin-subtle text-plugin border-plugin-subtle',
                          entry.pluginSource === 'estimates' &&
                            'plugin-estimates bg-plugin-subtle text-plugin border-plugin-subtle',
                          entry.pluginSource === 'invoices' &&
                            'plugin-invoices bg-plugin-subtle text-plugin border-plugin-subtle',
                          entry.pluginSource === 'files' &&
                            'plugin-files bg-plugin-subtle text-plugin border-plugin-subtle',
                        )}
                      >
                        {entry.pluginSource}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        selectedCount={selectedCount}
        itemLabel={t('pulses.historyTitle')}
        isDeleting={deleting}
      />
    </div>
  );
};
