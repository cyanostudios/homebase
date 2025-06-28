import React, { useState, useEffect } from 'react';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { cn } from '@/lib/utils';

interface DateInputProps {
  value?: string | Date | null;
  onChange: (date: string | null) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function DateInput({ value, onChange, placeholder = "Select date", className, style }: DateInputProps) {
  const [day, setDay] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<string>('');

  // Initialize from value
  useEffect(() => {
    if (value) {
      let date: Date;
      if (typeof value === 'string') {
        date = new Date(value);
      } else {
        date = value;
      }
      
      if (date instanceof Date && !isNaN(date.getTime())) {
        setDay(date.getDate().toString());
        setMonth((date.getMonth() + 1).toString());
        setYear(date.getFullYear().toString());
      }
    } else {
      setDay('');
      setMonth('');
      setYear('');
    }
  }, [value]);

  // Update parent when any field changes
  useEffect(() => {
    if (day && month && year) {
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= new Date().getFullYear()) {
        const newDate = new Date(yearNum, monthNum - 1, dayNum);
        // Validate the date is actually valid (e.g., not Feb 30)
        if (newDate.getDate() === dayNum && newDate.getMonth() === monthNum - 1 && newDate.getFullYear() === yearNum) {
          onChange(newDate.toISOString());
        }
      }
    } else if (!day && !month && !year) {
      onChange(null);
    }
  }, [day, month, year, onChange]);

  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  // Generate year options (from 1930 to current year)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1930 + 1 }, (_, i) => currentYear - i);

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)} style={style}>
      {/* Day */}
      <Input
        type="number"
        placeholder="Day"
        value={day}
        onChange={(e) => setDay(e.target.value)}
        min="1"
        max="31"
        className="touch-manipulation"
        style={{ minHeight: '44px', fontSize: '16px' }}
      />
      
      {/* Month */}
      <Select value={month} onValueChange={setMonth}>
        <SelectTrigger className="touch-manipulation" style={{ minHeight: '44px', fontSize: '16px' }}>
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Year */}
      <Select value={year} onValueChange={setYear}>
        <SelectTrigger className="touch-manipulation" style={{ minHeight: '44px', fontSize: '16px' }}>
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {years.map((y) => (
            <SelectItem key={y} value={y.toString()}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}