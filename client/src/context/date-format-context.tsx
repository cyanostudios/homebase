import { createContext, useContext, useState, useEffect } from 'react';
import { DateFormat } from '@/lib/date-utils';

interface DateFormatContextType {
  dateFormat: DateFormat;
  setDateFormat: (format: DateFormat) => void;
}

const DateFormatContext = createContext<DateFormatContextType | undefined>(undefined);

export function DateFormatProvider({ children }: { children: React.ReactNode }) {
  const [dateFormat, setDateFormatState] = useState<DateFormat>(() => {
    // Load from localStorage or default to US format
    const saved = localStorage.getItem('dateFormat');
    return (saved as DateFormat) || DateFormat.US;
  });

  const setDateFormat = (format: DateFormat) => {
    setDateFormatState(format);
    localStorage.setItem('dateFormat', format);
  };

  useEffect(() => {
    // Save to localStorage whenever format changes
    localStorage.setItem('dateFormat', dateFormat);
  }, [dateFormat]);

  return (
    <DateFormatContext.Provider value={{ dateFormat, setDateFormat }}>
      {children}
    </DateFormatContext.Provider>
  );
}

export function useDateFormat() {
  const context = useContext(DateFormatContext);
  if (context === undefined) {
    throw new Error('useDateFormat must be used within a DateFormatProvider');
  }
  return context;
}