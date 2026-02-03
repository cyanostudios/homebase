import { Mail, Settings, RefreshCw } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';

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
import { ContentToolbar } from '@/core/ui/ContentToolbar';

import { useMail } from '../hooks/useMail';
import { format } from 'date-fns';

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
    () => Array.from(new Set(mailHistory.map((e) => e.pluginSource).filter((ps): ps is string => !!ps))),
    [mailHistory]
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
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Konfigurerad
                </Badge>
              ) : (
                <Badge variant="secondary">Ej konfigurerad</Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => openMailPanel()} title="Inställningar">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadHistory()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Uppdatera
            </Button>
          </div>
        }
      />
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
      <Card>

        <div className="p-4 border-b border-border flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Sent mail history</span>
          <Badge variant="secondary">{totalCount} total</Badge>
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
                      <Badge variant="outline">{entry.pluginSource}</Badge>
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
