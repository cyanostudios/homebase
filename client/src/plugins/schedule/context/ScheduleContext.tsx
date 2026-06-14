import React, { createContext, useContext } from 'react';

import { DEFAULT_SCHEDULE_ID } from '../types/schedule';

export interface ScheduleContextType {
  isSchedulePanelOpen: boolean;
  scheduleContentView: 'list' | 'settings';
  activeScheduleId: string;
  setActiveScheduleId: (id: string) => void;
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
  activeScheduleId: DEFAULT_SCHEDULE_ID,
  setActiveScheduleId: () => {},
  openScheduleSettings: () => {},
  closeScheduleSettingsView: () => {},
};

export function ScheduleNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <ScheduleContext.Provider value={EMPTY_SCHEDULE_CONTEXT}>{children}</ScheduleContext.Provider>
  );
}

export { ScheduleContext };
