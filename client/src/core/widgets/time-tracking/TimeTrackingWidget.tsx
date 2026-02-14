/**
 * Time tracking widget skeleton (TopBar).
 * Phase 1: start/stop/reset timer in UI, choose targetType (contact/project) and temporary target;
 * no persistence or API calls yet.
 */
import { Play, Square, RotateCcw, Timer } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/core/ui/Typography';

import type { TopBarWidgetProps } from '../registry';

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  if (!compact) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="h-9 flex items-center gap-2"
        aria-label="Toggle time tracking"
        title="Time tracking"
      >
        <Timer className="w-4 h-4" />
        <span className="text-sm font-medium">{formatTime(elapsedSeconds)}</span>
      </Button>

      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-[60]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-muted-foreground" />
              <Heading level={3} className="mb-0">
                Time tracking
              </Heading>
            </div>
            {onClose && (
              <Button variant="ghost" size="md" onClick={onClose} aria-label="Close panel">
                ×
              </Button>
            )}
          </div>

          <div className="text-center mb-4">
            <Text className="text-2xl font-bold text-foreground">{formatTime(elapsedSeconds)}</Text>
          </div>

          <div className="flex justify-center gap-2 mb-4">
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

          <div className="space-y-2 border-t border-border pt-4">
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
    </div>
  );
}
