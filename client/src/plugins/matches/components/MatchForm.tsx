import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useMatches } from '../hooks/useMatches';
import { type SportType, SPORT_TYPES, getFormatsForSport } from '../types/match';

import { MatchDateTimePicker } from './MatchDateTimePicker';
import { MatchSettingsForm } from './MatchSettingsForm';

interface MatchFormState {
  home_team: string;
  away_team: string;
  location: string;
  start_time: string;
  sport_type: SportType;
  format: string;
  total_minutes: string;
}

interface MatchFormProps {
  currentMatch?: any;
  onSave: (data: MatchFormState) => Promise<boolean>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function MatchForm({
  currentMatch,
  onSave,
  onCancel,
  isSubmitting: _isSubmitting = false,
}: MatchFormProps) {
  const { validationErrors, clearValidationErrors, panelMode } = useMatches();
  const {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard,
  } = useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const [formData, setFormData] = useState<MatchFormState>({
    home_team: '',
    away_team: '',
    location: '',
    start_time: '',
    sport_type: 'football',
    format: '11vs11',
    total_minutes: '',
  });

  useEffect(() => {
    const formKey = `match-form-${currentMatch?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [isDirty, currentMatch, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const resetForm = useCallback(() => {
    const formats = getFormatsForSport('football');
    setFormData({
      home_team: '',
      away_team: '',
      location: '',
      start_time: '',
      sport_type: 'football',
      format: formats[0] ?? '11vs11',
      total_minutes: '',
    });
    markClean();
  }, [markClean]);

  useEffect(() => {
    if (currentMatch) {
      const formats = getFormatsForSport((currentMatch.sport_type as SportType) || 'football');
      const format = formats.includes(currentMatch.format)
        ? currentMatch.format
        : (formats[0] ?? '');
      setFormData({
        home_team: currentMatch.home_team ?? '',
        away_team: currentMatch.away_team ?? '',
        location: currentMatch.location ?? '',
        start_time: toDatetimeLocal(currentMatch.start_time),
        sport_type: (currentMatch.sport_type as SportType) ?? 'football',
        format,
        total_minutes:
          currentMatch.total_minutes !== null && currentMatch.total_minutes !== undefined
            ? String(currentMatch.total_minutes)
            : '',
      });
      markClean();
    } else if (panelMode !== 'settings') {
      resetForm();
    }
  }, [currentMatch, panelMode, markClean, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (panelMode === 'settings') {
      onCancel();
      return;
    }
    const payload = {
      ...formData,
      start_time: formData.start_time ? new Date(formData.start_time).toISOString() : '',
      total_minutes:
        formData.total_minutes.trim() === '' ? null : parseInt(formData.total_minutes, 10),
    };
    const ok = await onSave(payload);
    if (ok) {
      markClean();
      if (!currentMatch) {
        resetForm();
      }
    }
  }, [panelMode, formData, onSave, onCancel, markClean, currentMatch, resetForm]);

  const handleCancel = useCallback(() => {
    attemptAction(() => onCancel());
  }, [attemptAction, onCancel]);

  const submitRef = useRef(handleSubmit);
  const cancelRef = useRef(handleCancel);
  submitRef.current = handleSubmit;
  cancelRef.current = handleCancel;
  const formRef = useRef<HTMLFormElement | null>(null);

  // Refs so footer Save/Cancel always call latest handler; effect only on panelMode so globals stay set
  useEffect(() => {
    if (panelMode === 'settings') {
      return;
    }
    (window as any).submitMatchesForm = () => submitRef.current?.();
    (window as any).cancelMatchesForm = () => cancelRef.current?.();
    return () => {
      delete (window as any).submitMatchesForm;
      delete (window as any).cancelMatchesForm;
    };
  }, [panelMode]);

  if (panelMode === 'settings') {
    return <MatchSettingsForm onCancel={onCancel} />;
  }

  const updateField = (field: keyof MatchFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  const setSportType = (sport: SportType) => {
    const formats = getFormatsForSport(sport);
    const format = formats.includes(formData.format) ? formData.format : (formats[0] ?? '');
    setFormData((prev) => ({ ...prev, sport_type: sport, format }));
    markDirty();
    clearValidationErrors();
  };

  const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);
  const hasBlockingErrors = validationErrors.some(
    (e) => !e.message?.toLowerCase().includes('warning'),
  );

  const formatOptions = getFormatsForSport(formData.sport_type);

  return (
    <div className="space-y-4">
      <form
        ref={formRef}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {hasBlockingErrors && (
          <Card className="shadow-none border-destructive/50 bg-destructive/5 p-4">
            <div className="text-sm text-destructive font-medium">Cannot save</div>
            <ul className="list-disc list-inside mt-2 text-sm text-destructive/90">
              {validationErrors
                .filter((e) => !e.message?.toLowerCase().includes('warning'))
                .map((e) => (
                  <li key={`${e.field}-${e.message}`}>{e.message}</li>
                ))}
            </ul>
          </Card>
        )}

        <DetailSection title="Match" iconPlugin="matches" className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="match-home">Home team</Label>
                <Input
                  id="match-home"
                  value={formData.home_team}
                  onChange={(e) => updateField('home_team', e.target.value)}
                  placeholder="e.g. Team A"
                  className={cn(getFieldError('home_team') && 'border-destructive')}
                />
                {getFieldError('home_team') && (
                  <p className="text-sm text-destructive">{getFieldError('home_team')?.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="match-away">Away team</Label>
                <Input
                  id="match-away"
                  value={formData.away_team}
                  onChange={(e) => updateField('away_team', e.target.value)}
                  placeholder="e.g. Team B"
                  className={cn(getFieldError('away_team') && 'border-destructive')}
                />
                {getFieldError('away_team') && (
                  <p className="text-sm text-destructive">{getFieldError('away_team')?.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="match-time">Date</Label>
                <MatchDateTimePicker
                  value={formData.start_time}
                  onChange={(v) => updateField('start_time', v)}
                  hasError={Boolean(getFieldError('start_time'))}
                />
                {getFieldError('start_time') && (
                  <p className="text-sm text-destructive">{getFieldError('start_time')?.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="match-location">Venue</Label>
                <Input
                  id="match-location"
                  value={formData.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="Venue, arena"
                />
              </div>
            </div>
          </div>
        </DetailSection>

        <DetailSection title="Sport and format" iconPlugin="matches" className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formData.sport_type}
                onValueChange={(v) => setSportType(v as SportType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPORT_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === 'football' ? 'Football' : 'Handball'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={formData.format} onValueChange={(v) => updateField('format', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formatOptions.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="match-minutes">Total minutes</Label>
              <Input
                id="match-minutes"
                type="number"
                min={1}
                max={999}
                value={formData.total_minutes}
                onChange={(e) => updateField('total_minutes', e.target.value)}
                placeholder="90"
              />
            </div>
          </div>
        </DetailSection>
      </form>

      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved changes"
        message={
          currentMatch
            ? 'Discard changes and return to view?'
            : 'Discard changes and close the form?'
        }
        confirmText="Discard"
        cancelText="Continue editing"
        onConfirm={() => {
          if (!currentMatch) {
            resetForm();
          }
          confirmDiscard();
        }}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
}
