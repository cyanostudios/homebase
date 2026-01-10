import React from 'react';

import { Badge } from '@/components/ui/badge';

import { TASK_STATUS_COLORS, TASK_STATUS_OPTIONS, formatStatusForDisplay } from '../types/tasks';

interface TaskStatusButtonsProps {
  task: any;
  onStatusChange: (status: string) => void;
}

export function TaskStatusButtons({ task, onStatusChange }: TaskStatusButtonsProps) {
  return (
    <div className="mb-4">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Change Status</div>
      <div className="flex flex-wrap gap-2">
        {TASK_STATUS_OPTIONS.map((status) => {
          const isActive = task.status === status;

          return (
            <Badge
              key={status}
              onClick={() => onStatusChange(status)}
              disabled={isActive}
              className={
                isActive
                  ? TASK_STATUS_COLORS[status]
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }
            >
              {formatStatusForDisplay(status)}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
