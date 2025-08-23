import React, { useMemo } from 'react';
import { useWooCommerce } from '../context/WooCommerceContext';
import { Card } from '@/core/ui/Card';
import { Heading, Text } from '@/core/ui/Typography';
import { Button } from '@/core/ui/Button';
import { ShoppingCart } from 'lucide-react';

export const WooExportPanel: React.FC = () => {
  const {
    settings,
    openWooSettingsPanel,
    openWooSettingsForEdit,
  } = useWooCommerce();

  // Considered "configured" only if all three are present
  const isConfigured = useMemo(() => {
    const s = settings;
    return !!(s?.storeUrl && s?.consumerKey && s?.consumerSecret);
  }, [settings]);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Heading level={1}>WooCommerce</Heading>
        {isConfigured && (
          <Button
            variant="secondary"
            onClick={() => {
              if (settings) openWooSettingsForEdit(settings);
              else openWooSettingsPanel(null);
            }}
          >
            Edit Settings
          </Button>
        )}
      </div>

      {/* Empty-state / connect box — ONLY when NOT configured */}
      {!isConfigured && (
        <Card padding="lg" className="border-dashed">
          <div className="flex items-start gap-4">
            <div className="mt-1">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <Heading level={3} className="mb-1">Connect your WooCommerce store</Heading>
              <Text variant="body" className="text-gray-600">
                Add your store URL and API keys to enable product export and syncing.
              </Text>
              <div className="mt-4">
                <Button
                  variant="primary"
                  onClick={() => openWooSettingsPanel(null)} // opens in create mode
                >
                  Connect Store
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* When configured, you can show a lightweight summary (optional, non-blocking) */}
      {isConfigured && (
        <Card padding="sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm text-gray-500">Connected Store</div>
              <div className="text-sm font-medium text-gray-900 truncate">
                {settings?.storeUrl}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => openWooSettingsForEdit(settings!)}
              >
                Edit Settings
              </Button>
              {/* Placeholder for future actions like “Export selected products” */}
              {/* <Button variant="primary">Export to WooCommerce</Button> */}
            </div>
          </div>
        </Card>
      )}

      {/* Additional content (product selection, results, etc.) can live below */}
    </div>
  );
};
