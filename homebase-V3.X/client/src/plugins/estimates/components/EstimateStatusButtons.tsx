import React from 'react';

import { Badge } from '@/components/ui/badge';

import { Estimate } from '../types/estimate';

interface EstimateStatusButtonsProps {
  estimate: Estimate;
  onStatusChange: (status: string) => void;
}

const ESTIMATE_STATUS_COLORS = {
  draft: 'bg-secondary/50 text-secondary-foreground border-transparent font-medium',
  sent: 'bg-blue-50/50 text-blue-700 dark:text-blue-300 border-blue-100/50 font-medium',
  accepted: 'bg-green-50/50 text-green-700 dark:text-green-300 border-green-100/50 font-medium',
  rejected: 'bg-rose-50/50 text-rose-700 dark:text-rose-300 border-rose-100/50 font-medium',
} as const;

const ESTIMATE_STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'rejected'] as const;

export function EstimateStatusButtons({ estimate, onStatusChange }: EstimateStatusButtonsProps) {
  return (
    <div className="mb-4">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Change Status</div>
      <div className="flex flex-wrap gap-2">
        {ESTIMATE_STATUS_OPTIONS.map((status) => {
          const isActive = estimate.status === status;

          return (
            <Badge
              key={status}
              onClick={() => onStatusChange(status)}
              disabled={isActive}
              className={
                isActive
                  ? ESTIMATE_STATUS_COLORS[status]
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
