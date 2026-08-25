import React from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export const INVOICE_STATUS_OPTIONS = ['draft', 'sent', 'paid', 'overdue', 'canceled'] as const;

/** Platform status badge fills (Estimates / Tasks pattern). Pair with `INVOICE_STATUS_BADGE_CLASS`. */
export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-secondary/50 text-secondary-foreground border-transparent font-medium',
  sent: 'bg-blue-50/50 text-blue-700 dark:text-blue-300 border-blue-100/50 font-medium',
  paid: 'bg-green-50/50 text-green-700 dark:text-green-300 border-green-100/50 font-medium',
  overdue: 'bg-rose-50/50 text-rose-700 dark:text-rose-300 border-rose-100/50 font-medium',
  canceled: 'bg-rose-50/50 text-rose-700 dark:text-rose-300 border-rose-100/50 font-medium',
};

/** UI standards V3 badge shell. */
export const INVOICE_STATUS_BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

export function formatInvoiceStatusForDisplay(status: string): string {
  if (!status) {
    return '—';
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

interface InvoiceStatusSelectProps {
  invoice: { status?: string };
  onStatusChange: (status: string) => void;
  /** Parent supplies label (Tasks-style property row). */
  hideInlineLabel?: boolean;
  /** Smaller trigger for inline lists. */
  compact?: boolean;
}

export function InvoiceStatusSelect({
  invoice,
  onStatusChange,
  hideInlineLabel = false,
  compact = false,
}: InvoiceStatusSelectProps) {
  const status = invoice.status || 'draft';

  const selectEl = (
    <Select value={status} onValueChange={onStatusChange}>
      <SelectTrigger
        className={cn(
          'rounded-md border-border/50 bg-background px-2 text-xs shadow-none transition-colors hover:bg-accent/50',
          compact ? 'h-8 min-h-8 w-[130px] sm:h-7' : 'h-9 w-[180px]',
        )}
      >
        <SelectValue placeholder="Select status">
          <Badge
            variant="outline"
            className={cn(
              'flex items-center border-transparent px-2 font-medium',
              compact ? 'h-5 text-[10px]' : 'h-5 text-xs',
              INVOICE_STATUS_COLORS[status] || INVOICE_STATUS_COLORS.draft,
            )}
          >
            {formatInvoiceStatusForDisplay(status)}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
        {INVOICE_STATUS_OPTIONS.map((option) => (
          <SelectItem
            key={option}
            value={option}
            className="rounded-md py-2 text-xs focus:bg-accent"
          >
            <Badge
              variant="outline"
              className={cn(
                'h-5 border-transparent px-2 text-xs font-medium',
                INVOICE_STATUS_COLORS[option],
              )}
            >
              {formatInvoiceStatusForDisplay(option)}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (hideInlineLabel) {
    return <div className="flex shrink-0 justify-end">{selectEl}</div>;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="whitespace-nowrap text-sm font-medium text-foreground">Status</div>
      {selectEl}
    </div>
  );
}
