import React, { createContext, useContext, type ReactNode } from 'react';

import { usePomodoroTimer } from '@/core/widgets/pomodoro/usePomodoroTimer';

type PomodoroTimerApi = ReturnType<typeof usePomodoroTimer>;

const PomodoroContext = createContext<PomodoroTimerApi | null>(null);

/** One shared pomodoro timer for the right-rail button + flyout panel. */
export function PomodoroProvider({ children }: { children: ReactNode }) {
  const value = usePomodoroTimer();
  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

export function usePomodoro(): PomodoroTimerApi {
  const ctx = useContext(PomodoroContext);
  if (!ctx) {
    throw new Error('usePomodoro must be used within PomodoroProvider');
  }
  return ctx;
}
