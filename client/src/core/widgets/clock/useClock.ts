import { useState, useEffect, useCallback } from 'react';

import {
  ClockSettings,
  DEFAULT_CLOCK_SETTINGS,
  loadClockSettings,
  saveClockSettings,
} from './clockSettings';

export function useClock() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [settings, setSettings] = useState<ClockSettings>(DEFAULT_CLOCK_SETTINGS);

  useEffect(() => {
    const loadedSettings = loadClockSettings();
    setSettings(loadedSettings);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const updateSettings = useCallback((newSettings: ClockSettings) => {
    setSettings(newSettings);
    saveClockSettings(newSettings);
  }, []);

  const formatTime = useCallback(
    (date: Date): string => {
      const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: settings.timeFormat === '12h',
        timeZone: settings.timezone,
      };
      if (settings.showSeconds) {
        options.second = '2-digit';
      }
      return date.toLocaleTimeString('sv-SE', options);
    },
    [settings.timeFormat, settings.showSeconds, settings.timezone],
  );

  const formatDate = useCallback(
    (date: Date): string => {
      let options: Intl.DateTimeFormatOptions;
      let locale: string;
      switch (settings.dateFormat) {
        case 'sv-SE':
          locale = 'sv-SE';
          options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: settings.timezone,
          };
          break;
        case 'en-US':
          locale = 'en-US';
          options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: settings.timezone,
          };
          break;
        case 'ISO':
          return date.toISOString().split('T')[0];
        case 'compact':
          locale = 'sv-SE';
          options = {
            month: 'short',
            day: 'numeric',
            timeZone: settings.timezone,
          };
          break;
        default:
          locale = 'sv-SE';
          options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: settings.timezone,
          };
      }
      return date.toLocaleDateString(locale, options);
    },
    [settings.dateFormat, settings.timezone],
  );

  return {
    currentTime,
    settings,
    formattedTime: formatTime(currentTime),
    formattedDate: formatDate(currentTime),
    updateSettings,
  };
}
