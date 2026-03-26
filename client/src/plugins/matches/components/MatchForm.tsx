import { Info, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useMatches } from '../hooks/useMatches';
import { type MatchMention, type SportType, SPORT_TYPES, getFormatsForSport } from '../types/match';

import { MatchDateTimePicker } from './MatchDateTimePicker';
import { MatchSettingsForm } from './MatchSettingsForm';

const MATCH_FORM_CARD_CLASS =
  'overflow-hidden border border-border/70 bg-card shadow-sm rounded-lg';
const PANEL_MAX_WIDTH = 'max-w-[920px]';

interface MatchFormState {
  name: string;
  match_number: string;
  match_type: 'series' | 'cup' | 'friendly' | '';
  referee_count: string;
  map_link: string;
  home_team: string;
  away_team: string;
  location: string;
  start_time: string;
  sport_type: SportType;
  format: string;
  total_minutes: string;
}

type AssignableContact = {
  id: string | number;
  companyName?: string;
  isAssignable?: boolean;
};

interface MatchFormProps {
  currentMatch?: any;
  onSave: (data: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
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

export function MatchForm({ currentMatch, onSave, onCancel }: MatchFormProps) {
  const { t } = useTranslation();
  const { contacts } = useApp();
  const assignableContacts = (contacts as AssignableContact[]).filter(
    (c) => c.isAssignable !== false,
  );
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
    name: '',
    match_number: '',
    match_type: '',
    referee_count: '1',
    map_link: '',
    home_team: '',
    away_team: '',
    location: '',
    start_time: '',
    sport_type: 'football',
    format: '',
    total_minutes: '',
  });
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const formKey = `match-form-${currentMatch?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [isDirty, currentMatch, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      match_number: '',
      match_type: '',
      referee_count: '1',
      map_link: '',
      home_team: '',
      away_team: '',
      location: '',
      start_time: '',
      sport_type: 'football',
      format: '',
      total_minutes: '',
    });
    setSelectedContactIds([]);
    markClean();
  }, [markClean]);

  useEffect(() => {
    if (currentMatch) {
      const formats = getFormatsForSport((currentMatch.sport_type as SportType) || 'football');
      const format = formats.includes(currentMatch.format) ? currentMatch.format : '';
      setFormData({
        name: currentMatch.name ?? '',
        match_number:
          currentMatch.match_number !== null && currentMatch.match_number !== undefined
            ? String(currentMatch.match_number)
            : '',
        match_type: currentMatch.match_type ?? '',
        referee_count:
          currentMatch.referee_count !== null && currentMatch.referee_count !== undefined
            ? String(currentMatch.referee_count)
            : '1',
        map_link: currentMatch.map_link ?? '',
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
      const fromMentions =
        currentMatch.mentions?.map((m: MatchMention) => String(m.contactId)).filter(Boolean) ?? [];
      const fromContactId =
        currentMatch.contact_id && !fromMentions.includes(String(currentMatch.contact_id))
          ? [String(currentMatch.contact_id)]
          : [];
      setSelectedContactIds(fromMentions.length > 0 ? fromMentions : fromContactId);
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
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    const mentions: MatchMention[] = selectedContactIds
      .map((id) => assignableContacts.find((c) => String(c.id) === id))
      .filter((c): c is AssignableContact => Boolean(c))
      .map((c) => {
        const name = c.companyName ?? 'Contact';
        return {
          contactId: String(c.id),
          contactName: name,
          companyName: c.companyName,
        };
      });
    const payload = {
      ...formData,
      name:
        formData.name.trim() ||
        [formData.home_team, formData.away_team].filter(Boolean).join(' – ').trim() ||
        null,
      match_number:
        formData.match_number.trim() === '' ? null : parseInt(formData.match_number.trim(), 10),
      match_type: formData.match_type.trim() === '' ? null : formData.match_type,
      referee_count:
        formData.referee_count.trim() === '' ? 1 : parseInt(formData.referee_count.trim(), 10),
      map_link: formData.map_link.trim() || null,
      start_time: formData.start_time ? new Date(formData.start_time).toISOString() : '',
      total_minutes:
        formData.total_minutes.trim() === '' ? null : parseInt(formData.total_minutes, 10),
      contact_id: selectedContactIds[0] ?? null,
      mentions,
    };
    try {
      const ok = await onSave(payload);
      if (ok) {
        markClean();
        if (!currentMatch) {
          resetForm();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    panelMode,
    formData,
    selectedContactIds,
    assignableContacts,
    onSave,
    onCancel,
    markClean,
    currentMatch,
    resetForm,
    isSubmitting,
  ]);

  const handleCancel = useCallback(() => {
    attemptAction(() => onCancel());
  }, [attemptAction, onCancel]);

  useEffect(() => {
    window.submitMatchesForm = () => handleSubmit();
    (window as any).submitMatchForm = window.submitMatchesForm;
    window.cancelMatchesForm = () => handleCancel();
    (window as any).cancelMatchForm = window.cancelMatchesForm;
    return () => {
      delete window.submitMatchesForm;
      delete (window as any).submitMatchForm;
      delete window.cancelMatchesForm;
      delete (window as any).cancelMatchForm;
    };
  }, [handleSubmit, handleCancel]);

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
    const format = formats.includes(formData.format) ? formData.format : '';
    setFormData((prev) => ({ ...prev, sport_type: sport, format }));
    markDirty();
    clearValidationErrors();
  };

  const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);
  const hasBlockingErrors = validationErrors.some(
    (e) => !e.message?.toLowerCase().includes('warning'),
  );

  const formatOptions = getFormatsForSport(formData.sport_type);
  const FIELD_LABEL_CLASS =
    'text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5';
  const formSidebar = currentMatch ? (
    <div className="space-y-4">
      <Card padding="none" className={MATCH_FORM_CARD_CLASS}>
        <DetailSection
          title={t('matches.information')}
          icon={Info}
          iconPlugin="matches"
          className="p-4"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono font-medium">
                {formatDisplayNumber('matches', currentMatch.id)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('matches.created')}</span>
              <span className="font-medium">
                {currentMatch.created_at
                  ? new Date(currentMatch.created_at).toLocaleDateString()
                  : currentMatch.createdAt
                    ? new Date(currentMatch.createdAt).toLocaleDateString()
                    : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('matches.updated')}</span>
              <span className="font-medium">
                {currentMatch.updated_at
                  ? new Date(currentMatch.updated_at).toLocaleDateString()
                  : currentMatch.updatedAt
                    ? new Date(currentMatch.updatedAt).toLocaleDateString()
                    : '—'}
              </span>
            </div>
          </div>
        </DetailSection>
      </Card>
    </div>
  ) : undefined;

  return (
    <div
      className={cn(
        'plugin-matches min-h-full rounded-xl bg-background px-4 py-5 sm:px-5 sm:py-6',
        'md:-mx-6 md:-my-4 md:rounded-b-lg md:rounded-t-none',
      )}
    >
      <DetailLayout mainClassName={PANEL_MAX_WIDTH} sidebar={formSidebar}>
        <form
          ref={formRef}
          className="space-y-6"
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

          <Card padding="none" className={MATCH_FORM_CARD_CLASS}>
            <DetailSection title={t('matches.match')} iconPlugin="matches" className="p-6">
              <div className="space-y-4">
                {/* Name (own row) */}
                <div>
                  <Label htmlFor="match-name" className={FIELD_LABEL_CLASS}>
                    {t('matches.nameLabel')}
                  </Label>
                  <Input
                    id="match-name"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder={t('matches.namePlaceholder')}
                    className="h-10 text-sm"
                  />
                </div>

                {/* Home / Away (same row) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="match-home" className={FIELD_LABEL_CLASS}>
                      {t('matches.homeTeamLabel')}
                    </Label>
                    <Input
                      id="match-home"
                      value={formData.home_team}
                      onChange={(e) => updateField('home_team', e.target.value)}
                      placeholder="e.g. Team A"
                      className={cn(
                        'h-10 text-sm',
                        getFieldError('home_team') && 'border-destructive',
                      )}
                    />
                    {getFieldError('home_team') && (
                      <p className="mt-1 text-sm text-destructive">
                        {getFieldError('home_team')?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="match-away" className={FIELD_LABEL_CLASS}>
                      {t('matches.awayTeamLabel')}
                    </Label>
                    <Input
                      id="match-away"
                      value={formData.away_team}
                      onChange={(e) => updateField('away_team', e.target.value)}
                      placeholder="e.g. Team B"
                      className={cn(
                        'h-10 text-sm',
                        getFieldError('away_team') && 'border-destructive',
                      )}
                    />
                    {getFieldError('away_team') && (
                      <p className="mt-1 text-sm text-destructive">
                        {getFieldError('away_team')?.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Number + Date time (same row) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="match-number" className={FIELD_LABEL_CLASS}>
                      {t('matches.matchNumber')}
                    </Label>
                    <Input
                      id="match-number"
                      type="number"
                      min={1}
                      max={999999}
                      value={formData.match_number}
                      onChange={(e) => updateField('match_number', e.target.value)}
                      placeholder="1"
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="match-time" className={FIELD_LABEL_CLASS}>
                      {t('matches.dateTimePlaceholder')}
                    </Label>
                    <MatchDateTimePicker
                      value={formData.start_time}
                      onChange={(v) => updateField('start_time', v)}
                      hasError={Boolean(getFieldError('start_time'))}
                      placeholder={t('matches.dateTimePlaceholder')}
                      timeLabel={t('matches.timeLabel')}
                      clearLabel={t('matches.dateTimeClear')}
                    />
                    {getFieldError('start_time') && (
                      <p className="mt-1 text-sm text-destructive">
                        {getFieldError('start_time')?.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Location + Map link (same row) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="match-location" className={FIELD_LABEL_CLASS}>
                      {t('matches.locationLabel')}
                    </Label>
                    <Input
                      id="match-location"
                      value={formData.location}
                      onChange={(e) => updateField('location', e.target.value)}
                      placeholder="Venue, arena"
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="match-map-link" className={FIELD_LABEL_CLASS}>
                      {t('matches.mapLink')}
                    </Label>
                    <Input
                      id="match-map-link"
                      value={formData.map_link}
                      onChange={(e) => updateField('map_link', e.target.value)}
                      placeholder={t('matches.mapLinkPlaceholder')}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>

                {/* Sport / Format / Minutes (same row) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <Label className={FIELD_LABEL_CLASS}>{t('matches.sport')}</Label>
                    <Select
                      value={formData.sport_type}
                      onValueChange={(v) => setSportType(v as SportType)}
                    >
                      <SelectTrigger className="w-full h-10 text-sm">
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
                  <div>
                    <Label className={FIELD_LABEL_CLASS}>{t('matches.format')}</Label>
                    <Select
                      value={formData.format || '__none__'}
                      onValueChange={(v) => updateField('format', v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="w-full h-10 text-sm">
                        <SelectValue placeholder={t('matches.formatPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('matches.formatPlaceholder')}</SelectItem>
                        {formatOptions.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="match-minutes" className={FIELD_LABEL_CLASS}>
                      {t('matches.minutes')}
                    </Label>
                    <Input
                      id="match-minutes"
                      type="number"
                      min={1}
                      max={999}
                      value={formData.total_minutes}
                      onChange={(e) => updateField('total_minutes', e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>

                {/* Type / Referees / Future (same row) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <Label className={FIELD_LABEL_CLASS}>{t('matches.matchType')}</Label>
                    <Select
                      value={formData.match_type || '__none__'}
                      onValueChange={(v) =>
                        updateField(
                          'match_type',
                          v === '__none__' ? '' : (v as MatchFormState['match_type']),
                        )
                      }
                    >
                      <SelectTrigger className="w-full h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('matches.matchTypeNone')}</SelectItem>
                        <SelectItem value="series">{t('matches.matchTypeSeries')}</SelectItem>
                        <SelectItem value="cup">{t('matches.matchTypeCup')}</SelectItem>
                        <SelectItem value="friendly">{t('matches.matchTypeFriendly')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="match-referees" className={FIELD_LABEL_CLASS}>
                      {t('matches.refereeCount')}
                    </Label>
                    <Input
                      id="match-referees"
                      type="number"
                      min={0}
                      max={99}
                      value={formData.referee_count}
                      onChange={(e) => updateField('referee_count', e.target.value)}
                      placeholder="1"
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <Label className={FIELD_LABEL_CLASS}>{t('matches.futureInfo')}</Label>
                    <Input value="" disabled className="h-10 text-sm" placeholder="—" />
                  </div>
                </div>

                {/* Contacts (last row) */}
                <div>
                  <Label className={FIELD_LABEL_CLASS}>{t('matches.contacts')}</Label>
                  <Select
                    value="__add__"
                    onValueChange={(v) => {
                      if (v && v !== '__add__' && !selectedContactIds.includes(v)) {
                        setSelectedContactIds((prev) => [...prev, v]);
                        markDirty();
                        clearValidationErrors();
                      }
                    }}
                  >
                    <SelectTrigger className="w-full h-10 text-sm">
                      <SelectValue placeholder={t('matches.addContact')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__add__" className="text-muted-foreground">
                        {t('matches.addContact')}
                      </SelectItem>
                      {assignableContacts
                        .filter((c) => !selectedContactIds.includes(String(c.id)))
                        .map((contact) => (
                          <SelectItem key={contact.id} value={String(contact.id)}>
                            {contact.companyName ?? `Contact ${contact.id}`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {selectedContactIds.length > 0 && (
                    <ul className="flex flex-wrap gap-2 mt-2">
                      {selectedContactIds.map((id) => {
                        const contact = assignableContacts.find((c) => String(c.id) === id);
                        const name = contact?.companyName ?? id;
                        return (
                          <li
                            key={id}
                            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium"
                          >
                            {name}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedContactIds((prev) => prev.filter((x) => x !== id));
                                markDirty();
                                clearValidationErrors();
                              }}
                              className="rounded hover:bg-muted-foreground/20 p-0.5"
                              aria-label={`${t('matches.removeContact')} ${name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </DetailSection>
          </Card>
        </form>
      </DetailLayout>

      <ConfirmDialog
        isOpen={showWarning}
        title={t('dialog.unsavedChanges')}
        message={currentMatch ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
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
