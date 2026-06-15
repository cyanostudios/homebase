import { Play, Pause, RotateCcw, SkipForward, X, Settings } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Heading, Text } from '@/core/ui/Typography';
import { cn } from '@/lib/utils';

import { pomodoroAudio } from './pomodoroAudio';
import { PomodoroSettings } from './pomodoroSettings';
import { TomatoIcon } from './TomatoIcon';
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

  useEffect(() => {
    return () => {
      pomodoroAudio.close();
    };
  }, []);

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

  const handlePillToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    handleToggle();
  };

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === 'running') {
      pause();
    } else {
      start();
    }
  };

  // Compact view för TopBar – samma pill-mönster som Time tracking (ikon + tid + play/pause)
  if (compact) {
    return (
      <div className="relative flex items-center">
        <div
          role="button"
          tabIndex={0}
          onClick={handlePillToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggle();
            }
          }}
          aria-label="Toggle Pomodoro panel"
          title="Pomodoro"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-slate-700 transition-colors hover:bg-slate-200 dark:bg-muted dark:text-slate-200 dark:hover:bg-muted/70"
        >
          <TomatoIcon className="h-3.5 w-3.5" />
          {!settings.compactMode && (
            <span className="min-w-[5ch] text-center text-xs font-medium tabular-nums">
              {timeDisplay}
            </span>
          )}
          <button
            type="button"
            onClick={handlePlayPause}
            aria-label={state === 'running' ? 'Pause timer' : 'Start timer'}
            title={state === 'running' ? 'Pause timer' : 'Start timer'}
            className={cn(
              'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors',
              state === 'running'
                ? 'text-orange-500 hover:text-orange-600 dark:text-orange-400'
                : 'text-emerald-500 hover:text-emerald-600 dark:text-emerald-400',
            )}
          >
            {state === 'running' ? (
              <Pause className="h-3 w-3" strokeWidth={2.5} />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )}
          </button>
        </div>

        {/* Expanded panel */}
        {expanded && !showSettings && (
          <div className="absolute top-full right-0 mt-2 w-[320px] min-w-[320px] max-w-[320px] overflow-hidden bg-card border border-border rounded-lg shadow-lg p-4 z-[60] box-border">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
              <div className="flex items-center gap-2 min-w-0 shrink">
                <TomatoIcon className="h-5 w-5" />
                <Heading level={3} className="mb-0 truncate">
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
                  <span className="text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
                    {timeDisplay}
                  </span>
                </div>
              </div>
            </div>

            {/* Kontroller — samma variant-mönster som Time tracking */}
            <div className="flex flex-wrap justify-center gap-2">
              {state === 'idle' || state === 'paused' ? (
                <Button onClick={start} variant="default" size="sm" icon={Play}>
                  Start
                </Button>
              ) : (
                <Button onClick={pause} variant="secondary" size="sm" icon={Pause}>
                  Pause
                </Button>
              )}

              <Button onClick={reset} variant="outline" size="sm" icon={RotateCcw}>
                Reset
              </Button>

              <Button onClick={skip} variant="outline" size="sm" icon={SkipForward}>
                Skip
              </Button>
            </div>
          </div>
        )}

        {/* Settings-panel i compact-läge */}
        {expanded && showSettings && (
          <div className="absolute top-full right-0 mt-2 w-[320px] min-w-[320px] max-w-[320px] overflow-hidden bg-card border border-border rounded-lg shadow-lg p-4 z-[60] box-border">
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

            {/* Duration Settings */}
            <div className="space-y-3 mb-6">
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
                  className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* Feature Settings */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-sm font-medium text-foreground mb-0">
                    Sound Notifications
                  </Text>
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
                      if (granted) {
                        handleSettingsChange('notificationsEnabled', true);
                      }
                    } else {
                      handleSettingsChange('notificationsEnabled', false);
                    }
                  }}
                  aria-label="Toggle browser notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-sm font-medium text-foreground mb-0">
                    Auto-start Sessions
                  </Text>
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
          </div>
        )}
      </div>
    );
  }

  // Full/expanded vy utanför compact-läget
  if (showSettings) {
    return (
      <div className="absolute top-full right-0 mt-2 w-[320px] min-w-[320px] max-w-[320px] overflow-hidden bg-card border border-border rounded-lg shadow-lg p-4 z-50 box-border">
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
        <div className="space-y-3 mb-6">
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
              className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    <div className="absolute top-full right-0 mt-2 w-[320px] min-w-[320px] max-w-[320px] overflow-hidden bg-card border border-border rounded-lg shadow-lg p-4 z-50 box-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TomatoIcon className="h-5 w-5" />
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
            <span className="text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
              {timeDisplay}
            </span>
          </div>
        </div>
      </div>

      {/* Kontroller */}
      <div className="flex flex-wrap justify-center gap-2">
        {state === 'idle' || state === 'paused' ? (
          <Button onClick={start} variant="default" size="sm" icon={Play}>
            Start
          </Button>
        ) : (
          <Button onClick={pause} variant="secondary" size="sm" icon={Pause}>
            Pause
          </Button>
        )}

        <Button onClick={reset} variant="outline" size="sm" icon={RotateCcw}>
          Reset
        </Button>

        <Button onClick={skip} variant="outline" size="sm" icon={SkipForward}>
          Skip
        </Button>
      </div>
    </div>
  );
}
