import { useEffect, useState } from 'react';

import { channelsApi } from '@/plugins/channels/api/channelsApi';

export interface ProductChannelLink {
  channel: string;
  market: string | null;
  label: string | null;
  externalId: string;
  url: string;
}

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
          const hasInstance = link.channelInstanceId != null;
          const existingHasInstance = existing?.channelInstanceId != null;
          if (!existing || (hasInstance && !existingHasInstance)) {
            byKey.set(key, link);
          }
        }

        const built: ProductChannelLink[] = [];
        for (const link of byKey.values()) {
          const ch = (link.channel || '').toLowerCase();
          const tld = link.market || 'se';
          // CDON/Fyndiq: Sello UUID format is hyphenated; URL uses first 16 chars without hyphens
          const slug =
            link.externalId.includes('-')
              ? link.externalId.replace(/-/g, '').slice(0, 16)
              : link.externalId;

          let url = '';
          if (ch === 'cdon') {
            url = `https://cdon.${tld}/produkt/${slug}/`;
          } else if (ch === 'fyndiq') {
            url = `https://fyndiq.${tld}/produkt/${slug}/`;
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
