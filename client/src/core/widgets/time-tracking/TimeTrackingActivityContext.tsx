import React, { createContext, useContext, useMemo, useState } from 'react';

type TimeTrackingActivityContextValue = {
  /** Contact id when the top-bar timer is running and that contact is selected */
  activeTrackingContactId: string | null;
  setActiveTrackingContactId: (id: string | null) => void;
};

const TimeTrackingActivityContext = createContext<TimeTrackingActivityContextValue | undefined>(
  undefined,
);

const noopSetActiveTrackingContactId = (_id: string | null) => {};

export function TimeTrackingActivityProvider({ children }: { children: React.ReactNode }) {
  const [activeTrackingContactId, setActiveTrackingContactId] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      activeTrackingContactId,
      setActiveTrackingContactId,
    }),
    [activeTrackingContactId],
  );

  return (
    <TimeTrackingActivityContext.Provider value={value}>
      {children}
    </TimeTrackingActivityContext.Provider>
  );
}

export function useTimeTrackingActivity(): TimeTrackingActivityContextValue {
  const ctx = useContext(TimeTrackingActivityContext);
  if (!ctx) {
    throw new Error('useTimeTrackingActivity must be used within TimeTrackingActivityProvider');
  }
  return ctx;
}

/** For list rows etc.; returns null when provider is absent */
export function useOptionalActiveTimeTrackingContactId(): string | null {
  const ctx = useContext(TimeTrackingActivityContext);
  return ctx?.activeTrackingContactId ?? null;
}

/** Safe for TimeTrackingWidget when provider may be absent (e.g. isolated tests). */
export function useOptionalTimeTrackingActivityDispatch(): (id: string | null) => void {
  const ctx = useContext(TimeTrackingActivityContext);
  return ctx?.setActiveTrackingContactId ?? noopSetActiveTrackingContactId;
}
