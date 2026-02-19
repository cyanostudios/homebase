import React from 'react';

import { Button } from '@/components/ui/button';

import { Invoice } from '../types/invoices';

interface InvoiceStatusButtonsProps {
  invoice: Invoice;
  onStatusChange: (status: string) => void;
}

const _INVOICE_STATUS_COLORS = {
  draft:
    'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700',
  sent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  paid: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800',
  overdue:
    'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
  canceled:
    'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700',
} as const;

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
