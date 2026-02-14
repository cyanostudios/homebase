import { format } from 'date-fns';
import { Mail, Settings, RefreshCw } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';

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
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { cn } from '@/lib/utils';

import { useMail } from '../hooks/useMail';

export const MailList: React.FC = () => {
  const { mailHistory, totalCount, settings, loading, loadHistory, openMailPanel } = useMail();
  const { setHeaderTrailing } = useContentLayout();
  const [searchTerm, setSearchTerm] = useState('');
  const [pluginFilter, setPluginFilter] = useState<string>('');

  const filtered = mailHistory.filter((entry) => {
    const matchSearch =
      !searchTerm ||
      entry.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPlugin = !pluginFilter || entry.pluginSource === pluginFilter;
    return matchSearch && matchPlugin;
  });

  const pluginSources = useMemo(
    () =>
      Array.from(
        new Set(mailHistory.map((e) => e.pluginSource).filter((ps): ps is string => !!ps)),
      ),
    [mailHistory],
  );

  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by recipient or subject..."
        rightActions={
          <div className="flex items-center gap-2">
            {pluginSources.length > 0 && (
              <select
                value={pluginFilter}
                onChange={(e) => setPluginFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm mr-2"
              >
                <option value="">All plugins</option>
                {pluginSources.map((ps: string) => (
                  <option key={ps} value={ps}>
                    {ps}
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-1 mr-2 px-2 border-r pr-4">
              {settings?.configured?.smtp || settings?.configured?.resend ? (
                <Badge
                  variant="outline"
                  className="plugin-invoices bg-plugin-subtle text-plugin border-plugin-subtle font-medium"
                >
                  Konfigurerad
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="bg-secondary/50 text-secondary-foreground border-transparent font-medium"
                >
                  Ej konfigurerad
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openMailPanel()}
                title="Inställningar"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadHistory()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Uppdatera
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
    loading,
    setHeaderTrailing,
    loadHistory,
    settings,
    openMailPanel,
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* History table */}
      <Card className="plugin-mail">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Mail className="h-5 w-5 text-plugin" />
          <span className="font-medium text-sm">Sent mail history</span>
          <Badge
            variant="secondary"
            className="bg-secondary/50 text-secondary-foreground border-transparent font-medium"
          >
            {totalCount} Total
          </Badge>
        </div>
        {loading && mailHistory.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No sent emails yet. Mail is sent from other plugins (e.g. Besiktningar).
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {entry.sentAt ? format(new Date(entry.sentAt), 'yyyy-MM-dd HH:mm') : '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={entry.to}>
                    {entry.to}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate" title={entry.subject}>
                    {entry.subject || '—'}
                  </TableCell>
                  <TableCell>
                    {entry.pluginSource ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          'capitalize font-medium',
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
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};
