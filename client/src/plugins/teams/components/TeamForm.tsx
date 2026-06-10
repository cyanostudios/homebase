import { Plus, Trash2, UserPlus, X } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import type { TeamPayload } from '../api/teamsApi';
import { useTeams } from '../hooks/useTeams';
import type {
  Responsible,
  SeasonBreak,
  SeriesTeam,
  Team,
  TeamNote,
  TrainingTime,
} from '../types/teams';
import {
  createTeamNoteId,
  getSeriesTeamColorForName,
  getSeriesTeamDisplayLabel,
  getSeriesTeamOptions,
  resolveSeriesTeamColor,
  responsibleKey,
  RESPONSIBLE_ROLES,
  RESPONSIBLE_ROLE_BADGES,
  TEAM_COLORS,
  TEAM_COLOR_GRADIENTS,
  TEAM_GENDERS,
  TEAM_STATUSES,
  WEEK_DAYS,
} from '../types/teams';

import { SeriesTeamBadge } from './ResponsibleRow';
import { SeriesTeamColorPicker } from './SeriesTeamColorPicker';
import { SeriesTeamSelect } from './SeriesTeamSelect';
import { TeamNotesSection } from './TeamNotesSection';
import { TeamSettingsForm } from './TeamSettingsForm';

const TEAM_FORM_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm rounded-lg';

interface TeamFormProps {
  currentTeam?: Team | null;
  currentItem?: Team | null;
  onSave: (data: TeamPayload) => Promise<boolean>;
  onCancel: () => void;
}

