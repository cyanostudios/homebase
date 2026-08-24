import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Invoice } from '@/plugins/invoices/context/InvoicesContext';

interface DashboardInvoicesBarProps {
  invoices: Invoice[];
}

export function DashboardInvoicesBar({ invoices }: DashboardInvoicesBarProps) {
  const { t } = useTranslation();

  const { draftCount, sentCount, paidCount, overdueCount } = useMemo(() => {
    let draft = 0;
    let sent = 0;
    let paid = 0;
    let overdue = 0;
    for (const invoice of invoices) {
      if (invoice.status === 'draft') {
        draft += 1;
      } else if (invoice.status === 'sent') {
        sent += 1;
      } else if (invoice.status === 'paid') {
        paid += 1;
      } else if (invoice.status === 'overdue') {
        overdue += 1;
      }
    }
    return { draftCount: draft, sentCount: sent, paidCount: paid, overdueCount: overdue };
  }, [invoices]);

  const total = invoices.length || 1;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {t('dashboard.invoiceStatus')}
      </p>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {draftCount > 0 && (
          <div style={{ width: `${(draftCount / total) * 100}%` }} className="bg-slate-400" />
        )}
        {sentCount > 0 && (
          <div style={{ width: `${(sentCount / total) * 100}%` }} className="bg-blue-400" />
        )}
        {paidCount > 0 && (
          <div style={{ width: `${(paidCount / total) * 100}%` }} className="bg-emerald-500" />
        )}
        {overdueCount > 0 && (
          <div style={{ width: `${(overdueCount / total) * 100}%` }} className="bg-red-500" />
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          {t('dashboard.legend.draft', { count: draftCount })}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-400" />
          {t('dashboard.legend.sent', { count: sentCount })}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {t('dashboard.legend.paid', { count: paidCount })}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          {t('dashboard.legend.overdue', { count: overdueCount })}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('dashboard.legend.invoicesTotal', { count: invoices.length })}
      </p>
    </div>
  );
}
