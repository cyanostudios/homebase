import React from 'react';

import { Badge } from '@/components/ui/badge';

import { TASK_PRIORITY_COLORS, TASK_PRIORITY_OPTIONS } from '../types/tasks';

interface TaskPriorityButtonsProps {
  task: any;
  onPriorityChange: (priority: string) => void;
}

export function TaskPriorityButtons({ task, onPriorityChange }: TaskPriorityButtonsProps) {
  return (
    <div className="mb-4">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
        Change Priority
      </div>
      <div className="flex flex-wrap gap-2">
        {TASK_PRIORITY_OPTIONS.map((priority) => {
          const isActive = task.priority === priority;

          // Define unselected styles that match the color theme
          const unselectedStyles: Record<string, string> = {
            Low: 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/20',
            Medium:
              'bg-white dark:bg-gray-800 text-yellow-600 dark:text-yellow-400 border-yellow-100 dark:border-yellow-900/50 hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
            High: 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20',
          };

          return (
            <Badge
              key={priority}
              onClick={() => onPriorityChange(priority)}
              disabled={isActive}
              className={isActive ? TASK_PRIORITY_COLORS[priority] : unselectedStyles[priority]}
            >
              {priority}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
