/**
 * Time tracking widget (TopBar).
 * Same UI pattern as Pomodoro: compact bar with timer + Start/Stop, expanded panel with details and settings.
 */
import { Play, RotateCcw, Settings, Square, Timer, X } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Heading, Text } from '@/core/ui/Typography';

import type { TopBarWidgetProps } from '../registry';

import { type TimeTrackingSettings, loadSettings, saveSettings } from './timeTrackingSettings';

type TargetType = 'contact' | 'project';

export function TimeTrackingWidget({
  compact = true,
  isExpanded = false,
  onToggle,
  onClose,
}: TopBarWidgetProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [targetType, setTargetType] = useState<TargetType>('contact');
  const [targetId, setTargetId] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<TimeTrackingSettings>(loadSettings());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
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
  }, [isRunning]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = () => setIsRunning(true);
  const handleStop = () => setIsRunning(false);
  const handleReset = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
  };

  const handleSettingsChange = (field: keyof TimeTrackingSettings, value: boolean) => {
    const next = { ...settings, [field]: value };
    setSettings(next);
    saveSettings(next);
  };

  if (!compact) {
    return null;
  }

  const timeDisplay = formatTime(elapsedSeconds);
  const timerButtonColors = isRunning
    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
    : 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-100 dark:border-blue-800/50 text-blue-700 dark:text-blue-300';

  return (
    <div className="flex items-center gap-2 relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className={`flex items-center gap-2 h-9 border transition-colors hover:bg-opacity-75 relative overflow-hidden ${timerButtonColors}`}
        aria-label="Toggle time tracking panel"
        title="Time tracking"
      >
        {settings.compactMode ? (
          <div className="relative z-10 flex items-center">
            <Timer className="w-4 h-4" />
          </div>
        ) : (
          <>
            <Timer className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium tabular-nums min-w-[5ch] text-right">
              {timeDisplay}
            </span>
          </>
        )}
      </Button>

      {!isRunning ? (
        <Button
          onClick={handleStart}
          variant="ghost"
          size="md"
          icon={Play}
          className="!bg-green-50 dark:!bg-green-950/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50"
          aria-label="Start timer"
          title="Start timer"
        />
      ) : (
        <Button
          onClick={handleStop}
          variant="ghost"
          size="md"
          icon={Square}
          className="!bg-orange-50 dark:!bg-orange-950/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50"
          aria-label="Stop timer"
          title="Stop timer"
        />
      )}

      {isExpanded && !showSettings && (
        <div className="absolute top-full right-0 mt-2 w-[320px] min-w-[320px] max-w-[320px] overflow-hidden bg-card border border-border rounded-lg shadow-lg p-4 z-[60] box-border">
          <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
            <div className="flex items-center gap-2 min-w-0 shrink">
              <Timer className="w-5 h-5 shrink-0 text-muted-foreground" />
              <Heading level={3} className="mb-0 truncate">
                Time tracking
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
              {onClose && (
                <Button
                  variant="ghost"
                  size="md"
                  icon={X}
                  onClick={onClose}
                  aria-label="Close panel"
                  title="Close panel"
                />
              )}
            </div>
          </div>

          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-foreground mb-2 tabular-nums">
              {timeDisplay}
            </div>
          </div>

          <div className="flex justify-center gap-2 mb-6">
            {!isRunning ? (
              <Button onClick={handleStart} variant="default" size="sm" icon={Play}>
                Start
              </Button>
            ) : (
              <Button onClick={handleStop} variant="secondary" size="sm" icon={Square}>
                Stop
              </Button>
            )}
            <Button onClick={handleReset} variant="outline" size="sm" icon={RotateCcw}>
              Reset
            </Button>
          </div>

          <div className="space-y-2 border-t border-border pt-4 min-w-0">
            <label className="block text-sm font-medium text-foreground">Target type</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as TargetType)}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground"
            >
              <option value="contact">Contact</option>
              <option value="project">Project</option>
            </select>

            <label className="block text-sm font-medium text-foreground mt-2">
              Target (placeholder)
            </label>
            <input
              type="text"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder={targetType === 'contact' ? 'Contact name or ID' : 'Project name or ID'}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground"
            />
            <Text variant="muted" className="text-xs">
              No persistence yet — skeleton only.
            </Text>
          </div>
        </div>
      )}

      {isExpanded && showSettings && (
        <div className="absolute top-full right-0 mt-2 w-[320px] min-w-[320px] max-w-[320px] overflow-hidden bg-card border border-border rounded-lg shadow-lg p-4 z-[60] box-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-muted-foreground" />
              <Heading level={3} className="mb-0">
                Time tracking Settings
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

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <Text className="text-sm font-medium text-foreground mb-0">Compact Mode</Text>
                <Text variant="muted" className="text-xs">
                  Show icon only in top bar
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
