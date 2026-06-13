import React, { useCallback, useEffect, useState } from 'react';

import { useApp } from '@/core/api/AppContext';

import { DEFAULT_SCHEDULE_ID } from '../types/schedule';

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
  const [activeScheduleId, setActiveScheduleId] = useState(DEFAULT_SCHEDULE_ID);

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
    activeScheduleId,
    setActiveScheduleId,
    openScheduleSettings,
    closeScheduleSettingsView,
  };

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}
