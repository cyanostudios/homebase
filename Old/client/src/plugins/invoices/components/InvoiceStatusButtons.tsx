import React from 'react';
import { Badge } from '@/core/ui/Badge';
import { Invoice } from '../types/invoices';

interface InvoiceStatusButtonsProps {
  invoice: Invoice;
  onStatusChange: (status: string) => void;
}

const INVOICE_STATUS_COLORS = {
  'draft': 'bg-gray-100 text-gray-800 border-gray-200',
  'sent': 'bg-blue-100 text-blue-800 border-blue-200',
  'paid': 'bg-green-100 text-green-800 border-green-200',
  'overdue': 'bg-red-100 text-red-800 border-red-200',
  'canceled': 'bg-gray-100 text-gray-800 border-gray-200',
} as const;

const INVOICE_STATUS_OPTIONS = ['draft', 'sent', 'paid', 'overdue', 'canceled'] as const;

export function InvoiceStatusButtons({ invoice, onStatusChange }: InvoiceStatusButtonsProps) {
  return (
    <div className="mb-4">
      <div className="text-xs font-medium text-gray-700 mb-2">Change Status</div>
      <div className="flex flex-wrap gap-2">
        {INVOICE_STATUS_OPTIONS.map((status) => {
          const isActive = invoice.status === status;
          
          return (
            <button
              key={status}
              onClick={() => !isActive && onStatusChange(status)}
              disabled={isActive}
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                isActive 
                  ? `${INVOICE_STATUS_COLORS[status]} cursor-default` 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          );
        })}
      </div>
    </div>
  );
}