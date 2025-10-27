import React from 'react';

import { Card } from '@/core/ui/Card';
import { Heading, Text } from '@/core/ui/Typography';

interface ChannelsViewProps {
  item: any; // ChannelSummary
}

export const ChannelsView: React.FC<ChannelsViewProps> = ({ item }) => {
  if (!item) {
    return null;
  }

  const updated = item.lastSyncedAt ? new Date(item.lastSyncedAt) : null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-2">
          Summary
        </Heading>
        <div className="text-sm text-gray-900 capitalize">{item.channel}</div>
        <Text variant="caption" className="text-gray-600">
          {item.configured ? 'Configured' : 'Not configured'}
        </Text>
      </Card>

      {/* Metrics */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Metrics
        </Heading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500">Mapped</div>
            <div className="text-sm font-medium">{item.mappedCount ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Enabled</div>
            <div className="text-sm font-medium">{item.enabledCount ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Synced</div>
            <div className="text-sm">{updated ? updated.toLocaleString() : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Configured</div>
            <div className="text-sm">{item.configured ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </Card>

      {/* Sync status breakdown */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Last Sync Status
        </Heading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatusTile label="Success" value={item.status?.success} />
          <StatusTile label="Queued" value={item.status?.queued} />
          <StatusTile label="Errors" value={item.status?.error} />
          <StatusTile label="No Change" value={item.status?.idle} />
        </div>
      </Card>
    </div>
  );
};

function StatusTile({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium">{typeof value === 'number' ? value : 0}</div>
    </div>
  );
}
