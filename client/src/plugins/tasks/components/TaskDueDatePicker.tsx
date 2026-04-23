import { Calendar as CalendarIcon } from 'lucide-react';
import React, { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface TaskDueDatePickerProps {
  task: any;
  onDueDateChange: (date: Date | null) => void;
  hideInlineLabel?: boolean;
}

export function TaskDueDatePicker({
  task,
  onDueDateChange,
  hideInlineLabel = false,
}: TaskDueDatePickerProps) {
  const [open, setOpen] = useState(false);

  const selectedDate = task.dueDate ? new Date(task.dueDate) : undefined;
  const displayDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Set date';

  const handleSelect = (date: Date | undefined) => {
    onDueDateChange(date ?? null);
    setOpen(false);
  };

  const popoverEl = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-[180px] cursor-pointer items-center justify-between rounded-md border border-border/50 bg-background px-2 text-xs font-medium transition-colors hover:bg-accent/50"
        >
          <span className={cn(!task.dueDate && 'text-muted-foreground')}>{displayDate}</span>
          <CalendarIcon className="h-3 w-3 text-muted-foreground opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
          weekStartsOn={1}
        />
        <div className="border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-full text-xs"
            onClick={() => {
              onDueDateChange(null);
              setOpen(false);
            }}
          >
            Clear date
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  if (hideInlineLabel) {
    return <div className="flex shrink-0 justify-end">{popoverEl}</div>;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm font-medium text-foreground whitespace-nowrap">Due Date</div>
      {popoverEl}
    </div>
  );
}
