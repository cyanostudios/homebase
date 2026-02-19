import { Clock, Settings, X } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

import { Heading, Text } from '../Typography';

import { ClockSettings, COMMON_TIMEZONES } from './clockSettings';
import { useClock } from './useClock';

interface ClockDisplayProps {
  compact?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

export function ClockDisplay({
  compact = false,
  isExpanded = false,
  onToggle,
  onClose,
}: ClockDisplayProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { formattedTime, formattedDate, settings, updateSettings } = useClock();

  // Handle functions - defined BEFORE they are used
  const expanded = onToggle ? isExpanded : internalExpanded;
  const handleToggle = onToggle || (() => setInternalExpanded(!internalExpanded));
  const handleClose = onClose || (() => setInternalExpanded(false));

  const handleSettingsChange = (field: keyof ClockSettings, value: any) => {
    const newSettings = { ...settings, [field]: value };
    updateSettings(newSettings);
  };

  // Compact view for TopBar - always show when compact=true
  if (compact) {
    return (
      <div className="flex items-center gap-2 relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="h-auto px-2 py-1 flex flex-col items-end gap-0 transition-colors"
        >
          {settings.showClock ? (
            <>
              <div className="text-sm font-medium text-foreground tabular-nums min-w-[11ch] text-right">
                {formattedTime}
              </div>
              {settings.showDate && (
                <div className="text-xs text-muted-foreground tabular-nums min-w-[9ch] text-right">
                  {formattedDate}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center p-1">
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </Button>

        {/* Expanded/Settings panels */}
        {expanded && !showSettings && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-[60]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <Heading level={3} className="mb-0">
                  Clock
                </Heading>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => setShowSettings(true)}
                  variant="ghost"
                  size="md"
                  icon={Settings}
                ></Button>
                <Button onClick={handleClose} variant="ghost" size="md" icon={X}></Button>
              </div>
            </div>

            {/* Clock Display */}
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-foreground mb-2">{formattedTime}</div>
              {settings.showDate && (
                <div className="text-lg text-muted-foreground">{formattedDate}</div>
              )}
              <Text variant="muted" className="text-xs mt-2">
                {settings.timezone}
              </Text>
            </div>

            {/* Quick Settings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-t border-border">
                <Text className="text-sm text-foreground mb-0">Format:</Text>
                <Text className="text-sm font-medium text-foreground mb-0">
                  {settings.timeFormat === '24h' ? '24 Hour' : '12 Hour'}
                </Text>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-border">
                <Text className="text-sm text-foreground mb-0">Date Format:</Text>
                <Text className="text-sm font-medium text-foreground mb-0">
                  {settings.dateFormat === 'sv-SE'
                    ? 'Swedish'
                    : settings.dateFormat === 'en-US'
                      ? 'English'
                      : settings.dateFormat === 'ISO'
                        ? 'ISO'
                        : 'Compact'}
                </Text>
              </div>
            </div>
          </div>
        )}

        {/* Settings panel */}
        {expanded && showSettings && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-[60]">
            {/* Settings Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-muted-foreground" />
                <Heading level={3} className="mb-0">
                  Clock Settings
                </Heading>
              </div>
              <Button
                onClick={() => setShowSettings(false)}
                variant="ghost"
                size="md"
                icon={X}
              ></Button>
            </div>

            {/* Time Format */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Time Format
                </label>
                <div className="flex gap-2">
                  <Button
                    variant={settings.timeFormat === '24h' ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => handleSettingsChange('timeFormat', '24h')}
                    className="flex-1"
                  >
                    24 Hour
                  </Button>
                  <Button
                    variant={settings.timeFormat === '12h' ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => handleSettingsChange('timeFormat', '12h')}
                    className="flex-1"
                  >
                    12 Hour
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Date Format
                </label>
                <select
                  value={settings.dateFormat}
                  onChange={(e) => handleSettingsChange('dateFormat', e.target.value)}
                  className="w-full px-3 py-1.5 text-base border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
                >
                  <option value="sv-SE">Swedish (måndag 22 juli 2025)</option>
                  <option value="en-US">English (Monday, July 22, 2025)</option>
                  <option value="ISO">ISO (2025-07-22)</option>
                  <option value="compact">Compact (22 jul)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Timezone</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => handleSettingsChange('timezone', e.target.value)}
                  className="w-full px-3 py-1.5 text-base border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <Text variant="muted" className="text-xs mt-1">
                  Current: {settings.timezone}
                </Text>
              </div>
            </div>

            {/* Toggle Settings */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-sm font-medium text-foreground mb-0">Show Seconds</Text>
                  <Text variant="muted" className="text-xs">
                    Display seconds in time
                  </Text>
                </div>
                <Switch
                  checked={settings.showSeconds}
                  onCheckedChange={(checked) => handleSettingsChange('showSeconds', checked)}
                  aria-label="Toggle show seconds"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-sm font-medium text-foreground mb-0">Show Date</Text>
                  <Text variant="muted" className="text-xs">
                    Display date below time
                  </Text>
                </div>
                <Switch
                  checked={settings.showDate}
                  onCheckedChange={(checked) => handleSettingsChange('showDate', checked)}
                  aria-label="Toggle show date"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-sm font-medium text-foreground mb-0">Show Clock</Text>
                  <Text variant="muted" className="text-xs">
                    Display time (icon only when off)
                  </Text>
                </div>
                <Switch
                  checked={settings.showClock}
                  onCheckedChange={(checked) => handleSettingsChange('showClock', checked)}
                  aria-label="Toggle show clock"
                />
              </div>
            </div>

            {/* Back Button */}
            <Button
              onClick={() => setShowSettings(false)}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              Back to Clock
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Non-compact mode fallback
  return null;
}
