import { Calendar as CalendarIcon } from 'lucide-react';
import React, { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FORM_FIELD_FILLED_CHROME } from '@/core/ui/formFieldStyles';
import { useTimeFormat } from '@/core/settings/useTimeFormat';
import { formatDateTime } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

/** Value is datetime-local string: "YYYY-MM-DDTHH:mm" */
export interface DateTimePickerProps {
  value: string;
  onChange: (datetimeLocal: string) => void;
  hasError?: boolean;
  /** Shown on trigger when empty */
  placeholder?: string;
  /** Label next to the time input inside the popover */
  timeLabel?: string;
  /** Clear button at bottom of popover */
  clearLabel?: string;
  /**
   * `default` — bordered trigger (dialogs / legacy).
   * `filled` — plugin form filled chrome.
   */
  variant?: 'default' | 'filled';
  className?: string;
}

function toDate(datetimeLocal: string): Date | undefined {
  if (!datetimeLocal || !datetimeLocal.trim()) {
    return undefined;
  }
  const d = new Date(datetimeLocal);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toDatetimeLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

/**
 * Shared date+time picker (DayPicker popover + time input).
 * Calendar chrome matches `DatePicker` / Tasks Due date.
 */
export function DateTimePicker({
  value,
  onChange,
  hasError,
  placeholder = 'Set date & time',
  timeLabel = 'Time',
  clearLabel = 'Clear date & time',
  variant = 'default',
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  useTimeFormat(); // re-render when Preferences timeFormat changes
  const date = toDate(value);
  const displayText = date ? formatDateTime(date) : placeholder;

  const handleDateSelect = (selected: Date | undefined) => {
    if (!selected) {
      onChange('');
      setOpen(false);
      return;
    }
    const prev = date ?? new Date();
    const combined = new Date(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate(),
      prev.getHours(),
      prev.getMinutes(),
    );
    onChange(toDatetimeLocal(combined));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    const [h, m] = time ? time.split(':').map(Number) : [12, 0];
    const base = date ?? new Date();
    const d = new Date(base);
    d.setHours(Number.isNaN(h) ? 12 : h, Number.isNaN(m) ? 0 : m, 0, 0);
    onChange(toDatetimeLocal(d));
  };

  const timeValue = date
    ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    : '12:00';

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full cursor-pointer items-center justify-between rounded-md px-2 text-xs font-medium transition-colors',
              variant === 'default' &&
                'h-9 border border-border/50 bg-background hover:bg-accent/50',
              variant === 'filled' && cn('h-7', FORM_FIELD_FILLED_CHROME, 'hover:bg-muted/80'),
              hasError &&
                (variant === 'filled'
                  ? 'ring-1 ring-destructive focus:ring-destructive'
                  : 'border-destructive'),
              !value && 'text-muted-foreground',
              className,
            )}
          >
            <span className="truncate">{displayText}</span>
            <CalendarIcon className="h-3 w-3 shrink-0 text-muted-foreground opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <DayPicker
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
            weekStartsOn={1}
          />
          <div className="space-y-2 border-t border-border p-3">
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
                {timeLabel}
              </span>
              <Input
                type="time"
                value={timeValue}
                onChange={handleTimeChange}
                className="h-8 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-full text-xs"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              {clearLabel}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
