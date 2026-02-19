import React from 'react';
import { Download } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { channelsApi } from '../api/channelsApi';
import { useChannels } from '../hooks/useChannels';

export const ChannelsList: React.FC = () => {
  const { channels, openChannelForView } = useChannels();

  const onRowClick = (item: any) => {
    openChannelForView(item);
  };

  const downloadTemplate = async () => {
    try {
      const csv = await channelsApi.downloadImportTemplate();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'homebase-import-template.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download template:', err);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Klicka på en rad (t.ex. CDON eller Fyndiq) för att öppna panelen och hantera instanser samt aktivera/avaktivera marknader (SE, DK, FI, NO).
      </p>
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" icon={Download} onClick={downloadTemplate}>
          Download import template
        </Button>
      </div>

      <Card className="shadow-none">
        {channels.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">No channels yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enabled/Mapped</TableHead>
                <TableHead>Sync Status</TableHead>
                <TableHead>Last Sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((item: any) => {
                const updated = item.lastSyncedAt ? new Date(item.lastSyncedAt) : null;
                return (
                  <TableRow
                    key={item.id}
                    onClick={() => onRowClick(item)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{item.channel}</span>
                        {!item.configured && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                            Not configured
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.configured ? (
                        <span className="text-sm text-muted-foreground">Configured</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not configured</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {item.enabledCount}/{item.mappedCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>✓ {item.status?.success ?? 0}</span>
                        <span>⚠︎ {item.status?.error ?? 0}</span>
                        <span>⏳ {item.status?.queued ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {updated ? updated.toLocaleString() : '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};
