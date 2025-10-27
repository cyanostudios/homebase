import React from 'react';

import { Badge } from '@/core/ui/Badge';

import { TASK_PRIORITY_COLORS, TASK_PRIORITY_OPTIONS } from '../types/tasks';

interface TaskPriorityButtonsProps {
  task: any;
  onPriorityChange: (priority: string) => void;
}

export function TaskPriorityButtons({ task, onPriorityChange }: TaskPriorityButtonsProps) {
  return (
    <div className="mb-4">
      <div className="text-xs font-medium text-gray-700 mb-2">Change Priority</div>
      <div className="flex flex-wrap gap-2">
        {TASK_PRIORITY_OPTIONS.map((priority) => {
          const isActive = task.priority === priority;

          return (
            <Badge
              key={priority}
              onClick={() => onPriorityChange(priority)}
              disabled={isActive}
              className={
                isActive
                  ? TASK_PRIORITY_COLORS[priority]
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }
            >
              {priority}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
