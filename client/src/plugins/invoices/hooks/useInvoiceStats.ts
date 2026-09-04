import { useMemo } from 'react';

import { useInvoices } from '../hooks/useInvoices';

import { computeInvoiceStats, type InvoiceStatsData } from '../utils/invoiceStats';

export function useInvoiceStats(): InvoiceStatsData {
  const { invoices } = useInvoices();
  return useMemo(() => computeInvoiceStats(invoices as any), [invoices]);
}
