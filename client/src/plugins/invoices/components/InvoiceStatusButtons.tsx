import React from 'react';

import { Button } from '@/components/ui/button';

import { Invoice } from '../types/invoices';

interface InvoiceStatusButtonsProps {
  invoice: Invoice;
  onStatusChange: (status: string) => void;
}

const INVOICE_STATUS_OPTIONS = ['draft', 'sent', 'paid', 'overdue', 'canceled'] as const;

export function InvoiceStatusButtons({ invoice, onStatusChange }: InvoiceStatusButtonsProps) {
  return (
    <div className="mb-4">
      <div className="text-xs font-medium text-foreground mb-2">Change Status</div>
      <div className="flex flex-wrap gap-2">
        {INVOICE_STATUS_OPTIONS.map((status) => {
          const isActive = invoice.status === status;

          return (
            <Button
              key={status}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => !isActive && onStatusChange(status)}
              disabled={isActive}
              className={`h-7 px-3 text-[10px] uppercase font-bold tracking-tight ${
                isActive ? 'opacity-100' : ''
              }`}
            >
              {status}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