export const TeamForm = React.forwardRef<PanelFormHandle, TeamFormProps>(function TeamForm(
  { currentTeam, currentItem, onSave, onCancel },
  ref,
) {
  const { t } = useTranslation();
  const { validationErrors, clearValidationErrors, panelMode } = useTeams();
  const { contacts } = useApp();
  const item = currentTeam ?? currentItem ?? null;

  const [form, setForm] = useState({
    name: '',
    age_group: '',
    gender: '' as Team['gender'] | '',
    player_count: '',
    status: 'active' as Team['status'],
    color: 'green' as Team['color'],
  });
  const [seriesTeams, setSeriesTeams] = useState<SeriesTeam[]>([]);
  const [trainingTimes, setTrainingTimes] = useState<TrainingTime[]>([]);
  const [seasonBreaks, setSeasonBreaks] = useState<SeasonBreak[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [teamNotes, setTeamNotes] = useState<TeamNote[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [newResponsibleRole, setNewResponsibleRole] = useState<string>('coach');
  const [newResponsibleSeriesTeam, setNewResponsibleSeriesTeam] = useState<string | null>(null);
  const [pendingRemoveResponsible, setPendingRemoveResponsible] = useState<{
    key: string;
    name: string;
  } | null>(null);
  const [pendingRemoveNote, setPendingRemoveNote] = useState<TeamNote | null>(null);
  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();

  useEffect(() => {
    setForm({
      name: item?.name || '',
      age_group: item?.age_group || '',
      gender: item?.gender || '',
      player_count: item?.player_count != null ? String(item.player_count) : '',
      status: item?.status || 'active',
      color: item?.color || 'green',
    });
    if (item?.series_teams?.length) {
      setSeriesTeams([...item.series_teams]);
    } else if (item?.series_team_count && item.series_team_count > 0) {
      setSeriesTeams(
        Array.from({ length: item.series_team_count }, (_, i) => ({
          name: `Serielag ${i + 1}`,
          level: '',
          color: resolveSeriesTeamColor(null, i),
        })),
      );
    } else {
      setSeriesTeams([]);
    }
    setTrainingTimes(item?.training_times ? [...item.training_times] : []);
    setSeasonBreaks(item?.season_breaks ? [...item.season_breaks] : []);
    setResponsibles(item?.responsibles ? [...item.responsibles] : []);
    setTeamNotes(item?.team_notes ? [...item.team_notes] : []);
    setContactSearch('');
    clearValidationErrors();
    markClean();
  }, [item, clearValidationErrors, markClean]);

  const onFieldChange = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (validationErrors.length) {
      clearValidationErrors();
    }
    markDirty();
  };

  const contactNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const contact of contacts) {
      map.set(String(contact.id), contact.companyName || `Contact ${contact.id}`);
    }
    return map;
  }, [contacts]);

  const seriesTeamOptions = useMemo(
    () =>
      getSeriesTeamOptions({ series_teams: seriesTeams, series_team_count: seriesTeams.length }),
    [seriesTeams],
  );

  const availableContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) {
      return [];
    }
    const linkedKeys = new Set(responsibles.map(responsibleKey));
    const seriesKey = newResponsibleSeriesTeam ?? '';
    return contacts
      .filter((contact) => !linkedKeys.has(`${contact.id}::${seriesKey}`))
      .filter((contact) => (contact.companyName || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [contacts, contactSearch, responsibles, newResponsibleSeriesTeam]);

  const addTrainingTime = () => {
    setTrainingTimes((prev) => [
      ...prev,
      { day: 'monday', startTime: '17:00', endTime: '18:00', location: '' },
    ]);
    markDirty();
  };

  const updateTrainingTime = (index: number, patch: Partial<TrainingTime>) => {
    setTrainingTimes((prev) => prev.map((tt, i) => (i === index ? { ...tt, ...patch } : tt)));
    markDirty();
  };

  const removeTrainingTime = (index: number) => {
    setTrainingTimes((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  const addSeasonBreak = () => {
    setSeasonBreaks((prev) => [...prev, { name: '', startDate: '', endDate: '' }]);
    markDirty();
  };

  const updateSeasonBreak = (index: number, patch: Partial<SeasonBreak>) => {
    setSeasonBreaks((prev) => prev.map((sb, i) => (i === index ? { ...sb, ...patch } : sb)));
    markDirty();
  };

  const removeSeasonBreak = (index: number) => {
    setSeasonBreaks((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  const addSeriesTeam = () => {
    setSeriesTeams((prev) => [
      ...prev,
      { name: '', level: '', color: resolveSeriesTeamColor(null, prev.length) },
    ]);
    markDirty();
  };

  const updateSeriesTeam = (index: number, patch: Partial<SeriesTeam>) => {
    setSeriesTeams((prev) => prev.map((st, i) => (i === index ? { ...st, ...patch } : st)));
    markDirty();
  };

  const removeSeriesTeam = (index: number) => {
    setSeriesTeams((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  const addResponsible = (contactId: string) => {
    setResponsibles((prev) => [
      ...prev,
      { contactId, role: newResponsibleRole, seriesTeam: newResponsibleSeriesTeam },
    ]);
    setContactSearch('');
    markDirty();
  };

  const updateResponsible = (key: string, patch: Partial<Responsible>) => {
    setResponsibles((prev) =>
      prev.map((r) => (responsibleKey(r) === key ? { ...r, ...patch } : r)),
    );
    markDirty();
  };

  const removeResponsible = (key: string) => {
    setResponsibles((prev) => prev.filter((r) => responsibleKey(r) !== key));
    markDirty();
  };

  const addNote = (text: string) => {
    setTeamNotes((prev) => [
      ...prev,
      { id: createTeamNoteId(), text, createdAt: new Date().toISOString() },
    ]);
    markDirty();
  };

  const removeNote = (noteId: string) => {
    setTeamNotes((prev) => prev.filter((n) => n.id !== noteId));
    markDirty();
  };

  const submit = useCallback(async () => {
    const ok = await onSave({
      name: form.name.trim(),
      age_group: form.age_group.trim() || null,
      gender: form.gender || undefined,
      player_count: form.player_count.trim() ? Number(form.player_count) : 0,
      series_teams: seriesTeams
        .filter((st) => st.name.trim())
        .map((st, index) => ({
          name: st.name.trim(),
          level: st.level?.trim() || null,
          color: resolveSeriesTeamColor(st.color, index),
        })),
      status: form.status,
      training_times: trainingTimes.filter((tt) => tt.day),
      season_breaks: seasonBreaks.filter((sb) => sb.startDate && sb.endDate),
      responsibles,
      team_notes: teamNotes,
      color: form.color,
    });
    if (ok) {
      markClean();
    }
  }, [form, seriesTeams, trainingTimes, seasonBreaks, responsibles, teamNotes, markClean, onSave]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => submit(),
      cancel: () => attemptAction(onCancel),
    }),
    [submit, attemptAction, onCancel],
  );

  if (panelMode === 'settings') {
    return <TeamSettingsForm ref={ref} onCancel={onCancel} />;
  }

  return (
    <>
      <DetailLayout>
        <div className="space-y-3">
          <Card padding="none" className={TEAM_FORM_CARD_CLASS}>
            <DetailSection title={t('teams.form.detailsSection')} className="p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>{t('teams.form.nameLabel')}</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => onFieldChange('name', e.target.value)}
                    placeholder={t('teams.form.namePlaceholder')}
                  />
                </div>
                <div>
                  <Label>{t('teams.form.ageGroupLabel')}</Label>
                  <Input
                    value={form.age_group}
                    onChange={(e) => onFieldChange('age_group', e.target.value)}
                    placeholder="P12, F14..."
                  />
                </div>
                <div>
                  <Label>{t('teams.form.genderLabel')}</Label>
                  <Select
                    value={form.gender || undefined}
                    onValueChange={(value) => onFieldChange('gender', value as Team['gender'])}
                  >
                    <SelectTrigger className="h-10 w-full text-sm">
                      <SelectValue placeholder={t('teams.form.genderPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_GENDERS.map((gender) => (
                        <SelectItem key={gender} value={gender}>
                          {t(`teams.gender.${gender}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('teams.form.playerCountLabel')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.player_count}
                    onChange={(e) => onFieldChange('player_count', e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('teams.form.statusLabel')}</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => onFieldChange('status', value as Team['status'])}
                  >
                    <SelectTrigger className="h-10 w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(`teams.status.${status}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('teams.form.colorLabel')}</Label>
                  <div className="flex items-center gap-2 pt-1.5">
                    {TEAM_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        title={color}
                        className={cn(
                          'h-7 w-7 rounded-full bg-gradient-to-br transition-transform',
                          TEAM_COLOR_GRADIENTS[color],
                          form.color === color
                            ? 'scale-110 ring-2 ring-foreground ring-offset-2'
                            : 'hover:scale-105',
                        )}
                        onClick={() => onFieldChange('color', color)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </DetailSection>
          </Card>

          <Card padding="none" className={TEAM_FORM_CARD_CLASS}>
            <DetailSection title={t('teams.form.seriesTeamsSection')} className="p-4">
              <div className="space-y-2">
                {seriesTeams.map((seriesTeam, index) => (
                  <div
                    key={index}
                    className="flex items-end gap-2 rounded-lg border border-border/60 p-2"
                  >
                    <div className="flex-1">
                      <Label className="text-[11px]">{t('teams.form.seriesTeamNameLabel')}</Label>
                      <Input
                        value={seriesTeam.name}
                        onChange={(e) => updateSeriesTeam(index, { name: e.target.value })}
                        className="h-9"
                        placeholder={t('teams.form.seriesTeamNamePlaceholder')}
                      />
                    </div>
                    <div className="w-36 sm:w-44">
                      <Label className="text-[11px]">{t('teams.form.seriesTeamLevelLabel')}</Label>
                      <Input
                        value={seriesTeam.level ?? ''}
                        onChange={(e) => updateSeriesTeam(index, { level: e.target.value })}
                        className="h-9"
                        placeholder={t('teams.form.seriesTeamLevelPlaceholder')}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">{t('teams.form.colorLabel')}</Label>
                      <div className="pt-1.5">
                        <SeriesTeamColorPicker
                          value={resolveSeriesTeamColor(seriesTeam.color, index)}
                          onChange={(color) => updateSeriesTeam(index, { color })}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 text-destructive hover:text-destructive"
                      onClick={() => removeSeriesTeam(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  onClick={addSeriesTeam}
                >
                  {t('teams.form.addSeriesTeam')}
                </Button>
              </div>
            </DetailSection>
          </Card>

          <Card padding="none" className={TEAM_FORM_CARD_CLASS}>
            <DetailSection title={t('teams.form.trainingSection')} className="p-4">
              <div className="space-y-2">
                {trainingTimes.map((training, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 items-end gap-2 rounded-lg border border-border/60 p-2 sm:grid-cols-[1fr_auto_auto_1fr_auto]"
                  >
                    <div>
                      <Label className="text-[11px]">{t('teams.form.dayLabel')}</Label>
                      <Select
                        value={training.day}
                        onValueChange={(value) => updateTrainingTime(index, { day: value })}
                      >
                        <SelectTrigger className="h-9 w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WEEK_DAYS.map((day) => (
                            <SelectItem key={day} value={day}>
                              {t(`teams.days.${day}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px]">{t('teams.form.startTimeLabel')}</Label>
                      <Input
                        type="time"
                        value={training.startTime}
                        onChange={(e) => updateTrainingTime(index, { startTime: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">{t('teams.form.endTimeLabel')}</Label>
                      <Input
                        type="time"
                        value={training.endTime}
                        onChange={(e) => updateTrainingTime(index, { endTime: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">{t('teams.form.locationLabel')}</Label>
                      <Input
                        value={training.location}
                        onChange={(e) => updateTrainingTime(index, { location: e.target.value })}
                        className="h-9"
                        placeholder={t('teams.form.locationPlaceholder')}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 text-destructive hover:text-destructive"
                      onClick={() => removeTrainingTime(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  onClick={addTrainingTime}
                >
                  {t('teams.form.addTraining')}
                </Button>
              </div>
            </DetailSection>
          </Card>

          <Card padding="none" className={TEAM_FORM_CARD_CLASS}>
            <DetailSection title={t('teams.form.seasonBreaksSection')} className="p-4">
              <div className="space-y-2">
                {seasonBreaks.map((seasonBreak, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 items-end gap-2 rounded-lg border border-border/60 p-2 sm:grid-cols-[1fr_auto_auto_auto]"
                  >
                    <div>
                      <Label className="text-[11px]">{t('teams.form.breakNameLabel')}</Label>
                      <Input
                        value={seasonBreak.name}
                        onChange={(e) => updateSeasonBreak(index, { name: e.target.value })}
                        className="h-9"
                        placeholder={t('teams.form.breakNamePlaceholder')}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">{t('teams.form.startDateLabel')}</Label>
                      <Input
                        type="date"
                        value={seasonBreak.startDate}
                        onChange={(e) => updateSeasonBreak(index, { startDate: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">{t('teams.form.endDateLabel')}</Label>
                      <Input
                        type="date"
                        value={seasonBreak.endDate}
                        onChange={(e) => updateSeasonBreak(index, { endDate: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 text-destructive hover:text-destructive"
                      onClick={() => removeSeasonBreak(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  onClick={addSeasonBreak}
                >
                  {t('teams.form.addBreak')}
                </Button>
              </div>
            </DetailSection>
          </Card>

          <Card padding="none" className={TEAM_FORM_CARD_CLASS}>
            <DetailSection title={t('teams.form.responsiblesSection')} className="p-4">
              <div className="space-y-3">
                {responsibles.length > 0 && (
                  <div className="space-y-1.5">
                    {responsibles.map((responsible) => {
                      const key = responsibleKey(responsible);
                      const name =
                        contactNameById.get(String(responsible.contactId)) ||
                        `Contact ${responsible.contactId}`;
                      const roleKey = RESPONSIBLE_ROLES.includes(responsible.role as any)
                        ? responsible.role
                        : 'other';
                      return (
                        <div
                          key={key}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                        >
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium">{name}</span>
                            <span
                              className={cn(
                                'inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                                RESPONSIBLE_ROLE_BADGES[
                                  roleKey as keyof typeof RESPONSIBLE_ROLE_BADGES
                                ],
                              )}
                            >
                              {t(`teams.roles.${roleKey}`)}
                            </span>
                            {seriesTeamOptions.length > 0 ? (
                              <SeriesTeamBadge
                                label={
                                  getSeriesTeamDisplayLabel(
                                    { series_teams: seriesTeams },
                                    responsible.seriesTeam,
                                  ) || t('teams.form.seriesTeamAll')
                                }
                                color={getSeriesTeamColorForName(
                                  { series_teams: seriesTeams },
                                  responsible.seriesTeam,
                                )}
                              />
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {seriesTeamOptions.length > 0 && (
                              <div className="w-36">
                                <SeriesTeamSelect
                                  options={seriesTeamOptions}
                                  value={responsible.seriesTeam}
                                  onChange={(seriesTeam) => updateResponsible(key, { seriesTeam })}
                                  className="h-8 text-xs"
                                />
                              </div>
                            )}
                            <Select
                              value={roleKey}
                              onValueChange={(role) => updateResponsible(key, { role })}
                            >
                              <SelectTrigger className="h-8 w-36 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {RESPONSIBLE_ROLES.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {t(`teams.roles.${role}`)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setPendingRemoveResponsible({
                                  key,
                                  name,
                                })
                              }
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[140px] flex-1">
                    <Label className="text-[11px]">{t('teams.form.searchContactLabel')}</Label>
                    <Input
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="h-9"
                      placeholder={t('teams.form.searchContactPlaceholder')}
                    />
                  </div>
                  {seriesTeamOptions.length > 0 && (
                    <div className="w-40">
                      <Label className="text-[11px]">{t('teams.form.seriesTeamLabel')}</Label>
                      <SeriesTeamSelect
                        options={seriesTeamOptions}
                        value={newResponsibleSeriesTeam}
                        onChange={setNewResponsibleSeriesTeam}
                      />
                    </div>
                  )}
                  <div className="w-40">
                    <Label className="text-[11px]">{t('teams.form.roleLabel')}</Label>
                    <Select value={newResponsibleRole} onValueChange={setNewResponsibleRole}>
                      <SelectTrigger className="h-9 w-full text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESPONSIBLE_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {t(`teams.roles.${role}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {availableContacts.length > 0 && (
                  <div className="space-y-1 rounded-lg border border-border/60 p-1.5">
                    {availableContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                        onClick={() => addResponsible(String(contact.id))}
                      >
                        <span className="truncate">{contact.companyName}</span>
                        <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs text-plugin">
                          <UserPlus className="h-3.5 w-3.5" />
                          {t('teams.form.linkContact')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </DetailSection>
          </Card>

          <Card padding="none" className={TEAM_FORM_CARD_CLASS}>
            <DetailSection title={t('teams.form.notesSection')} className="p-4">
              <TeamNotesSection
                notes={teamNotes}
                onAdd={addNote}
                onRemoveRequest={setPendingRemoveNote}
              />
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>
      {validationErrors.length > 0 && (
        <Card padding="sm" className="mt-3 border-destructive/40 bg-destructive/5">
          <ul className="space-y-1 text-sm text-destructive">
            {validationErrors.map((e) => (
              <li key={`${e.field}:${e.message}`}>{e.message}</li>
            ))}
          </ul>
        </Card>
      )}
      <ConfirmDialog
        isOpen={showWarning}
        title={t('teams.form.unsavedTitle')}
        message={t('teams.form.unsavedMessage')}
        confirmText={t('teams.form.unsavedConfirm')}
        cancelText={t('teams.form.unsavedCancel')}
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
        variant="warning"
      />
      <ConfirmDialog
        isOpen={pendingRemoveResponsible !== null}
        title={t('teams.view.removeResponsible')}
        message={t('teams.view.removeResponsibleConfirm', {
          name: pendingRemoveResponsible?.name ?? '',
        })}
        confirmText={t('teams.view.removeResponsible')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          if (!pendingRemoveResponsible) {
            return;
          }
          removeResponsible(pendingRemoveResponsible.key);
          setPendingRemoveResponsible(null);
        }}
        onCancel={() => setPendingRemoveResponsible(null)}
        variant="warning"
      />
      <ConfirmDialog
        isOpen={pendingRemoveNote !== null}
        title={t('teams.view.removeNote')}
        message={t('teams.view.removeNoteConfirm')}
        confirmText={t('teams.view.removeNote')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          if (!pendingRemoveNote) {
            return;
          }
          removeNote(pendingRemoveNote.id);
          setPendingRemoveNote(null);
        }}
        onCancel={() => setPendingRemoveNote(null)}
        variant="warning"
      />
    </>
  );
});
