import { ShoppingCart } from 'lucide-react';
import React, { useMemo } from 'react';

import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { Heading, Text } from '@/core/ui/Typography';

import { useProducts } from '../../products/hooks/useProducts';
import { useWooCommerce } from '../context/WooCommerceContext';

export const WooExportPanel: React.FC = () => {
  const {
    settings,
    openWooSettingsPanel,
    openWooSettingsForEdit,
    exportProducts,
    exporting,
    lastExportResult,
  } = useWooCommerce();

  const { products, selectedProductIds, clearProductSelection } = useProducts();

  // Configured only if all three are present
  const isConfigured = useMemo(() => {
    const s = settings;
    return !!(s?.storeUrl && s?.consumerKey && s?.consumerSecret);
  }, [settings]);

  // Selected products (from Products plugin)
  const selectedProducts = useMemo(
    () => products.filter((p) => selectedProductIds.includes(String(p.id))),
    [products, selectedProductIds],
  );

  // Minimal MVP payload mapping
  const mvpPayload = useMemo(
    () =>
      selectedProducts.map((p) => ({
        id: p.id,
        productNumber: p.productNumber,
        sku: p.sku,
        title: p.title,
        status: p.status,
        quantity: p.quantity,
        priceAmount: p.priceAmount,
        currency: p.currency,
        vatRate: p.vatRate,
        description: p.description,
        mainImage: p.mainImage,
        images: p.images,
        categories: p.categories,
        brand: p.brand,
        gtin: p.gtin,
        createdAt: p.createdAt as any,
        updatedAt: p.updatedAt as any,
      })),
    [selectedProducts],
  );

  const skuWarnings = useMemo(
    () => selectedProducts.filter((p) => !p.sku || !String(p.sku).trim()),
    [selectedProducts],
  );

  const handleExport = async () => {
    if (!mvpPayload.length || !isConfigured) {
      return;
    }
    await exportProducts(mvpPayload as any);
  };

  // Summaries (safe fallbacks)
  const totalSelected = selectedProducts.length;
  const createdCount = Number(lastExportResult?.result?.create?.length ?? 0);
  const updatedCount = Number(lastExportResult?.result?.update?.length ?? 0);
  const deletedCount = Number(lastExportResult?.result?.delete?.length ?? 0);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Heading level={1}>WooCommerce</Heading>
        {isConfigured && (
          <Button
            variant="secondary"
            onClick={() => {
              if (settings) {
                openWooSettingsForEdit(settings);
              }
            }}
          >
            Settings
          </Button>
        )}
      </div>

      {/* Empty-state / connect — ONLY when NOT configured */}
      {!isConfigured && (
        <Card padding="lg" className="border-dashed">
          <div className="flex items-start gap-4">
            <div className="mt-1">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <Heading level={3} className="mb-1">
                Connect your WooCommerce store
              </Heading>
              <Text variant="body" className="text-gray-600">
                Add your store URL and API keys to enable product export and syncing.
              </Text>
              <div className="mt-4">
                <Button
                  variant="primary"
                  onClick={() => openWooSettingsPanel(null)} // create mode
                >
                  Connect Store
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* When configured, show a tight summary */}
      {isConfigured && (
        <Card padding="sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm text-gray-500">Connected Store</div>
              <div className="text-sm font-medium text-gray-900 truncate">{settings?.storeUrl}</div>
            </div>
            <div className="text-xs text-gray-500">Credentials saved in account settings.</div>
          </div>
        </Card>
      )}

      {/* Export area */}
      {isConfigured && (
        <Card padding="lg">
          <div className="flex flex-col gap-3">
            <Heading level={3} className="mb-1">
              Export selected products
            </Heading>
            <Text variant="body" className="text-gray-600">
              Select products in the <strong>Products</strong> list (checkboxes) and export them to
              WooCommerce. Mapping (MVP):{' '}
              <code>
                sku, title, status, regular_price, manage_stock=true, stock_quantity, description,
                images, attributes(brand)
              </code>
              .
            </Text>

            {/* Selection summary */}
            <div className="mt-1 text-sm">
              {totalSelected > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {totalSelected} selected
                  </span>
                  {skuWarnings.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                      {skuWarnings.length} without SKU (updates require SKU)
                    </span>
                  )}
                  <button
                    className="underline text-blue-700"
                    onClick={() => clearProductSelection()}
                  >
                    Clear selection
                  </button>
                </div>
              ) : (
                <div className="text-gray-500">No products selected.</div>
              )}
            </div>

            {/* Single primary export button */}
            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="primary"
                disabled={exporting || totalSelected === 0}
                onClick={handleExport}
                aria-label="Export selected products to WooCommerce"
              >
                {exporting
                  ? 'Exporting…'
                  : `Export ${totalSelected || ''} ${totalSelected === 1 ? 'product' : 'products'}`}
              </Button>
              <Text variant="caption" className="text-gray-500">
                You can keep working while export runs.
              </Text>
            </div>

            {/* Export result */}
            {lastExportResult && (
              <div className="mt-3 rounded-xl border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div
                    className={`font-medium ${lastExportResult.ok ? 'text-green-700' : 'text-red-700'}`}
                  >
                    {lastExportResult.ok ? 'Export completed' : 'Export failed'}
                  </div>
                  <div className="text-gray-600 break-all">
                    Endpoint: {lastExportResult.endpoint}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-2 text-center">
                    <div className="text-xs text-gray-500">Created</div>
                    <div className="text-lg font-semibold tabular-nums">{createdCount}</div>
                  </div>
                  <div className="rounded-lg border p-2 text-center">
                    <div className="text-xs text-gray-500">Updated</div>
                    <div className="text-lg font-semibold tabular-nums">{updatedCount}</div>
                  </div>
                  <div className="rounded-lg border p-2 text-center">
                    <div className="text-xs text-gray-500">Deleted</div>
                    <div className="text-lg font-semibold tabular-nums">{deletedCount}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
