import React from 'react';
import { useChannels } from '../hooks/useChannels';
import { Card } from '@/core/ui/Card';
import { Heading, Text } from '@/core/ui/Typography';
import { useWooCommerce } from '@/plugins/woocommerce-products/context/WooCommerceContext';

export const ChannelsList: React.FC = () => {
  const { channels } = useChannels();
  const { openWooSettingsPanel, settings } = useWooCommerce();

  const onRowClick = (item: any) => {
    if (item.channel === 'woocommerce') {
      openWooSettingsPanel(settings || null);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8">
        <Heading level={1}>Channels</Heading>
        <Text variant="caption">Overview of connected marketplaces</Text>
      </div>

      <Card>
        {channels.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No channels yet.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {channels.map((item: any) => {
              const updated = item.lastSyncedAt ? new Date(item.lastSyncedAt) : null;
              return (
                <button
                  key={item.id}
                  onClick={() => onRowClick(item)}
                  className="w-full text-left p-4 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{item.channel}</span>
                      {!item.configured && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                          Not configured
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="mr-3">
                        Enabled {item.enabledCount}/{item.mappedCount}
                      </span>
                      <span className="mr-3">✓ {item.status?.success ?? 0}</span>
                      <span className="mr-3">⚠︎ {item.status?.error ?? 0}</span>
                      <span className="mr-3">⏳ {item.status?.queued ?? 0}</span>
                      <span>Last sync: {updated ? updated.toLocaleString() : '—'}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
