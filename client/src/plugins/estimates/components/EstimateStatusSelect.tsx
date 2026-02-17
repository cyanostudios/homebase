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

import {
  ESTIMATE_STATUS_COLORS,
  ESTIMATE_STATUS_OPTIONS,
  formatEstimateStatusForDisplay,
} from '../types/estimate';
import type { Estimate } from '../types/estimate';

interface EstimateStatusSelectProps {
  estimate: Estimate;
  onStatusChange: (status: string) => void;
}

export function EstimateStatusSelect({ estimate, onStatusChange }: EstimateStatusSelectProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
        Status
      </div>
      <Select value={estimate.status} onValueChange={onStatusChange}>
        <SelectTrigger className="h-7 w-[120px] bg-background border-border/50 hover:bg-accent/50 transition-colors shadow-none rounded-md px-2">
          <SelectValue placeholder="Select status">
            <Badge
              variant="outline"
              className={cn(
                'border-transparent font-medium text-[10px] px-2 h-5 flex items-center',
                ESTIMATE_STATUS_COLORS[estimate.status as keyof typeof ESTIMATE_STATUS_COLORS],
              )}
            >
              {formatEstimateStatusForDisplay(estimate.status)}
            </Badge>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[180px]">
          {ESTIMATE_STATUS_OPTIONS.map((status) => (
            <SelectItem key={status} value={status} className="py-2 focus:bg-accent rounded-md">
              <Badge
                variant="outline"
                className={cn(
                  'border-transparent font-medium text-[10px] px-2 h-5',
                  ESTIMATE_STATUS_COLORS[status],
                )}
              >
                {formatEstimateStatusForDisplay(status)}
              </Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
