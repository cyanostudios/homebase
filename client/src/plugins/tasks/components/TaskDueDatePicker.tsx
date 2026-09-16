import React from 'react';
import { useTranslation } from 'react-i18next';

import { DatePicker } from '@/core/ui/DatePicker';

interface TaskDueDatePickerProps {
  task: { dueDate?: Date | string | null };
  onDueDateChange: (date: Date | null) => void;
  hideInlineLabel?: boolean;
  /** Smaller trigger for inline lists / quick context. */
  compact?: boolean;
}

export function TaskDueDatePicker({
  task,
  onDueDateChange,
  hideInlineLabel = false,
  compact = false,
}: TaskDueDatePickerProps) {
  const { t } = useTranslation();
  const value = task.dueDate ? new Date(task.dueDate) : null;
  const safeValue = value && !Number.isNaN(value.getTime()) ? value : null;

  const popoverEl = (
    <DatePicker
      value={safeValue}
      onChange={onDueDateChange}
      placeholder={t('tasks.setDueDate', { defaultValue: 'Set date' })}
      clearLabel={t('tasks.clearDueDate', { defaultValue: 'Clear date' })}
      compact={compact}
      variant="default"
      propWidth
      align="end"
    />
  );

  if (hideInlineLabel) {
    return <div className="flex shrink-0 justify-end">{popoverEl}</div>;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="whitespace-nowrap text-sm font-medium text-foreground">
        {t('tasks.propertyDueDate')}
      </div>
      {popoverEl}
    </div>
  );
}
