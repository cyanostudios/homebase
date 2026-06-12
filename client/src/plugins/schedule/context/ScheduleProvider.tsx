import React, { useCallback, useEffect, useState } from 'react';

import { useApp } from '@/core/api/AppContext';

import { ScheduleContext, type ScheduleContextType } from './ScheduleContext';

export function ScheduleProvider({
  children,
  isAuthenticated: _isAuthenticated,
  onCloseOtherPanels,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const [scheduleContentView, setScheduleContentView] = useState<'list' | 'settings'>('list');

  const openScheduleSettings = useCallback(() => {
    onCloseOtherPanels();
    setScheduleContentView('settings');
  }, [onCloseOtherPanels]);

  const closeScheduleSettingsView = useCallback(() => {
    setScheduleContentView('list');
  }, []);

  useEffect(() => {
    registerPanelCloseFunction('schedule', closeScheduleSettingsView);
    return () => unregisterPanelCloseFunction('schedule');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeScheduleSettingsView]);

  const value: ScheduleContextType = {
    isSchedulePanelOpen: false,
    scheduleContentView,
    openScheduleSettings,
    closeScheduleSettingsView,
  };

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}
