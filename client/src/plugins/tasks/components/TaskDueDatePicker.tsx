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
}

export function TaskDueDatePicker({ task, onDueDateChange }: TaskDueDatePickerProps) {
  const [open, setOpen] = useState(false);

  const selectedDate = task.dueDate ? new Date(task.dueDate) : undefined;
  const displayDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Set date';

  const handleSelect = (date: Date | undefined) => {
    onDueDateChange(date ?? null);
    setOpen(false);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
        Due Date
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-7 w-[120px] flex items-center justify-between rounded-md border border-border/50 bg-background px-2 text-[10px] font-medium transition-colors hover:bg-accent/50 cursor-pointer"
          >
            <span className={cn(!task.dueDate && 'text-muted-foreground')}>{displayDate}</span>
            <CalendarIcon className="w-3 h-3 text-muted-foreground opacity-50" />
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
          <div className="p-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs"
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
    </div>
  );
}
