import { useEffect, useMemo, useState } from 'react';

import { useApp } from '@/core/api/AppContext';
import { hasInventoryInvoicingPlugins } from '@/core/settings/inventoryInvoicingGate';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { CLUBDESK_INVENTORY_SETTINGS_KEY } from '@/plugins/clubdesk/utils/clubdeskInventorySettingsKey';
import { GARMENTS_SETTINGS_KEY } from '@/plugins/garments/utils/garmentColumnCount';

export type InvoiceInventorySource = 'garments' | 'clubdesk';

export function useInvoiceInventorySources(): {
  sources: InvoiceInventorySource[];
  loading: boolean;
  hasInvoicingPlugins: boolean;
} {
  const enabledPlugins = useEnabledPlugins();
  const { getSettings, settingsVersion } = useApp();
  const hasInvoicingPlugins = useMemo(
    () => hasInventoryInvoicingPlugins(enabledPlugins),
    [enabledPlugins],
  );

  const [sources, setSources] = useState<InvoiceInventorySource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasInvoicingPlugins) {
      setSources([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const garmentsPromise = enabledPlugins.has('garments')
      ? getSettings(GARMENTS_SETTINGS_KEY)
      : Promise.resolve(null);
    const clubdeskPromise = enabledPlugins.has('clubdesk')
      ? getSettings(CLUBDESK_INVENTORY_SETTINGS_KEY)
      : Promise.resolve(null);

    Promise.all([garmentsPromise, clubdeskPromise])
      .then(([garmentsSettings, clubdeskSettings]) => {
        if (cancelled) {
          return;
        }
        const next: InvoiceInventorySource[] = [];
        if (enabledPlugins.has('garments') && garmentsSettings?.invoicable === true) {
          next.push('garments');
        }
        if (enabledPlugins.has('clubdesk') && clubdeskSettings?.invoicable === true) {
          next.push('clubdesk');
        }
        setSources(next);
      })
      .catch(() => {
        if (!cancelled) {
          setSources([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabledPlugins, getSettings, hasInvoicingPlugins, settingsVersion]);

  return { sources, loading, hasInvoicingPlugins };
}
