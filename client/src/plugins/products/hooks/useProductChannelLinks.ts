import { useEffect, useState } from 'react';

import { channelsApi } from '@/plugins/channels/api/channelsApi';

export interface ProductChannelLink {
  channel: string;
  market: string | null;
  label: string | null;
  externalId: string;
  url: string;
}

function normalizeStoreUrl(raw: string | null | undefined): string | null {
  const s = String(raw || '').trim();
  if (!s) {
    return null;
  }
  if (/^https?:\/\//i.test(s)) {
    return s.replace(/\/+$/, '');
  }
  return `https://${s.replace(/\/+$/, '')}`;
}

/** CDON/Fyndiq product path uses a 16-char hex slug (from API article UUID or equivalent). */
function slugForCdOnFyndiqUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) {
    return null;
  }
  if (/^\d+$/.test(s)) {
    return null;
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return s.replace(/-/g, '').slice(0, 16);
  }
  if (/^[0-9a-f]{32}$/i.test(s)) {
    return s.slice(0, 16);
  }
  if (/^[0-9a-f]{16}$/i.test(s)) {
    return s;
  }
  return null;
}

const PRODUCT_LINKS_CACHE_TTL_MS = 5_000;
const productLinksCache = new Map<
  string,
  {
    fetchedAt: number;
    links: ProductChannelLink[];
  }
>();

export function useProductChannelLinks(productId: string, enabled = true) {
  const [links, setLinks] = useState<ProductChannelLink[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLinks([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function loadLinks() {
      if (!productId) {
        setLinks([]);
        return;
      }
      const cached = productLinksCache.get(productId);
      if (cached && Date.now() - cached.fetchedAt < PRODUCT_LINKS_CACHE_TTL_MS) {
        setLinks(cached.links);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await channelsApi.getProductChannelLinks(productId);
        if (cancelled) {
          return;
        }
        // Prefer instance-specific rows over channel-level rows per stable key.
        const byKey = new Map<string, (typeof res.links)[0]>();
        for (const link of res.links || []) {
          const ch = (link.channel || '').toLowerCase();
          const tld = link.market || 'se';
          const instanceKey = String(link.instanceKey || '').trim();
          const key = ch === 'woocommerce' ? `${ch}:${instanceKey}` : `${ch}:${tld}`;
          const existing = byKey.get(key);
          const hasInstance =
            link.channelInstanceId !== undefined && link.channelInstanceId !== null;
          const existingHasInstance =
            existing?.channelInstanceId !== undefined && existing?.channelInstanceId !== null;
          if (!existing || (hasInstance && !existingHasInstance)) {
            byKey.set(key, link);
          }
        }

        const built: ProductChannelLink[] = [];
        for (const link of byKey.values()) {
          const ch = (link.channel || '').toLowerCase();
          const tld = link.market || 'se';
          const slug =
            ch === 'cdon' || ch === 'fyndiq' ? slugForCdOnFyndiqUrl(link.externalId) : null;
          let url = '';
          if (ch === 'cdon' || ch === 'fyndiq') {
            if (!slug) {
              continue;
            }
            const pathSegment = tld === 'fi' ? 'tuote' : 'produkt';
            if (ch === 'cdon') {
              url = `https://cdon.${tld}/${pathSegment}/${slug}/`;
            } else if (ch === 'fyndiq') {
              url = `https://fyndiq.${tld}/${pathSegment}/${slug}/`;
            }
          } else if (ch === 'woocommerce') {
            const storeUrl = normalizeStoreUrl(link.storeUrl);
            const externalId = String(link.externalId || '').trim();
            if (!storeUrl || !/^\d+$/.test(externalId)) {
              continue;
            }
            // Build our own Woo permalink-style link from the merchant store URL.
            url = `${storeUrl}/?p=${externalId}`;
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
        productLinksCache.set(productId, {
          fetchedAt: Date.now(),
          links: built,
        });
        setLinks(built);
      } catch {
        if (!cancelled) {
          setLinks([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadLinks();
    return () => {
      cancelled = true;
    };
  }, [productId, enabled]);

  return { links, loading };
}
