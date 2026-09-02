import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import React from 'react';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Switch } from '@/components/ui/switch';
import { usePomodoro } from '@/core/ui/rightSidebar/PomodoroContext';
import { Text } from '@/core/ui/Typography';
import { pomodoroAudio } from '@/core/widgets/pomodoro/pomodoroAudio';
import type { PomodoroSettings } from '@/core/widgets/pomodoro/pomodoroSettings';
import { cn } from '@/lib/utils';

const DURATION_FIELDS = [
  ['workDuration', 'Work (min)', 1, 120],
  ['shortBreakDuration', 'Short break (min)', 1, 30],
  ['longBreakDuration', 'Long break (min)', 1, 60],
  ['sessionsUntilLongBreak', 'Sessions to long break', 2, 10],
] as const;

const RESET_BUTTON_CLASS =
  'border-none bg-amber-600 text-white hover:bg-amber-700 hover:text-white dark:bg-amber-600 dark:hover:bg-amber-700';

export function PomodoroPanel() {
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
  } = usePomodoro();

  const handleSettingsChange = (
    field: keyof PomodoroSettings,
    value: PomodoroSettings[keyof PomodoroSettings],
  ) => {
    updateSettings({ ...settings, [field]: value });
  };

  const sessionMeta = (() => {
    switch (sessionType) {
      case 'work':
        return {
          label: 'Work',
          badge: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
          stroke: 'stroke-red-500 dark:stroke-red-400',
        };
      case 'shortBreak':
        return {
          label: 'Short Break',
          badge: 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400',
          stroke: 'stroke-green-500 dark:stroke-green-400',
        };
      case 'longBreak':
        return {
          label: 'Long Break',
          badge: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
          stroke: 'stroke-blue-500 dark:stroke-blue-400',
        };
    }
  })();

  return (
    <div className="space-y-4">
      <div className="text-center">
        <span
          className={cn(
            'inline-block rounded-full px-3 py-1 text-xs font-semibold',
            sessionMeta.badge,
          )}
        >
          {sessionMeta.label}
        </span>
        <Text variant="muted" className="mt-1 text-center">
          Session {currentSession} of {totalSessions}
        </Text>
      </div>

      <div className="flex justify-center">
        <div className="relative">
          <svg width="120" height="120" className="-rotate-90 transform">
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
              className={cn('transition-all duration-1000', sessionMeta.stroke)}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold tabular-nums text-foreground">{timeDisplay}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {state === 'idle' || state === 'paused' ? (
          <RoundIconLabelButton
            icon={Play}
            label="Start"
            variant="success"
            size="xs"
            alwaysExpanded
            onClick={start}
          />
        ) : (
          <RoundIconLabelButton
            icon={Pause}
            label="Pause"
            variant="success"
            size="xs"
            alwaysExpanded
            onClick={pause}
          />
        )}
        <RoundIconLabelButton
          icon={RotateCcw}
          label="Reset"
          variant="secondary"
          size="xs"
          alwaysExpanded
          className={RESET_BUTTON_CLASS}
          onClick={reset}
        />
        <RoundIconLabelButton
          icon={SkipForward}
          label="Skip"
          variant="secondary"
          size="xs"
          alwaysExpanded
          onClick={skip}
        />
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Settings
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DURATION_FIELDS.map(([field, label, min, max]) => (
            <div key={field}>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                {label}
              </label>
              <input
                type="number"
                min={min}
                max={max}
                value={settings[field]}
                onChange={(e) =>
                  handleSettingsChange(field, parseInt(e.target.value, 10) || settings[field])
                }
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ))}
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <Text className="text-sm font-medium">Sound</Text>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => handleSettingsChange('soundEnabled', checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Text className="text-sm font-medium">Notifications</Text>
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
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Text className="text-sm font-medium">Auto-start</Text>
            <Switch
              checked={settings.autoStartSessions}
              onCheckedChange={(checked) => handleSettingsChange('autoStartSessions', checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
