import { Calendar as CalendarIcon } from 'lucide-react';
import React, { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** Value is datetime-local string: "YYYY-MM-DDTHH:mm" */
interface MatchDateTimePickerProps {
  value: string;
  onChange: (datetimeLocal: string) => void;
  hasError?: boolean;
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

export function MatchDateTimePicker({ value, onChange, hasError }: MatchDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const date = toDate(value);
  const displayText = date
    ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Set date & time';

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
    const time = e.target.value; // "HH:mm"
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
              'h-9 w-full flex items-center justify-between rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent/50 cursor-pointer',
              hasError && 'border-destructive',
              !value && 'text-muted-foreground',
            )}
          >
            <span>{displayText}</span>
            <CalendarIcon className="w-4 h-4 text-muted-foreground opacity-50" />
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
          <div className="p-3 border-t border-border space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                Time
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
              className="w-full h-7 text-xs"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Clear date & time
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
