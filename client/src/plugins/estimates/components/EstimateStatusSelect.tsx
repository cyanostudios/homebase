import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

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

export function EstimateStatusSelect({
  estimate,
  onStatusChange,
  hideInlineLabel,
}: EstimateStatusSelectProps) {
  const { t } = useTranslation();
  const select = (
    <Select value={estimate.status} onValueChange={onStatusChange}>
      <SelectTrigger className="h-9 w-[180px] bg-background border-border/50 hover:bg-accent/50 transition-colors shadow-none rounded-md px-2 text-xs">
        <SelectValue placeholder="Select status">
          <Badge
            variant="outline"
            className={cn(
              'border-transparent font-medium text-xs px-2 h-5 flex items-center',
              ESTIMATE_STATUS_COLORS[estimate.status as keyof typeof ESTIMATE_STATUS_COLORS],
            )}
          >
            {formatEstimateStatusForDisplay(estimate.status)}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[180px]">
        {ESTIMATE_STATUS_OPTIONS.map((status) => (
          <SelectItem
            key={status}
            value={status}
            className="py-2 focus:bg-accent rounded-md text-xs"
          >
            <Badge
              variant="outline"
              className={cn(
                'border-transparent font-medium text-xs px-2 h-5',
                ESTIMATE_STATUS_COLORS[status],
              )}
            >
              {formatEstimateStatusForDisplay(status)}
            </Badge>
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
