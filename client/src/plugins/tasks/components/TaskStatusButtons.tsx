import React from 'react';
import { TASK_STATUS_COLORS, TASK_STATUS_OPTIONS, formatStatusForDisplay } from '../types/tasks';

interface TaskStatusButtonsProps {
  task: any;
  onStatusChange: (status: string) => void;
}

export function TaskStatusButtons({ task, onStatusChange }: TaskStatusButtonsProps) {
  return (
    <div className="mb-4">
      <div className="text-xs font-medium text-gray-700 mb-2">Change Status</div>
      <div className="flex flex-wrap gap-2">
        {TASK_STATUS_OPTIONS.map((status) => {
          const isActive = task.status === status;
          
          return (
            <button
              key={status}
              onClick={() => onStatusChange(status)}
              disabled={isActive}
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                isActive 
                  ? `${TASK_STATUS_COLORS[status]} cursor-default` 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer'
              }`}
            >
              {formatStatusForDisplay(status)}
            </button>
          );
        })}
      </div>
    </div>
  );
}