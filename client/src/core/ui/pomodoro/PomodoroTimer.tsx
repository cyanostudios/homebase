import { Play, Pause, RotateCcw, SkipForward, Timer, X, Settings } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
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
          bg: 'bg-red-50 dark:bg-red-950/30',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-600 dark:text-red-400',
          ring: 'ring-red-300 dark:ring-red-700',
        };
      case 'shortBreak':
        return {
          bg: 'bg-green-50 dark:bg-green-950/30',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-600 dark:text-green-400',
          ring: 'ring-green-300 dark:ring-green-700',
        };
      case 'longBreak':
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/30',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-600 dark:text-blue-400',
          ring: 'ring-blue-300 dark:ring-blue-700',
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
        return 'stroke-red-500 dark:stroke-red-400';
      case 'shortBreak':
        return 'stroke-green-500 dark:stroke-green-400';
      case 'longBreak':
        return 'stroke-blue-500 dark:stroke-blue-400';
    }
  };

  const handleSettingsChange = (field: keyof PomodoroSettings, value: any) => {
    const newSettings = { ...settings, [field]: value };
    updateSettings(newSettings);
  };

  const colors = getSessionColor();

  const getTimerButtonColor = () => {
    if (sessionType === 'work' && state === 'running') {
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-600 dark:text-blue-400',
      };
    }
    return colors!;
  };

  const timerButtonColors = getTimerButtonColor();

  // Compact view för TopBar – panelen visas i Popover (portalas, stängs vid klick utanför)
  if (compact) {
    const panelContent = !showSettings ? (
      <>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-muted-foreground" />
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
                className="text-muted"
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
              <Text className="text-2xl font-bold text-foreground mb-0">{timeDisplay}</Text>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-2">
          {state === 'idle' || state === 'paused' ? (
            <Button onClick={start} variant="primary" size="sm" icon={Play}>
              Start
            </Button>
          ) : (
            <Button onClick={pause} variant="primary" size="sm" icon={Pause}>
              Pause
            </Button>
          )}
          <Button onClick={reset} variant="secondary" size="sm" icon={RotateCcw}>
            Reset
          </Button>
          <Button onClick={skip} variant="secondary" size="sm" icon={SkipForward}>
            Skip
          </Button>
        </div>
      </>
    ) : (
      <>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
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
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
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
              className="w-full h-10 px-3 text-base border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
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
              className="w-full h-10 px-3 text-base border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
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
              className="w-full h-10 px-3 text-base border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
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
              className="w-full h-10 px-3 text-base border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
            />
          </div>
        </div>
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-foreground mb-0">Sound Notifications</Text>
              <Text variant="muted" className="text-xs">
                Play sound when sessions complete
              </Text>
            </div>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => handleSettingsChange('soundEnabled', checked)}
              aria-label="Toggle sound notifications"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-foreground mb-0">
                Browser Notifications
              </Text>
              <Text variant="muted" className="text-xs">
                Show desktop notifications
              </Text>
            </div>
            <Switch
              checked={settings.notificationsEnabled}
              onCheckedChange={async (checked) => {
                if (checked) {
                  const granted = await pomodoroAudio.requestNotificationPermission();
                  if (granted) handleSettingsChange('notificationsEnabled', true);
                } else {
                  handleSettingsChange('notificationsEnabled', false);
                }
              }}
              aria-label="Toggle browser notifications"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-foreground mb-0">Auto-start Sessions</Text>
              <Text variant="muted" className="text-xs">
                Automatically start next session
              </Text>
            </div>
            <Switch
              checked={settings.autoStartSessions}
              onCheckedChange={(checked) => handleSettingsChange('autoStartSessions', checked)}
              aria-label="Toggle auto-start sessions"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-foreground mb-0">Compact Mode</Text>
              <Text variant="muted" className="text-xs">
                Show icon with progress bar only
              </Text>
            </div>
            <Switch
              checked={settings.compactMode}
              onCheckedChange={(checked) => handleSettingsChange('compactMode', checked)}
              aria-label="Toggle compact mode"
            />
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
      </>
    );

    return (
      <Popover
        open={expanded}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <PopoverAnchor asChild>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors hover:bg-opacity-75 relative overflow-hidden ${timerButtonColors.bg} ${timerButtonColors.border} ${timerButtonColors.text}`}
              aria-label="Toggle Pomodoro panel"
              title="Toggle Pomodoro panel"
            >
              {settings.compactMode ? (
                <>
                  <div className="absolute inset-0 bg-muted" />
                  <div
                    className={`absolute inset-0 transition-all duration-1000 ${
                      sessionType === 'work'
                        ? 'bg-red-200 dark:bg-red-800'
                        : sessionType === 'shortBreak'
                          ? 'bg-green-200 dark:bg-green-800'
                          : 'bg-blue-200 dark:bg-blue-800'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
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
            {state === 'idle' || state === 'paused' ? (
              <Button
                onClick={start}
                variant="ghost"
                size="md"
                icon={Play}
                className="!bg-blue-50 dark:!bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                aria-label="Start timer"
                title="Start timer"
              />
            ) : (
              <Button
                onClick={pause}
                variant="ghost"
                size="md"
                icon={Pause}
                className="!bg-orange-50 dark:!bg-orange-950/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50"
                aria-label="Pause timer"
                title="Pause timer"
              />
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent side="bottom" align="end" className="bg-card border-border p-4">
          {panelContent}
        </PopoverContent>
      </Popover>
    );
  }

  // Full/expanded vy utanför compact-läget
  if (showSettings) {
    return (
      <div className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-50">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
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
            <label className="block text-sm font-medium text-foreground mb-1">
              Work Duration (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={settings.workDuration}
              onChange={(e) => handleSettingsChange('workDuration', parseInt(e.target.value) || 25)}
              className="w-full h-10 px-3 text-base border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
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
              className="w-full h-10 px-3 text-base border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
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
              className="w-full h-10 px-3 text-base border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
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
              className="w-full h-10 px-3 text-base border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
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
    <div className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-muted-foreground" />
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
              className="text-muted"
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
            <Text className="text-2xl font-bold text-foreground mb-0">{timeDisplay}</Text>
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
          >
            Start
          </Button>
        ) : (
          <Button
            onClick={pause}
            variant="primary"
            size="sm"
            icon={Pause}
          >
            Pause
          </Button>
        )}

        <Button
          onClick={reset}
          variant="secondary"
          size="sm"
          icon={RotateCcw}
        >
          Reset
        </Button>

        <Button
          onClick={skip}
          variant="secondary"
          size="sm"
          icon={SkipForward}
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
