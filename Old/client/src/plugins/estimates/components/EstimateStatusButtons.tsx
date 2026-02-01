import React from 'react';

import { Badge } from '@/core/ui/Badge';

import { Estimate } from '../types/estimate';

interface EstimateStatusButtonsProps {
  estimate: Estimate;
  onStatusChange: (status: string) => void;
}

const ESTIMATE_STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  sent: 'bg-blue-100 text-blue-800 border-blue-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
} as const;

const ESTIMATE_STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'rejected'] as const;

export function EstimateStatusButtons({ estimate, onStatusChange }: EstimateStatusButtonsProps) {
  return (
    <div className="mb-4">
      <div className="text-xs font-medium text-gray-700 mb-2">Change Status</div>
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
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
