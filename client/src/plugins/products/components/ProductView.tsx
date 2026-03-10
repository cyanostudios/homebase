import React, { useMemo, useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading, Text } from '@/core/ui/Typography';
import { channelsApi, type ChannelMapRow } from '@/plugins/channels/api/channelsApi';
import { useChannels } from '@/plugins/channels/hooks/useChannels';
import type { ChannelInstance, ChannelProductOverride } from '@/plugins/channels/types/channels';

interface ProductViewProps {
  item?: any; // preferred prop from panel renderer
  product?: any; // legacy fallback (kept for compatibility)
}

export const ProductView: React.FC<ProductViewProps> = ({ item, product }) => {
  const { channels, setProductEnabled } = useChannels();
  const src = item ?? product;

  const productData = useMemo(
    () => ({
      id: src?.id ?? '',
      title: src?.title ?? '',
      status: src?.status ?? 'for sale',
      quantity: Number.isFinite(src?.quantity) ? Number(src?.quantity) : 0,
      priceAmount: Number.isFinite(src?.priceAmount) ? Number(src?.priceAmount) : 0,
      currency: src?.currency ?? 'SEK',
      vatRate: Number.isFinite(src?.vatRate) ? Number(src?.vatRate) : 25,
      sku: src?.sku ?? '',
      description: src?.description ?? '',
      mainImage: src?.mainImage ?? '',
      images: Array.isArray(src?.images) ? src.images : [],
      categories: Array.isArray(src?.categories) ? src.categories : [],
      brand: src?.brand ?? '',
      mpn: src?.mpn ?? '',
      gtin: src?.gtin ?? '',
      createdAt: src?.createdAt,
      updatedAt: src?.updatedAt,
    }),
    [src],
  );

  const wooSummary = (channels || []).find(
    (c) => String(c.channel).toLowerCase() === 'woocommerce',
  );
  const wooConfigured = !!wooSummary?.configured;

  const [wooEnabled, setWooEnabled] = useState<boolean | null>(null);
  const [wooPending, setWooPending] = useState(false);
  const [wooExternalId, setWooExternalId] = useState<string | null>(null);
  const canToggleWoo = wooConfigured && !!productData.id;

  // ---- Selloklon per-instance overrides ----
  const [instances, setInstances] = useState<ChannelInstance[]>([]);
  const [_overrides, setOverrides] = useState<ChannelProductOverride[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [savingOverrideKey, setSavingOverrideKey] = useState<string | null>(null);
  const [draftOverrideByInstanceId, setDraftOverrideByInstanceId] = useState<
    Record<string, { active: boolean; priceAmount: string; currency: string; category: string }>
  >({});

  // ---- Channel links (external_id from Sello/buildChannelMapFromSello) ----
  const [channelLinks, setChannelLinks] = useState<
    Array<{
      channel: string;
      market: string | null;
      label: string | null;
      externalId: string;
      url: string;
    }>
  >([]);
  const [loadingChannelLinks, setLoadingChannelLinks] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadMap() {
      if (!canToggleWoo) {
        setWooEnabled(null);
        setWooExternalId(null);
        return;
      }
      try {
        const res = (await channelsApi.getProductMap({
          productId: String(productData.id),
          channel: 'woocommerce',
        })) as { ok: true; row: ChannelMapRow | null };
        if (!cancelled) {
          setWooEnabled(res.row ? !!res.row.enabled : false);
          setWooExternalId(res.row?.external_id ?? null);
        }
      } catch {
        if (!cancelled) {
          setWooEnabled(null);
          setWooExternalId(null);
        }
      }
    }
    loadMap();
    return () => {
      cancelled = true;
    };
  }, [canToggleWoo, productData.id]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!productData.id) {
        return;
      }
      setLoadingOverrides(true);
      try {
        const [instResp, ovResp] = await Promise.all([
          channelsApi.getInstances(),
          channelsApi.getOverrides({ productId: String(productData.id) }),
        ]);

        if (cancelled) {
          return;
        }
        const insts = instResp.items || [];
        const ovs = ovResp.items || [];

        setInstances(insts);
        setOverrides(ovs);

        setDraftOverrideByInstanceId(() => {
          const next: Record<
            string,
            { active: boolean; priceAmount: string; currency: string; category: string }
          > = {};
          for (const inst of insts) {
            const ov =
              ovs.find((o) => String(o.instanceId ?? '') === String(inst.id ?? '')) || null;
            next[inst.id] = {
              active: ov ? !!ov.active : false,
              priceAmount: (ov?.priceAmount ?? null) !== null ? String(ov.priceAmount) : '',
              currency: String(ov?.currency || ''),
              category: String(ov?.category || ''),
            };
          }
          return next;
        });
      } catch (err) {
        if (!cancelled) {
          setInstances([]);
          setOverrides([]);
        }
        console.error('Failed to load channel overrides:', err);
      } finally {
        if (!cancelled) {
          setLoadingOverrides(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [productData.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadLinks() {
      if (!productData.id) {
        setChannelLinks([]);
        return;
      }
      setLoadingChannelLinks(true);
      try {
        const res = await channelsApi.getProductChannelLinks(String(productData.id));
        if (cancelled) {
          return;
        }
        const built: Array<{
          channel: string;
          market: string | null;
          label: string | null;
          externalId: string;
          url: string;
        }> = [];
        for (const link of res.links || []) {
          const ch = link.channel.toLowerCase();
          const tld = link.market || 'se';
          let url = '';
          if (ch === 'cdon') {
            url = `https://cdon.${tld}/produkt/${link.externalId}/`;
          } else if (ch === 'fyndiq') {
            url = `https://fyndiq.${tld}/produkt/${link.externalId}/`;
          }
          if (url) {
            built.push({
              channel: ch,
              market: link.market,
              label: link.label,
              externalId: link.externalId,
              url,
            });
          }
        }
        setChannelLinks(built);
      } catch {
        if (!cancelled) {
          setChannelLinks([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingChannelLinks(false);
        }
      }
    }
    loadLinks();
    return () => {
      cancelled = true;
    };
  }, [productData.id]);

  const saveOverride = async (inst: ChannelInstance) => {
    const draft = draftOverrideByInstanceId[inst.id];
    if (!draft || !productData.id) {
      return;
    }
    const key = `${inst.channel}.${inst.instanceKey}`;
    setSavingOverrideKey(key);
    try {
      await channelsApi.upsertOverride({
        productId: String(productData.id),
        channelInstanceId: inst.id,
        active: !!draft.active,
        priceAmount: (draft.priceAmount || '').trim() === '' ? null : Number(draft.priceAmount),
        currency: (draft.currency || '').trim() || null,
        category: (draft.category || '').trim() || null,
        vatRate: productData.vatRate,
      });
      const ovResp = await channelsApi.getOverrides({ productId: String(productData.id) });
      setOverrides(ovResp.items || []);
    } catch (err) {
      console.error('Failed to save override:', err);
    } finally {
      setSavingOverrideKey(null);
    }
  };

  const handleWooToggle = async (next: boolean) => {
    if (!canToggleWoo || !productData.id) {
      return;
    }
    setWooPending(true);
    try {
      await setProductEnabled({
        productId: String(productData.id),
        channel: 'woocommerce',
        enabled: next,
      });
      setWooEnabled(next);
      try {
        const res = (await channelsApi.getProductMap({
          productId: String(productData.id),
          channel: 'woocommerce',
        })) as { ok: true; row: ChannelMapRow | null };
        setWooExternalId(res.row?.external_id ?? null);
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.error('Failed to toggle Woo mapping', e);
    } finally {
      setWooPending(false);
    }
  };

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
            {productData.mainImage ? (
              <img
                src={productData.mainImage}
                alt={productData.title || 'Product image'}
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
              <div className="text-sm font-medium text-gray-900">{productData.title || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">ID</div>
              <div className="text-sm font-mono text-gray-900">{productData.id || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">SKU</div>
              <div className="text-sm text-gray-900">{productData.sku || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Price</div>
              <div className="text-sm text-gray-900">
                {Number(productData.priceAmount).toFixed(2)} {productData.currency}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">VAT rate</div>
              <div className="text-sm text-gray-900">{Number(productData.vatRate).toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Quantity</div>
              <div className="text-sm text-gray-900">{productData.quantity}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Description */}
      {(productData.description || '').trim() !== '' && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Description
          </Heading>
          <div className="text-sm text-gray-900 whitespace-pre-wrap">{productData.description}</div>
        </Card>
      )}

      {/* Classification */}
      {(productData.brand ||
        productData.mpn ||
        productData.gtin ||
        (productData.categories ?? []).length > 0) && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Classification
          </Heading>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500">Brand</div>
              <div className="text-sm text-gray-900">{productData.brand || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">MPN</div>
              <div className="text-sm text-gray-900">{productData.mpn || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">GTIN</div>
              <div className="text-sm text-gray-900">{productData.gtin || '—'}</div>
            </div>
            <div className="sm:col-span-3">
              <div className="text-xs text-gray-500 mb-1">Categories</div>
              {productData.categories?.length ? (
                <ul className="flex flex-wrap gap-2">
                  {productData.categories.map((c: string) => (
                    <li key={c} className="px-2 py-0.5 rounded-full border text-xs">
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
      {productData.images?.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Images
          </Heading>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {productData.images.map((url: string) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={url}
                  alt="Product"
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
              add your store URL and API keys to enable publishing.
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
              {wooExternalId && (
                <div className="text-xs text-gray-500 mt-1">
                  Remote ID: <span className="font-mono">{wooExternalId}</span>
                </div>
              )}
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
          Note: enabling a channel here marks the product as publishable. You can publish from the{' '}
          <strong>Products</strong> list (Publish…) or from the <strong>WooCommerce</strong> plugin
          panel.
        </div>

        {/* Per-instance overrides */}
        <div className="mt-5">
          <Heading level={3} className="mb-2">
            Per-instance overrides
          </Heading>
          <Text variant="caption" className="text-gray-600 mb-3">
            Control <strong>active</strong>, <strong>price</strong>, and <strong>category</strong>{' '}
            per market/store instance.
          </Text>

          {loadingOverrides ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : instances.length === 0 ? (
            <div className="text-sm text-gray-500">
              No instances configured yet. Open the <strong>Channels</strong> plugin and create
              defaults for CDON/Fyndiq.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 overflow-hidden">
              {instances
                .filter((i) =>
                  ['cdon', 'fyndiq', 'woocommerce'].includes(String(i.channel).toLowerCase()),
                )
                .map((inst) => {
                  const draft = draftOverrideByInstanceId[inst.id] || {
                    active: false,
                    priceAmount: '',
                    currency: '',
                    category: '',
                  };
                  const label = inst.label || `${inst.channel}.${inst.instanceKey}`;
                  const saving = savingOverrideKey === `${inst.channel}.${inst.instanceKey}`;

                  return (
                    <div key={inst.id} className="p-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{label}</div>
                          <div className="text-xs text-gray-500">
                            {String(inst.channel).toLowerCase()}.{inst.instanceKey}
                            {inst.market ? ` · market ${inst.market}` : ''}
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          disabled={saving}
                          onClick={() => saveOverride(inst)}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!draft.active}
                            onChange={(e) =>
                              setDraftOverrideByInstanceId((prev) => ({
                                ...prev,
                                [inst.id]: { ...draft, active: e.target.checked },
                              }))
                            }
                          />
                          <span className="text-sm">Active</span>
                        </label>

                        <input
                          className="h-9 rounded-md border px-2 text-sm"
                          placeholder="price"
                          value={draft.priceAmount}
                          onChange={(e) =>
                            setDraftOverrideByInstanceId((prev) => ({
                              ...prev,
                              [inst.id]: { ...draft, priceAmount: e.target.value },
                            }))
                          }
                        />

                        <input
                          className="h-9 rounded-md border px-2 text-sm"
                          placeholder="currency (SEK/EUR/DKK)"
                          value={draft.currency}
                          onChange={(e) =>
                            setDraftOverrideByInstanceId((prev) => ({
                              ...prev,
                              [inst.id]: { ...draft, currency: e.target.value },
                            }))
                          }
                        />

                        <input
                          className="h-9 rounded-md border px-2 text-sm"
                          placeholder={
                            String(inst.channel).toLowerCase() === 'woocommerce'
                              ? 'categories'
                              : 'category'
                          }
                          value={draft.category}
                          onChange={(e) =>
                            setDraftOverrideByInstanceId((prev) => ({
                              ...prev,
                              [inst.id]: { ...draft, category: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </Card>

      {/* Channel links */}
      {(channelLinks.length > 0 || loadingChannelLinks) && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Channel links
          </Heading>
          {loadingChannelLinks ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {channelLinks.map((link) => (
                <a
                  key={`${link.channel}-${link.market}-${link.externalId}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
                >
                  <span className="capitalize">{link.channel}</span>
                  {link.market && (
                    <span className="text-gray-500">({link.market.toUpperCase()})</span>
                  )}
                  <span className="text-gray-400">→</span>
                </a>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Product Metadata
        </Heading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">System ID</div>
            <div className="text-sm font-medium font-mono">{productData.id || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Created</div>
            <div className="text-sm font-medium">
              {productData.createdAt ? new Date(productData.createdAt).toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last Updated</div>
            <div className="text-sm font-medium">
              {productData.updatedAt ? new Date(productData.updatedAt).toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
