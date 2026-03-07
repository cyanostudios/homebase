import { format } from 'date-fns';
import { Mail, Settings, RefreshCw } from 'lucide-react';
import React, { useState } from 'react';

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

export const MailList: React.FC = () => {
  const { mailHistory, totalCount, settings, loading, loadHistory, openMailPanel } = useMail();
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

  const pluginSources = Array.from(
    new Set(mailHistory.map((e) => e.pluginSource).filter((s): s is string => Boolean(s))),
  );

  return (
    <div className="flex flex-col gap-4 p-4">
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
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">All plugins</option>
                {pluginSources.map((ps) => (
                  <option key={ps} value={ps}>
                    {ps}
                  </option>
                ))}
              </select>
            )}
            <Button variant="outline" size="sm" onClick={() => loadHistory()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Uppdatera
            </Button>
          </div>
        }
      />

      {/* Settings card */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">SMTP-inställningar</span>
          </div>
          <div className="flex items-center gap-2">
            {settings?.configured?.smtp || settings?.configured?.resend ? (
              <Badge variant="outline">Konfigurerad</Badge>
            ) : (
              <Badge variant="secondary">Ej konfigurerad</Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => openMailPanel()}>
              Konfigurera SMTP
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Ställ in SMTP för att skicka e-post från pluginet (t.ex. Besiktningar).
        </p>
      </Card>

      {/* History table */}
      <Card className="shadow-none">
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
                <TableRow key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
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
