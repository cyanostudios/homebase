import { format, formatISO } from 'date-fns';

// Time format options
export enum TimeFormat {
  HOUR_12 = '12h',
  HOUR_24 = '24h'
}

// Date format options
export enum DateFormat {
  US = 'us',        // Aug 16, 2025
  EUROPEAN = 'eu'   // 16 Aug, 2025
}

// Format a date with time based on user preferences
export function formatDateTime(date: Date | string, timeFormat: TimeFormat = TimeFormat.HOUR_24, dateFormat: DateFormat = DateFormat.US): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Date pattern based on preference
  const datePattern = dateFormat === DateFormat.US ? 'MMM d, yyyy' : 'd MMM, yyyy';
  
  // Time pattern based on preference
  const timePattern = timeFormat === TimeFormat.HOUR_12 ? 'h:mm a' : 'HH:mm';
  
  return format(dateObj, `${datePattern} • ${timePattern}`);
}

// Format just the date portion based on user preferences
export function formatDate(date: Date | string, dateFormat: DateFormat = DateFormat.US): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const formatPattern = dateFormat === DateFormat.US 
    ? 'MMM d, yyyy'  // Aug 16, 2025
    : 'd MMM, yyyy'; // 16 Aug, 2025
  
  return format(dateObj, formatPattern);
}

// Format just the time portion based on user preferences
export function formatTime(date: Date | string, timeFormat: TimeFormat = TimeFormat.HOUR_24): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const formatPattern = timeFormat === TimeFormat.HOUR_12 
    ? 'h:mm a'  // 12-hour format with AM/PM
    : 'HH:mm';  // 24-hour format
  
  return format(dateObj, formatPattern);
}

// Format for display in form inputs
export function formatForCalendarDisplay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'PPP - p');
}

// Format for datetime-local input
export function formatForDateTimeInput(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatISO(dateObj).slice(0, 16); // Format as YYYY-MM-DDTHH:MM for datetime-local inputs
}

// Get hours and minutes from a date object for time input
export function getTimeInputValue(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'HH:mm');
}