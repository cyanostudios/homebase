import { useState, useEffect, useRef, useCallback } from 'react';

import { pomodoroAudio } from './pomodoroAudio';
import { PomodoroSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from './pomodoroSettings';

type TimerState = 'idle' | 'running' | 'paused';
type SessionType = 'work' | 'shortBreak' | 'longBreak';

export function usePomodoroTimer() {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [timeLeft, setTimeLeft] = useState(settings.workDuration * 60); // seconds
  const [state, setState] = useState<TimerState>('idle');
  const [sessionType, setSessionType] = useState<SessionType>('work');
  const [completedSessions, setCompletedSessions] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadedSettings = loadSettings();
    setSettings(loadedSettings);
    setTimeLeft(loadedSettings.workDuration * 60);
  }, []);

  // Calculate current session info
  const currentSession = Math.floor(completedSessions / 2) + 1;
  const totalSessions = settings.sessionsUntilLongBreak;

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get current session duration in seconds
  const getCurrentDuration = (): number => {
    switch (sessionType) {
      case 'work':
        return settings.workDuration * 60;
      case 'shortBreak':
        return settings.shortBreakDuration * 60;
      case 'longBreak':
        return settings.longBreakDuration * 60;
    }
  };

  // Calculate progress percentage
  const progress = ((getCurrentDuration() - timeLeft) / getCurrentDuration()) * 100;

  // Update settings
  const updateSettings = useCallback(
    (newSettings: PomodoroSettings) => {
      setSettings(newSettings);
      saveSettings(newSettings);

      // Update timeLeft if we're idle
      if (state === 'idle') {
        const duration =
          sessionType === 'work'
            ? newSettings.workDuration * 60
            : sessionType === 'shortBreak'
              ? newSettings.shortBreakDuration * 60
              : newSettings.longBreakDuration * 60;
        setTimeLeft(duration);
      }
    },
    [state, sessionType],
  );

  // Start timer
  const start = () => {
    setState('running');
    // Clear any pending auto-start
    if (autoStartTimeoutRef.current) {
      clearTimeout(autoStartTimeoutRef.current);
      autoStartTimeoutRef.current = null;
    }
  };

  // Pause timer
  const pause = () => {
    setState('paused');
  };

  // Reset to current session type
  const reset = () => {
    setState('idle');
    setTimeLeft(getCurrentDuration());
    // Clear any pending auto-start
    if (autoStartTimeoutRef.current) {
      clearTimeout(autoStartTimeoutRef.current);
      autoStartTimeoutRef.current = null;
    }
  };

  // Skip to next session
  const skip = () => {
    completeSession();
  };

  // Handle session completion
  const completeSession = useCallback(() => {
    const newCompletedSessions = completedSessions + 1;
    setCompletedSessions(newCompletedSessions);

    // Play sound if enabled
    if (settings.soundEnabled) {
      if (sessionType === 'work') {
        pomodoroAudio.playSessionComplete();
      } else {
        pomodoroAudio.playBreakComplete();
      }
    }

    // Show notification if enabled
    if (settings.notificationsEnabled) {
      if (sessionType === 'work') {
        const isLongBreak =
          Math.ceil(newCompletedSessions / 2) % settings.sessionsUntilLongBreak === 0;
        const breakType = isLongBreak ? 'long break' : 'short break';
        pomodoroAudio.showNotification(
          'Work Session Complete! 🍅',
          `Time for a ${breakType}. Great job!`,
        );
      } else {
        pomodoroAudio.showNotification('Break Time Over! ⚡', 'Ready to get back to work?');
      }
    }

    // Determine next session type
    let nextSessionType: SessionType;
    if (sessionType === 'work') {
      const workSessionsCompleted = Math.ceil(newCompletedSessions / 2);
      if (workSessionsCompleted % settings.sessionsUntilLongBreak === 0) {
        nextSessionType = 'longBreak';
      } else {
        nextSessionType = 'shortBreak';
      }
    } else {
      nextSessionType = 'work';
    }

    setSessionType(nextSessionType);
    setState('idle');

    // Auto-start next session if enabled
    if (settings.autoStartSessions) {
      autoStartTimeoutRef.current = setTimeout(() => {
        setState('running');
      }, 3000); // 3 second delay
    }
  }, [completedSessions, sessionType, settings]);

  // Timer effect
  useEffect(() => {
    if (state === 'running') {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Session completed
            setTimeout(completeSession, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state, completeSession]);

  // Update timeLeft when session type changes
  useEffect(() => {
    if (state === 'idle') {
      setTimeLeft(getCurrentDuration());
    }
  }, [sessionType, state, settings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoStartTimeoutRef.current) {
        clearTimeout(autoStartTimeoutRef.current);
      }
    };
  }, []);

  // Request notification permission when notifications are enabled
  useEffect(() => {
    if (settings.notificationsEnabled) {
      pomodoroAudio.requestNotificationPermission();
    }
  }, [settings.notificationsEnabled]);

  return {
    // State
    timeLeft,
    state,
    sessionType,
    currentSession,
    totalSessions,
    progress,
    settings,

    // Formatted data
    timeDisplay: formatTime(timeLeft),

    // Actions
    start,
    pause,
    reset,
    skip,
    updateSettings,
  };
}
