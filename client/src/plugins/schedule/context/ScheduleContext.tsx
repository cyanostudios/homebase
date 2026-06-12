import React, { createContext, useContext } from 'react';

export interface ScheduleContextType {
  isSchedulePanelOpen: boolean;
  scheduleContentView: 'list' | 'settings';
  openScheduleSettings: () => void;
  closeScheduleSettingsView: () => void;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export function useScheduleContext() {
  const context = useContext(ScheduleContext);
  if (context === undefined) {
    throw new Error('useScheduleContext must be used within a ScheduleProvider');
  }
  return context;
}

const EMPTY_SCHEDULE_CONTEXT: ScheduleContextType = {
  isSchedulePanelOpen: false,
  scheduleContentView: 'list',
  openScheduleSettings: () => {},
  closeScheduleSettingsView: () => {},
};

export function ScheduleNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <ScheduleContext.Provider value={EMPTY_SCHEDULE_CONTEXT}>{children}</ScheduleContext.Provider>
  );
}

export { ScheduleContext };
