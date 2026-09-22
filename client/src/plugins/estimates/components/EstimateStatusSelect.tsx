import {
  CheckCircle2,
  Circle,
  FileText,
  Receipt,
  Send,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

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
} from '@/core/ui/badgeStyles';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import { cn } from '@/lib/utils';

import {
  ESTIMATE_STATUS_COLORS,
  ESTIMATE_STATUS_OPTIONS,
  formatEstimateStatusForDisplay,
} from '../types/estimate';
import type { Estimate } from '../types/estimate';

export const ESTIMATE_STATUS_BADGE_CLASS = BADGE_CHIP_CLASS;

const USER_SELECTABLE_STATUSES = ESTIMATE_STATUS_OPTIONS.filter((s) => s !== 'invoiced');

interface EstimateStatusSelectProps {
  estimate: Estimate;
  onStatusChange: (status: string) => void;
  /** Parent supplies label (Tasks/Invoices-style property row). */
  hideInlineLabel?: boolean;
  disabled?: boolean;
}

function estimateStatusIcon(status: string): LucideIcon {
  switch (status) {
    case 'sent':
      return Send;
    case 'accepted':
      return CheckCircle2;
    case 'rejected':
      return XCircle;
    case 'invoiced':
      return Receipt;
    case 'draft':
      return FileText;
    default:
      return Circle;
  }
}

export function EstimateStatusSelect({
  estimate,
  onStatusChange,
  hideInlineLabel = false,
  disabled = false,
}: EstimateStatusSelectProps) {
  const { t } = useTranslation();
  const StatusIcon = estimateStatusIcon(estimate.status);

  const select = (
    <Select value={estimate.status} onValueChange={onStatusChange} disabled={disabled}>
      <SelectTrigger className={cn(BADGE_SELECT_TRIGGER_CLASS, 'h-9 w-full sm:w-[180px]')}>
        <SelectValue placeholder="Select status">
          <StatusOutlineBadge
            icon={StatusIcon}
            className={
              ESTIMATE_STATUS_COLORS[estimate.status as keyof typeof ESTIMATE_STATUS_COLORS] ||
              ESTIMATE_STATUS_COLORS.draft
            }
          >
            {formatEstimateStatusForDisplay(estimate.status)}
          </StatusOutlineBadge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
        {USER_SELECTABLE_STATUSES.map((status) => (
          <SelectItem key={status} value={status} className={BADGE_SELECT_ITEM_CLASS}>
            <StatusOutlineBadge
              icon={estimateStatusIcon(status)}
              className={ESTIMATE_STATUS_COLORS[status]}
            >
              {formatEstimateStatusForDisplay(status)}
            </StatusOutlineBadge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (hideInlineLabel) {
    return <div className="flex shrink-0 justify-end">{select}</div>;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="whitespace-nowrap text-sm font-medium text-foreground">
        {t('estimates.fieldStatus')}
      </div>
      {select}
    </div>
  );
}
