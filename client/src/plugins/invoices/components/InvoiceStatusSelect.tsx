import {
  AlertCircle,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  FileText,
  Send,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BADGE_CHIP_CLASS,
  BADGE_SELECT_ITEM_CLASS,
  BADGE_SELECT_TRIGGER_CLASS,
  QC_INVOICE_STATUS_BADGE_COLORS,
} from '@/core/ui/badgeStyles';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import { cn } from '@/lib/utils';

import {
  getInvoiceStatusSelectOptions,
  INVOICE_STATUS_SELECT_OPTIONS,
  isInvoiceIssued,
} from '../utils/invoiceMlCompliance';

export const INVOICE_STATUS_OPTIONS = INVOICE_STATUS_SELECT_OPTIONS;

/** Platform status badge colors. Pair with `INVOICE_STATUS_BADGE_CLASS`. */
export const INVOICE_STATUS_COLORS: Record<string, string> = {
  ...QC_INVOICE_STATUS_BADGE_COLORS,
};

/** Platform badge shell (inline label / BADGE_CHIP_CLASS). */
export const INVOICE_STATUS_BADGE_CLASS = BADGE_CHIP_CLASS;

export function formatInvoiceStatusForDisplay(status: string): string {
  if (!status) {
    return '—';
  }
  if (status === 'partially_paid') {
    return 'Partially paid';
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function invoiceStatusIcon(status: string): LucideIcon {
  switch (status) {
    case 'sent':
      return Send;
    case 'partially_paid':
      return CircleDollarSign;
    case 'paid':
      return CheckCircle2;
    case 'overdue':
      return AlertCircle;
    case 'canceled':
      return XCircle;
    case 'draft':
      return FileText;
    default:
      return Circle;
  }
}

interface InvoiceStatusSelectProps {
  invoice: { status?: string };
  onStatusChange: (status: string) => void;
  /** Parent supplies label (Tasks-style property row). */
  hideInlineLabel?: boolean;
  /** Smaller trigger for inline lists. */
  compact?: boolean;
  /**
   * When true, Draft is not offered (issued / ML-locked documents).
   * Defaults from `invoice.status`. Form passes false while the saved row is still draft
   * so a local pending “sent” can still be reverted before save.
   */
  issuedLocked?: boolean;
}

export function InvoiceStatusSelect({
  invoice,
  onStatusChange,
  hideInlineLabel = false,
  compact = false,
  issuedLocked,
}: InvoiceStatusSelectProps) {
  const status = invoice.status || 'draft';
  const locked = issuedLocked ?? isInvoiceIssued(status);
  const options = getInvoiceStatusSelectOptions(status, { issuedLocked: locked });
  const StatusIcon = invoiceStatusIcon(status);

  const selectEl = (
    <Select value={status} onValueChange={onStatusChange}>
      <SelectTrigger
        className={cn(
          BADGE_SELECT_TRIGGER_CLASS,
          compact ? 'h-7 w-[130px]' : 'h-9 w-full sm:w-[180px]',
        )}
      >
        <SelectValue placeholder="Select status">
          <StatusOutlineBadge
            icon={StatusIcon}
            compact={compact}
            className={INVOICE_STATUS_COLORS[status] || INVOICE_STATUS_COLORS.draft}
          >
            {formatInvoiceStatusForDisplay(status)}
          </StatusOutlineBadge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
        {options.map((option) => (
          <SelectItem key={option} value={option} className={BADGE_SELECT_ITEM_CLASS}>
            <StatusOutlineBadge
              icon={invoiceStatusIcon(option)}
              className={INVOICE_STATUS_COLORS[option]}
            >
              {formatInvoiceStatusForDisplay(option)}
            </StatusOutlineBadge>
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
