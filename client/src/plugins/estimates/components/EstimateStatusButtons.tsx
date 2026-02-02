import React from 'react';

import { Badge } from '@/components/ui/badge';

import { Estimate } from '../types/estimate';

interface EstimateStatusButtonsProps {
  estimate: Estimate;
  onStatusChange: (status: string) => void;
}

const ESTIMATE_STATUS_COLORS = {
  draft: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700',
  sent: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800',
  accepted: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
  rejected: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
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
