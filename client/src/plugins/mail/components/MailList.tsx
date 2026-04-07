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

import { useMail } from '../hooks/useMail';

import { MailSettingsView } from './MailSettingsView';

export const MailList: React.FC = () => {
  const { t } = useTranslation();
  const {
    mailHistory,
    totalCount,
    settings,
    loading,
    loadHistory,
    openMailsSettings,
    closeMailSettingsView,
    mailContentView,
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
  const [pluginFilter, setPluginFilter] = useState<string>('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return mailHistory.filter((entry) => {
      const matchSearch =
        !q || entry.to.toLowerCase().includes(q) || entry.subject.toLowerCase().includes(q);
      const matchPlugin = !pluginFilter || entry.pluginSource === pluginFilter;
      return matchSearch && matchPlugin;
    });
  }, [mailHistory, searchTerm, pluginFilter]);

  const pluginSources = useMemo(
    () =>
      Array.from(
        new Set(mailHistory.map((e) => e.pluginSource).filter((ps): ps is string => !!ps)),
      ),
    [mailHistory],
  );

  const statusBadge = useMemo(() => {
    if (!settings) {
      return { label: t('mail.notConfigured'), isOk: false };
    }
    const provider = settings.provider;
    if (provider === 'resend' && settings.configured?.resend) {
      return { label: 'Resend', isOk: true };
    }
    if (provider === 'smtp' && settings.configured?.smtp) {
      return { label: 'SMTP', isOk: true };
    }
    return { label: provider === 'resend' ? 'Resend' : 'SMTP', isOk: false };
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
      console.error('Failed to delete mail history:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (mailContentView === 'settings') {
    return (
      <div className="plugin-mail min-h-full bg-background">
        <div className="px-6 py-4">
          <div className="space-y-4">
            <div className="flex flex-shrink-0 items-center justify-between">
              <h2 className="truncate shrink-0 text-lg font-semibold tracking-tight">
                {t('mail.settingsTitle')}
              </h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeMailSettingsView}
              >
                {t('common.close')}
              </Button>
            </div>
            <MailSettingsView />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-mail min-h-full bg-background">
      <div className="flex flex-shrink-0 flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="mr-0 flex min-w-0 flex-1 flex-col gap-3 sm:mr-4 sm:flex-row sm:items-center">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('nav.mail')}
          </h2>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('mail.searchPlaceholder')}
              className="h-9 bg-background pl-9 text-xs"
            />
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          <Badge
            variant="secondary"
            className="border-transparent bg-secondary/50 font-medium text-[10px] text-secondary-foreground"
          >
            {totalCount} {t('mail.total')}
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
              <option value="">{t('mail.allPlugins')}</option>
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
            onClick={() => openMailsSettings()}
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
            {t('mail.refresh')}
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
          itemLabel="mail"
          isLoading={deleting}
        />

        <Card className="shadow-none plugin-mail">
          {loading && mailHistory.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t('mail.emptyHistory')}
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
                  <TableHead className="text-xs">{t('mail.date')}</TableHead>
                  <TableHead className="text-xs">{t('mail.to')}</TableHead>
                  <TableHead className="text-xs">{t('mail.subject')}</TableHead>
                  <TableHead className="text-xs">{t('mail.source')}</TableHead>
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
                    <TableCell className="max-w-[200px] truncate text-xs" title={entry.to}>
                      {entry.to}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs" title={entry.subject}>
                      {entry.subject || '—'}
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
