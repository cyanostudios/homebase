import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { TimeFormat } from "@/lib/date-utils";

interface TimeFormatContextType {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
}

const TimeFormatContext = createContext<TimeFormatContextType | undefined>(undefined);

export function TimeFormatProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage if available, otherwise use 24h as default
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(() => {
    const savedFormat = localStorage.getItem("timeFormat");
    return savedFormat ? (savedFormat as TimeFormat) : TimeFormat.HOUR_24;
  });

  // Update both state and localStorage when time format changes
  const setTimeFormat = (format: TimeFormat) => {
    setTimeFormatState(format);
    localStorage.setItem("timeFormat", format);
  };

  // Initialize on first render
  useEffect(() => {
    const savedFormat = localStorage.getItem("timeFormat");
    if (savedFormat) {
      setTimeFormatState(savedFormat as TimeFormat);
    }
  }, []);

  return (
    <TimeFormatContext.Provider value={{ timeFormat, setTimeFormat }}>
      {children}
    </TimeFormatContext.Provider>
  );
}

export function useTimeFormat() {
  const context = useContext(TimeFormatContext);
  if (context === undefined) {
    throw new Error("useTimeFormat must be used within a TimeFormatProvider");
  }
  return context;
}