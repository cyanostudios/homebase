import { useEffect, useState } from 'react';

import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { invoicesApi } from '@/plugins/invoices/api/invoicesApi';
import type { Invoice } from '@/plugins/invoices/types/invoices';

export function useEstimateLinkedInvoice(
  estimateId: string | undefined,
  status: string | undefined,
): Invoice | null {
  const enabledPlugins = useEnabledPlugins();
  const [linkedInvoice, setLinkedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!estimateId || status !== 'invoiced' || !enabledPlugins.has('invoices')) {
      setLinkedInvoice(null);
      return;
    }

    let cancelled = false;
    void invoicesApi
      .getItems()
      .then((items: Invoice[]) => {
        if (cancelled) {
          return;
        }
        const found = items.find((inv) => String(inv.estimateId ?? '') === String(estimateId));
        setLinkedInvoice(found ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setLinkedInvoice(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [estimateId, status, enabledPlugins]);

  return linkedInvoice;
}
