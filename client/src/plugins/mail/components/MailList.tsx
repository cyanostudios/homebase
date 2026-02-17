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
                className="h-7 rounded-md border border-input bg-background px-2 py-1 text-[10px]"
              >
                <option value="">All plugins</option>
                {pluginSources.map((ps: string) => (
                  <option key={ps} value={ps}>
                    {ps}
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2">
              {settings?.configured?.smtp || settings?.configured?.resend ? (
                <Badge
                  variant="outline"
                  className="plugin-mail bg-plugin-subtle text-plugin border-plugin-subtle font-medium text-[10px]"
                >
                  Konfigurerad
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="bg-secondary/50 text-secondary-foreground border-transparent font-medium text-[10px]"
                >
                  Ej konfigurerad
                </Badge>
              )}
              <Button
                variant="secondary"
                size="sm"
                icon={Settings}
                onClick={() => openMailPanel()}
                title="Inställningar"
                className="h-7 text-[10px] px-2"
              >
                Settings
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadHistory()}
              disabled={loading}
              className="h-7 text-[10px] px-2"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
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
    <div className="space-y-4">
      <Card className="shadow-none plugin-mail">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Mail className="h-5 w-5 text-plugin" />
          <span className="font-medium text-sm">Sent mail history</span>
          <Badge
            variant="secondary"
            className="bg-secondary/50 text-secondary-foreground border-transparent font-medium text-[10px]"
          >
            {totalCount} Total
          </Badge>
        </div>
        {loading && mailHistory.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
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
                <TableRow
                  key={entry.id}
                  className="hover:bg-muted/50 plugin-mail hover:bg-plugin-subtle/50 transition-colors"
                >
                  <TableCell className="text-muted-foreground text-sm">
                    {entry.sentAt ? format(new Date(entry.sentAt), 'yyyy-MM-dd HH:mm') : '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium" title={entry.to}>
                    {entry.to}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm" title={entry.subject}>
                    {entry.subject || '—'}
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
    </div>
  );
};
