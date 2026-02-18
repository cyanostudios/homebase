/**
 * Time tracking widget (TopBar).
 * Same UI pattern as Pomodoro: compact bar with timer + Start/Stop, expanded panel with details and settings.
 * Supports adding stopped time (or manual time) to a contact.
 */
import {
  Calendar as CalendarIcon,
  Play,
  RotateCcw,
  Settings,
  Square,
  Timer,
  X,
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/core/api/AppContext';
import { Heading, Text } from '@/core/ui/Typography';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import type { TopBarWidgetProps } from '../registry';

import { type TimeTrackingSettings, loadSettings, saveSettings } from './timeTrackingSettings';

export function TimeTrackingWidget({
  compact = true,
  isExpanded = false,
  onToggle,
  onClose,
}: TopBarWidgetProps) {
  const { contacts } = useApp();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<TimeTrackingSettings>(loadSettings());
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [manualMinutes, setManualMinutes] = useState<string>('');
  const [manualDate, setManualDate] = useState<Date>(() => new Date());
  const [manualDateOpen, setManualDateOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
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

  const handleAddToContact = async () => {
    if (!selectedContactId) {
      return;
    }
    const isManual = useManualEntry;
    const minutes = parseInt(manualMinutes, 10);
    if (isManual && (Number.isNaN(minutes) || minutes <= 0)) {
      return;
    }
    if (!isManual && elapsedSeconds <= 0) {
      return;
    }
    setAddError(null);
    setAdding(true);
    try {
      const seconds = isManual ? minutes * 60 : elapsedSeconds;
      const loggedAt = isManual ? manualDate.toISOString() : new Date().toISOString();
      const res = await fetch(`/api/contacts/${selectedContactId}/time-entries`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds, loggedAt }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add time');
      }
      if (!isManual) {
        setElapsedSeconds(0);
      } else {
        setManualMinutes('');
        setManualDate(new Date());
      }
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add time');
    } finally {
      setAdding(false);
    }
  };

  const canAdd =
    selectedContactId &&
    (useManualEntry
      ? manualMinutes.trim() !== '' && parseInt(manualMinutes, 10) > 0
      : elapsedSeconds > 0);
  const isAdding = adding;

  if (!compact) {
    return null;
  }

  const timeDisplay = formatTime(elapsedSeconds);
  const timerButtonColors = isRunning
    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
    : 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-100 dark:border-blue-800/50 text-blue-700 dark:text-blue-300';

  const panelContent = !showSettings ? (
    <>
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
        <div className="text-4xl font-bold text-foreground mb-2 tabular-nums">{timeDisplay}</div>
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

      <div className="space-y-3 border-t border-border pt-4 min-w-0">
        <div className="flex items-center justify-between">
          <Text className="text-sm font-medium text-foreground">Add time manually</Text>
          <Switch
            checked={useManualEntry}
            onCheckedChange={setUseManualEntry}
            aria-label="Add time manually"
          />
        </div>
        {useManualEntry && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="sr-only">Minutes</label>
              <input
                type="number"
                min={1}
                placeholder="Min"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background"
              />
            </div>
            <div>
              <Popover open={manualDateOpen} onOpenChange={setManualDateOpen}>
                <PopoverAnchor asChild>
                  <button
                    type="button"
                    className={cn(
                      'w-full h-8 flex items-center justify-between rounded-md border border-border bg-background px-2 text-[10px] font-medium',
                      'transition-colors hover:bg-accent/50 cursor-pointer',
                    )}
                  >
                    <span>{manualDate.toLocaleDateString()}</span>
                    <CalendarIcon className="w-3 h-3 text-muted-foreground opacity-50" />
                  </button>
                </PopoverAnchor>
                <PopoverContent align="end" className="w-auto p-0">
                  <DayPicker
                    mode="single"
                    selected={manualDate}
                    onSelect={(date) => {
                      if (date) {
                        setManualDate(date);
                        setManualDateOpen(false);
                      }
                    }}
                    weekStartsOn={1}
                  />
                  <div className="p-2 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => {
                        setManualDate(new Date());
                        setManualDateOpen(false);
                      }}
                    >
                      Today
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Contact</label>
          <Select
            value={selectedContactId || 'none'}
            onValueChange={(v) => setSelectedContactId(v === 'none' ? '' : v)}
          >
            <SelectTrigger className="w-full h-8 text-sm border-border/50 bg-background">
              <SelectValue placeholder="Select contact" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[200px]">
              <SelectItem value="none" className="text-muted-foreground">
                Select contact
              </SelectItem>
              {contacts.map((c: { id: string; companyName?: string }) => (
                <SelectItem key={c.id} value={String(c.id)} className="text-sm">
                  {c.companyName || formatDisplayNumber('contacts', c.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleAddToContact}
          disabled={!canAdd || isAdding}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          {isAdding ? 'Adding…' : 'Add time to contact'}
        </Button>
        {addError && (
          <Text variant="muted" className="text-xs text-destructive">
            {addError}
          </Text>
        )}
      </div>
    </>
  ) : (
    <>
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
    </>
  );

  return (
    <Popover
      open={isExpanded}
      onOpenChange={(open) => {
        if (open) onToggle?.();
        else onClose?.();
      }}
    >
      <div className="flex items-center gap-2">
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-2 h-9 border transition-colors hover:bg-opacity-75 relative overflow-hidden rounded-lg px-3',
              timerButtonColors,
            )}
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
          </button>
        </PopoverTrigger>
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
      </div>
      <PopoverContent
        side="bottom"
        align="end"
        className="bg-card border-border p-4 w-[320px] min-w-[320px] max-w-[320px] box-border"
      >
        {panelContent}
      </PopoverContent>
    </Popover>
  );
}
