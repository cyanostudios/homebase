import { Play, Pause, RotateCcw, SkipForward, Timer, X, Settings } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '../Button';
import { Heading, Text } from '../Typography';

import { pomodoroAudio } from './pomodoroAudio';
import { PomodoroSettings } from './pomodoroSettings';
import { usePomodoroTimer } from './usePomodoroTimer';

interface PomodoroTimerProps {
  compact?: boolean;
  isExpanded?: boolean; // extern kontroll (valfritt)
  onToggle?: () => void; // extern toggler (valfritt)
  onClose?: () => void; // extern stäng (valfritt)
}

export function PomodoroTimer({
  compact = true,
  isExpanded = false,
  onToggle,
  onClose,
}: PomodoroTimerProps) {
  // Intern expanded-state om ingen extern styrning används
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Använd extern state om onToggle finns, annars intern
  const expanded = onToggle ? isExpanded : internalExpanded;
  const handleToggle = onToggle || (() => setInternalExpanded((v) => !v));
  const handleClose = onClose || (() => setInternalExpanded(false));

  const {
    timeDisplay,
    state,
    sessionType,
    currentSession,
    totalSessions,
    progress,
    settings,
    start,
    pause,
    reset,
    skip,
    updateSettings,
  } = usePomodoroTimer();

  const getSessionColor = () => {
    switch (sessionType) {
      case 'work':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-600',
          ring: 'ring-red-300',
        };
      case 'shortBreak':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-600',
          ring: 'ring-green-300',
        };
      case 'longBreak':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-600',
          ring: 'ring-blue-300',
        };
    }
  };

  const getSessionLabel = () => {
    switch (sessionType) {
      case 'work':
        return 'Work';
      case 'shortBreak':
        return 'Short Break';
      case 'longBreak':
        return 'Long Break';
    }
  };

  const getProgressColor = () => {
    switch (sessionType) {
      case 'work':
        return 'stroke-red-500';
      case 'shortBreak':
        return 'stroke-green-500';
      case 'longBreak':
        return 'stroke-blue-500';
    }
  };

  const handleSettingsChange = (field: keyof PomodoroSettings, value: any) => {
    const newSettings = { ...settings, [field]: value };
    updateSettings(newSettings);
  };

  const handleNotificationsToggle = async () => {
    if (!settings.notificationsEnabled) {
      const granted = await pomodoroAudio.requestNotificationPermission();
      if (granted) {
        handleSettingsChange('notificationsEnabled', true);
      }
    } else {
      handleSettingsChange('notificationsEnabled', false);
    }
  };

  const colors = getSessionColor();

  const getTimerButtonColor = () => {
    if (sessionType === 'work' && state === 'running') {
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-600',
      };
    }
    return colors!;
  };

  const timerButtonColors = getTimerButtonColor();

  // Compact view för TopBar – visas när compact=true
  if (compact) {
    return (
      <div className="flex items-center gap-2 relative">
        <button
          onClick={handleToggle}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors hover:bg-opacity-75 relative overflow-hidden ${timerButtonColors.bg} ${timerButtonColors.border} ${timerButtonColors.text}`}
          aria-label="Toggle Pomodoro panel"
          title="Toggle Pomodoro panel"
        >
          {settings.compactMode ? (
            <>
              {/* Progress bakgrund */}
              <div className="absolute inset-0 bg-gray-100" />
              {/* Progress fyllning */}
              <div
                className={`absolute inset-0 transition-all duration-1000 ${
                  sessionType === 'work'
                    ? 'bg-red-200'
                    : sessionType === 'shortBreak'
                      ? 'bg-green-200'
                      : 'bg-blue-200'
                }`}
                style={{ width: `${progress}%` }}
              />
              {/* Endast ikon */}
              <div className="relative z-10 flex items-center">
                <Timer className="w-4 h-4" />
              </div>
            </>
          ) : (
            <>
              <Timer className="w-4 h-4" />
              <span className="text-sm font-medium">{timeDisplay}</span>
            </>
          )}
        </button>

        {/* Snabbknappar */}
        {state === 'idle' || state === 'paused' ? (
          <Button
            onClick={start}
            variant="ghost"
            size="md"
            icon={Play}
            className="!bg-blue-50 text-blue-600 hover:bg-blue-100"
            aria-label="Start timer"
            title="Start timer"
          />
        ) : (
          <Button
            onClick={pause}
            variant="ghost"
            size="md"
            icon={Pause}
            className="!bg-orange-50 text-orange-600 hover:bg-orange-100"
            aria-label="Pause timer"
            title="Pause timer"
          />
        )}

        {/* Expanded panel */}
        {expanded && !showSettings && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-gray-600" />
                <Heading level={3} className="mb-0">
                  Pomodoro Timer
                </Heading>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => setShowSettings(true)}
                  variant="ghost"
                  size="md"
                  icon={Settings}
                  aria-label="Open settings"
                  title="Open settings"
                />
                <Button
                  onClick={handleClose}
                  variant="ghost"
                  size="md"
                  icon={X}
                  aria-label="Close panel"
                  title="Close panel"
                />
              </div>
            </div>

            {/* Session info */}
            <div className="text-center mb-4">
              <div
                className={`inline-block px-3 py-1 rounded-full border text-sm font-medium ${colors!.bg} ${colors!.border} ${colors!.text}`}
              >
                {getSessionLabel()}
              </div>
              <Text variant="muted" className="mt-1 text-center">
                Session {currentSession} of {totalSessions}
              </Text>
            </div>

            {/* Timer med ring */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <svg width="120" height="120" className="transform -rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-gray-200"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 54}`}
                    strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
                    className={`transition-all duration-1000 ${getProgressColor()}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Text className="text-2xl font-bold text-gray-900 mb-0">{timeDisplay}</Text>
                </div>
              </div>
            </div>

            {/* Kontroller */}
            <div className="flex justify-center gap-2">
              {state === 'idle' || state === 'paused' ? (
                <Button
                  onClick={start}
                  variant="primary"
                  size="sm"
                  icon={Play}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  Start
                </Button>
              ) : (
                <Button
                  onClick={pause}
                  variant="primary"
                  size="sm"
                  icon={Pause}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  Pause
                </Button>
              )}

              <Button
                onClick={reset}
                variant="primary"
                size="sm"
                icon={RotateCcw}
                className="bg-gray-500 hover:bg-gray-600"
              >
                Reset
              </Button>

              <Button
                onClick={skip}
                variant="primary"
                size="sm"
                icon={SkipForward}
                className="bg-green-500 hover:bg-green-600"
              >
                Skip
              </Button>
            </div>
          </div>
        )}

        {/* Settings-panel i compact-läge */}
        {expanded && showSettings && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-600" />
                <Heading level={3} className="mb-0">
                  Pomodoro Settings
                </Heading>
              </div>
              <Button
                onClick={() => setShowSettings(false)}
                variant="ghost"
                size="md"
                icon={X}
                aria-label="Close settings"
                title="Close settings"
              />
            </div>

            {/* Duration Settings */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={settings.workDuration}
                  onChange={(e) =>
                    handleSettingsChange('workDuration', parseInt(e.target.value) || 25)
                  }
                  className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Short Break (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.shortBreakDuration}
                  onChange={(e) =>
                    handleSettingsChange('shortBreakDuration', parseInt(e.target.value) || 5)
                  }
                  className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Long Break (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.longBreakDuration}
                  onChange={(e) =>
                    handleSettingsChange('longBreakDuration', parseInt(e.target.value) || 15)
                  }
                  className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sessions until Long Break
                </label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={settings.sessionsUntilLongBreak}
                  onChange={(e) =>
                    handleSettingsChange('sessionsUntilLongBreak', parseInt(e.target.value) || 4)
                  }
                  className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Feature Settings */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-sm font-medium text-gray-700 mb-0">
                    Sound Notifications
                  </Text>
                  <Text variant="muted" className="text-xs">
                    Play sound when sessions complete
                  </Text>
                </div>
                <button
                  onClick={() => handleSettingsChange('soundEnabled', !settings.soundEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.soundEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  aria-label="Toggle sound notifications"
                  title="Toggle sound notifications"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-sm font-medium text-gray-700 mb-0">
                    Browser Notifications
                  </Text>
                  <Text variant="muted" className="text-xs">
                    Show desktop notifications
                  </Text>
                </div>
                <button
                  onClick={handleNotificationsToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.notificationsEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  aria-label="Toggle browser notifications"
                  title="Toggle browser notifications"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-sm font-medium text-gray-700 mb-0">
                    Auto-start Sessions
                  </Text>
                  <Text variant="muted" className="text-xs">
                    Automatically start next session
                  </Text>
                </div>
                <button
                  onClick={() =>
                    handleSettingsChange('autoStartSessions', !settings.autoStartSessions)
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.autoStartSessions ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  aria-label="Toggle auto-start sessions"
                  title="Toggle auto-start sessions"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.autoStartSessions ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-sm font-medium text-gray-700 mb-0">Compact Mode</Text>
                  <Text variant="muted" className="text-xs">
                    Show icon with progress bar only
                  </Text>
                </div>
                <button
                  onClick={() => handleSettingsChange('compactMode', !settings.compactMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.compactMode ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  aria-label="Toggle compact mode"
                  title="Toggle compact mode"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.compactMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <Button
              onClick={() => setShowSettings(false)}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              Back to Timer
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Full/expanded vy utanför compact-läget
  if (showSettings) {
    return (
      <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <Heading level={3} className="mb-0">
              Pomodoro Settings
            </Heading>
          </div>
          <Button
            onClick={() => setShowSettings(false)}
            variant="ghost"
            size="md"
            icon={X}
            aria-label="Close settings"
            title="Close settings"
          />
        </div>

        {/* Duration settings */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Work Duration (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={settings.workDuration}
              onChange={(e) => handleSettingsChange('workDuration', parseInt(e.target.value) || 25)}
              className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Short Break (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={settings.shortBreakDuration}
              onChange={(e) =>
                handleSettingsChange('shortBreakDuration', parseInt(e.target.value) || 5)
              }
              className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Long Break (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={settings.longBreakDuration}
              onChange={(e) =>
                handleSettingsChange('longBreakDuration', parseInt(e.target.value) || 15)
              }
              className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sessions until Long Break
            </label>
            <input
              type="number"
              min="2"
              max="10"
              value={settings.sessionsUntilLongBreak}
              onChange={(e) =>
                handleSettingsChange('sessionsUntilLongBreak', parseInt(e.target.value) || 4)
              }
              className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Back */}
        <Button
          onClick={() => setShowSettings(false)}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          Back to Timer
        </Button>
      </div>
    );
  }

  // Expanded vy (timer)
  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-gray-600" />
          <Heading level={3} className="mb-0">
            Pomodoro Timer
          </Heading>
        </div>
        <div className="flex items-center gap-1">
          <Button
            onClick={() => setShowSettings(true)}
            variant="ghost"
            size="md"
            icon={Settings}
            aria-label="Open settings"
            title="Open settings"
          />
          <Button
            onClick={handleClose}
            variant="ghost"
            size="md"
            icon={X}
            aria-label="Close panel"
            title="Close panel"
          />
        </div>
      </div>

      {/* Session info */}
      <div className="text-center mb-4">
        <div
          className={`inline-block px-3 py-1 rounded-full border text-sm font-medium ${colors!.bg} ${colors!.border} ${colors!.text}`}
        >
          {getSessionLabel()}
        </div>
        <Text variant="muted" className="mt-1 text-center">
          Session {currentSession} of {totalSessions}
        </Text>
      </div>

      {/* Timer + progress ring */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <svg width="120" height="120" className="transform -rotate-90">
            <circle
              cx="60"
              cy="60"
              r="54"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              className="text-gray-200"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 54}`}
              strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
              className={`transition-all duration-1000 ${getProgressColor()}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Text className="text-2xl font-bold text-gray-900 mb-0">{timeDisplay}</Text>
          </div>
        </div>
      </div>

      {/* Kontroller */}
      <div className="flex justify-center gap-2">
        {state === 'idle' || state === 'paused' ? (
          <Button
            onClick={start}
            variant="primary"
            size="sm"
            icon={Play}
            className="bg-blue-500 hover:bg-blue-600"
          >
            Start
          </Button>
        ) : (
          <Button
            onClick={pause}
            variant="primary"
            size="sm"
            icon={Pause}
            className="bg-orange-500 hover:bg-orange-600"
          >
            Pause
          </Button>
        )}

        <Button
          onClick={reset}
          variant="primary"
          size="sm"
          icon={RotateCcw}
          className="bg-gray-500 hover:bg-gray-600"
        >
          Reset
        </Button>

        <Button
          onClick={skip}
          variant="primary"
          size="sm"
          icon={SkipForward}
          className="bg-green-500 hover:bg-green-600"
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
