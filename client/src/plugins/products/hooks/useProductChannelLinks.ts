import { useEffect, useState } from 'react';

import { channelsApi } from '@/plugins/channels/api/channelsApi';

export interface ProductChannelLink {
  channel: string;
  market: string | null;
  label: string | null;
  externalId: string;
  url: string;
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
        // Prefer Sello rows (channelInstanceId set) over sync rows (null) per (channel, market)
        const byKey = new Map<string, (typeof res.links)[0]>();
        for (const link of res.links || []) {
          const ch = (link.channel || '').toLowerCase();
          const tld = link.market || 'se';
          const key = `${ch}:${tld}`;
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
          // CDON/Fyndiq: Sello UUID format is hyphenated; URL uses first 16 chars without hyphens
          const slug = link.externalId.includes('-')
            ? link.externalId.replace(/-/g, '').slice(0, 16)
            : link.externalId;

          let url = '';
          const pathSegment = tld === 'fi' ? 'tuote' : 'produkt';
          if (ch === 'cdon') {
            url = `https://cdon.${tld}/${pathSegment}/${slug}/`;
          } else if (ch === 'fyndiq') {
            url = `https://fyndiq.${tld}/${pathSegment}/${slug}/`;
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
