import { CheckCircle2, Circle, FileText, Send, XCircle, type LucideIcon } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BADGE_SELECT_ITEM_CLASS } from '@/core/ui/badgeStyles';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';

import {
  ESTIMATE_STATUS_COLORS,
  ESTIMATE_STATUS_OPTIONS,
  formatEstimateStatusForDisplay,
} from '../types/estimate';
import type { Estimate } from '../types/estimate';

interface EstimateStatusSelectProps {
  estimate: Estimate;
  onStatusChange: (status: string) => void;
  /** When true, only the control is shown (parent row supplies the label). */
  hideInlineLabel?: boolean;
}

function estimateStatusIcon(status: string): LucideIcon {
  switch (status) {
    case 'sent':
      return Send;
    case 'accepted':
      return CheckCircle2;
    case 'rejected':
      return XCircle;
    case 'draft':
      return FileText;
    default:
      return Circle;
  }
}

export function EstimateStatusSelect({
  estimate,
  onStatusChange,
  hideInlineLabel,
}: EstimateStatusSelectProps) {
  const { t } = useTranslation();
  const StatusIcon = estimateStatusIcon(estimate.status);

  const select = (
    <Select value={estimate.status} onValueChange={onStatusChange}>
      <SelectTrigger className="h-9 w-[180px] bg-background border-border/50 hover:bg-accent/50 transition-colors shadow-none rounded-md px-2 text-xs">
        <SelectValue placeholder="Select status">
          <StatusOutlineBadge
            icon={StatusIcon}
            className={
              ESTIMATE_STATUS_COLORS[estimate.status as keyof typeof ESTIMATE_STATUS_COLORS]
            }
          >
            {formatEstimateStatusForDisplay(estimate.status)}
          </StatusOutlineBadge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[180px]">
        {ESTIMATE_STATUS_OPTIONS.map((status) => (
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
    return <div className="flex min-w-0 shrink-0 justify-end">{select}</div>;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm font-medium text-foreground whitespace-nowrap">
        {t('estimates.fieldStatus')}
      </div>
      {select}
    </div>
  );
}
