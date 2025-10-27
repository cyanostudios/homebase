import React, { useMemo, useState } from 'react';

import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { Heading, Text } from '@/core/ui/Typography';
import { useChannels } from '@/plugins/channels/hooks/useChannels';

interface ProductViewProps {
  item?: any;   // preferred prop from panel renderer
  contact?: any; // legacy fallback (kept for compatibility)
}

export const ProductView: React.FC<ProductViewProps> = ({ item, contact }) => {
  // Viktigt: anropa alla hooks först (ingen early return före hooks).
  const { channels, setProductEnabled } = useChannels();

  // Källobjekt (kan vara undefined om varken item eller contact finns)
  const src = item ?? contact;

  // Normalisera produkt – om src saknas levererar vi en tom "placeholder"-produkt
  const product = useMemo(
    () => ({
      id: src?.id ?? '',
      productNumber: src?.productNumber ?? src?.contactNumber ?? '',
      title: src?.title ?? src?.companyName ?? '',
      status: src?.status ?? 'for sale',
      quantity: Number.isFinite(src?.quantity) ? Number(src?.quantity) : 0,
      priceAmount: Number.isFinite(src?.priceAmount) ? Number(src?.priceAmount) : 0,
      currency: src?.currency ?? 'SEK',
      vatRate: Number.isFinite(src?.vatRate) ? Number(src?.vatRate) : 25,
      sku: src?.sku ?? '',
      description: src?.description ?? '',
      mainImage: src?.mainImage ?? '',
      images: Array.isArray(src?.images) ? src!.images : [],
      categories: Array.isArray(src?.categories) ? src!.categories : [],
      brand: src?.brand ?? '',
      gtin: src?.gtin ?? '',
      createdAt: src?.createdAt,
      updatedAt: src?.updatedAt,
    }),
    [src],
  );

  // Woo sammanfattning
  const wooSummary = (channels || []).find(
    (c) => String(c.channel).toLowerCase() === 'woocommerce',
  );
  const wooConfigured = !!wooSummary?.configured;

  // Lokal UI-state för Woo-toggle
  const [wooEnabled, setWooEnabled] = useState<boolean | null>(null);
  const [wooPending, setWooPending] = useState(false);
  const canToggleWoo = wooConfigured && !!product.id;

  const handleWooToggle = async (next: boolean) => {
    if (!canToggleWoo || !product.id) return;
    setWooPending(true);
    try {
      await setProductEnabled({
        productId: String(product.id),
        channel: 'woocommerce',
        enabled: next,
      });
      setWooEnabled(next);
    } catch (e) {
      console.error('Failed to toggle Woo mapping', e);
    } finally {
      setWooPending(false);
    }
  };

  // Nu kan vi returnera "early" – hooks är redan kallade i korrekt ordning.
  if (!src) {
    return (
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Product
        </Heading>
        <div className="text-sm text-gray-600">No product selected.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Product Summary
        </Heading>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Image */}
          <div className="md:col-span-1">
            {product.mainImage ? (
              <img
                src={product.mainImage}
                alt={product.title || 'Product image'}
                className="w-full h-48 object-cover rounded-lg border"
              />
            ) : (
              <div className="w-full h-48 flex items-center justify-center bg-gray-50 border rounded-lg text-sm text-gray-400">
                No image
              </div>
            )}
          </div>

          {/* Key facts */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500">Title</div>
              <div className="text-sm font-medium text-gray-900">{product.title || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Product #</div>
              <div className="text-sm font-mono text-gray-900">{product.productNumber || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">SKU</div>
              <div className="text-sm text-gray-900">{product.sku || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="text-sm text-gray-900">{product.status}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Price</div>
              <div className="text-sm text-gray-900">
                {Number(product.priceAmount).toFixed(2)} {product.currency}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">VAT rate</div>
              <div className="text-sm text-gray-900">{Number(product.vatRate).toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Quantity</div>
              <div className="text-sm text-gray-900">{product.quantity}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Description */}
      {(product.description || '').trim() !== '' && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Description
          </Heading>
          <div className="text-sm text-gray-900 whitespace-pre-wrap">{product.description}</div>
        </Card>
      )}

      {/* Classification */}
      {(product.brand || product.gtin || (product.categories ?? []).length > 0) && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Classification
          </Heading>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500">Brand</div>
              <div className="text-sm text-gray-900">{product.brand || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">GTIN</div>
              <div className="text-sm text-gray-900">{product.gtin || '—'}</div>
            </div>
            <div className="sm:col-span-3">
              <div className="text-xs text-gray-500 mb-1">Categories</div>
              {product.categories?.length ? (
                <ul className="flex flex-wrap gap-2">
                  {product.categories.map((c: string, i: number) => (
                    <li key={`${c}-${i}`} className="px-2 py-0.5 rounded-full border text-xs">
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-900">—</div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Images */}
      {product.images?.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Images
          </Heading>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {product.images.map((url: string, i: number) => (
              <a
                key={`${url}-${i}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={url}
                  alt={`Product image ${i + 1}`}
                  className="w-full h-24 object-cover rounded-md border"
                />
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Channels (Woo toggle) */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Channels
        </Heading>

        {!wooConfigured ? (
          <div className="rounded-lg border border-dashed p-4 bg-gray-50">
            <Text variant="body">
              WooCommerce is not connected yet. Go to the <strong>WooCommerce</strong> plugin and
              add your store URL and API keys to enable per-product publishing.
            </Text>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-gray-900">WooCommerce</div>
              <div className="text-xs text-gray-600">
                {wooEnabled === null
                  ? 'Current status: unknown (first toggle will set it)'
                  : wooEnabled
                    ? 'Enabled for this product'
                    : 'Disabled for this product'}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled={!canToggleWoo || wooPending}
                  checked={!!wooEnabled}
                  onChange={(e) => handleWooToggle(e.target.checked)}
                />
                <span className="text-sm">{wooEnabled ? 'Enabled' : 'Disabled'}</span>
              </label>
              <Button
                variant="secondary"
                disabled={!canToggleWoo || wooPending}
                onClick={() => handleWooToggle(!(wooEnabled ?? false))}
              >
                {wooPending ? 'Saving…' : wooEnabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-3 text-xs text-gray-500">
          Note: enabling a channel here only marks the product as publishable for that channel. Use
          the <strong>WooCommerce</strong> panel to run an export/sync.
        </div>
      </Card>

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Product Metadata
        </Heading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500">System ID</div>
            <div className="text-sm font-mono text-gray-900">{product.id || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm text-gray-900">
              {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm text-gray-900">
              {product.updatedAt ? new Date(product.updatedAt).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
