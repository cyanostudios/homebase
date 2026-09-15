import { Calendar as CalendarIcon } from 'lucide-react';
import React, { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FORM_FIELD_FILLED_CHROME } from '@/core/ui/formFieldStyles';
import { cn } from '@/lib/utils';

/** Parse local calendar YYYY-MM-DD → Date (no UTC shift). */
export function parseDateInputValue(value: string | null | undefined): Date | null {
  if (!value || !value.trim()) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Format Date → local calendar YYYY-MM-DD. */
export function formatDateInputValue(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  id?: string;
  /** Shown when empty. */
  placeholder?: string;
  /** Clear button label. */
  clearLabel?: string;
  disabled?: boolean;
  hasError?: boolean;
  /**
   * `default` — Tasks Due date chrome (bordered property control).
   * `filled` — plugin form filled chrome (`formFieldStyles`).
   */
  variant?: 'default' | 'filled';
  /** Narrow property-row width (~180px). Default true for `default` variant. */
  propWidth?: boolean;
  /** Full-width trigger (form grids). */
  fullWidth?: boolean;
  /** Denser trigger (quick context / compact rows). */
  compact?: boolean;
  className?: string;
  /** `min` date (inclusive) — earlier days disabled. */
  minDate?: Date | null;
  /** Align popover. */
  align?: 'start' | 'center' | 'end';
}

/**
 * Shared date-only picker (DayPicker popover).
 * Reference UI: Tasks Due date (`TaskDueDatePicker`).
 */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder = 'Set date',
  clearLabel = 'Clear date',
  disabled = false,
  hasError = false,
  variant = 'default',
  propWidth,
  fullWidth = false,
  compact = false,
  className,
  minDate = null,
  align = 'end',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = value && !Number.isNaN(value.getTime()) ? value : undefined;
  const displayDate = selectedDate ? selectedDate.toLocaleDateString() : placeholder;
  const usePropWidth = propWidth ?? (variant === 'default' && !fullWidth);

  const handleSelect = (date: Date | undefined) => {
    onChange(date ?? null);
    setOpen(false);
  };

  const disabledMatcher = minDate
    ? { before: new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) }
    : undefined;

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            'flex cursor-pointer items-center justify-between rounded-md px-2 text-xs font-medium transition-colors',
            variant === 'default' && 'border border-border/50 bg-background hover:bg-accent/50',
            variant === 'filled' && FORM_FIELD_FILLED_CHROME,
            variant === 'filled' && 'hover:bg-muted/80',
            compact ? 'h-7' : variant === 'filled' ? 'h-7' : 'h-9',
            usePropWidth && !fullWidth && (compact ? 'w-[130px]' : 'w-[180px] max-w-[180px]'),
            fullWidth && 'w-full',
            hasError &&
              (variant === 'filled'
                ? 'ring-1 ring-destructive focus:ring-destructive'
                : 'border-destructive'),
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <span className={cn('truncate', !selectedDate && 'text-muted-foreground')}>
            {displayDate}
          </span>
          <CalendarIcon className="h-3 w-3 shrink-0 text-muted-foreground opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
          weekStartsOn={1}
          disabled={disabledMatcher}
        />
        <div className="border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-full text-xs"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            {clearLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
