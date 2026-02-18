import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useInvoices } from '@/plugins/invoices/hooks/useInvoices';

export function InvoicesDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { invoices } = useInvoices();

  const draft = invoices.filter((i) => i.status === 'draft').length;
  const sent = invoices.filter((i) => i.status === 'sent').length;
  const paid = invoices.filter((i) => i.status === 'paid').length;
  const overdue = invoices.filter((i) => i.status === 'overdue').length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal fakturor: <strong>{invoices.length}</strong>
        <br />
        <span className="text-muted-foreground">
          {draft} utkast, {sent} skickade, {paid} betalda, {overdue} förfallna
        </span>
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto px-0 text-primary hover:bg-transparent hover:text-primary/90"
        onClick={(e) => {
          e.stopPropagation();
          onOpenPlugin();
        }}
      >
        Öppna Invoices
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
