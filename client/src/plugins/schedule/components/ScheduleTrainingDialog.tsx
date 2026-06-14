import { CalendarClock, Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Team, TrainingTime } from '@/plugins/teams/types/teams';
import { WEEK_DAYS } from '@/plugins/teams/types/teams';

import {
  GRID_SLOT_MINUTES,
  minutesToTime,
  timeToMinutes,
  type ScheduleSlot,
  type ScheduleTrainingDialogState,
} from '../types/schedule';

type FormState = {
  teamId: string;
  day: string;
  startTime: string;
  endTime: string;
  location: string;
};

function buildDefaultForm(
  state: Exclude<ScheduleTrainingDialogState, null>,
  teams: Team[],
  preferredTeamId?: string,
): FormState {
  if (state.mode === 'edit') {
    return {
      teamId: String(state.slot.teamId ?? ''),
      day: state.slot.day,
      startTime: state.slot.startTime,
      endTime: state.slot.endTime,
      location: state.slot.location ?? '',
    };
  }

  const defaultTeamId =
    preferredTeamId && teams.some((team) => String(team.id) === preferredTeamId)
      ? preferredTeamId
      : String(teams[0]?.id ?? '');

  return {
    teamId: defaultTeamId,
    day: state.day,
    startTime: minutesToTime(state.startMinutes),
    endTime: minutesToTime(state.startMinutes + 60),
    location: '',
  };
}

export function ScheduleTrainingDialog({
  state,
  teams,
  preferredTeamId,
  isSaving,
  deleteConfirmText,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  state: Exclude<ScheduleTrainingDialogState, null>;
  teams: Team[];
  preferredTeamId?: string;
  isSaving: boolean;
  deleteConfirmText?: string;
  onClose: () => void;
  onCreate: (teamId: string, training: TrainingTime) => Promise<boolean>;
  onUpdate: (slot: ScheduleSlot, training: TrainingTime) => Promise<boolean>;
  onDelete: (slot: ScheduleSlot) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(() =>
    buildDefaultForm(state, teams, preferredTeamId),
  );
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setForm(buildDefaultForm(state, teams, preferredTeamId));
    setError(null);
    setShowDeleteConfirm(false);
  }, [preferredTeamId, state, teams]);

  const isEdit = state.mode === 'edit';
  const title = isEdit ? t('schedule.editTraining') : t('schedule.createTraining');

  const isValid = useMemo(() => {
    if (!form.day || !form.startTime || !form.endTime) {
      return false;
    }
    if (!isEdit && !form.teamId) {
      return false;
    }
    return timeToMinutes(form.endTime) > timeToMinutes(form.startTime);
  }, [form, isEdit]);

  const handleSave = async () => {
    if (!isValid) {
      setError(t('slots.endMustBeAfterStart'));
      return;
    }

    setError(null);
    const training: TrainingTime = {
      day: form.day,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location.trim(),
    };

    const ok =
      state.mode === 'edit'
        ? await onUpdate(state.slot, training)
        : await onCreate(form.teamId, training);

    if (ok) {
      onClose();
      return;
    }

    setError(state.mode === 'edit' ? t('schedule.saveError') : t('schedule.createError'));
  };

  const handleDelete = async () => {
    if (state.mode !== 'edit') {
      return;
    }

    setError(null);
    const ok = await onDelete(state.slot);
    setShowDeleteConfirm(false);
    if (ok) {
      onClose();
      return;
    }
    setError(t('schedule.deleteError'));
  };

  return (
    <>
      <AlertDialog open onOpenChange={(open) => !open && onClose()}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 flex-shrink-0 text-primary" />
              <AlertDialogTitle>{title}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              {isEdit ? state.slot.teamName : t('schedule.createTrainingDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            {!isEdit ? (
              <div className="space-y-2">
                <Label className="text-xs">{t('schedule.selectTeam')}</Label>
                <Select
                  value={form.teamId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, teamId: value }))}
                >
                  <SelectTrigger className="h-9 w-full text-sm">
                    <SelectValue placeholder={t('schedule.selectTeam')} />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={String(team.id)}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-xs">{t('teams.form.dayLabel')}</Label>
              <Select
                value={form.day}
                onValueChange={(value) => setForm((prev) => ({ ...prev, day: value }))}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">{t('teams.form.startTimeLabel')}</Label>
                <Input
                  type="time"
                  step={GRID_SLOT_MINUTES * 60}
                  value={form.startTime}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, startTime: event.target.value }))
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('teams.form.endTimeLabel')}</Label>
                <Input
                  type="time"
                  step={GRID_SLOT_MINUTES * 60}
                  value={form.endTime}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, endTime: event.target.value }))
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">{t('teams.form.locationLabel')}</Label>
              <Input
                value={form.location}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                className="h-9"
                placeholder={t('teams.form.locationPlaceholder')}
              />
            </div>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>

          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={isSaving}
                onClick={() => setShowDeleteConfirm(true)}
              >
                {t('schedule.deleteTraining')}
              </Button>
            ) : (
              <span className="hidden sm:block sm:flex-1" aria-hidden />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialogCancel asChild>
                <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                  {t('common.cancel')}
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button disabled={!isValid || isSaving} onClick={handleSave}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('schedule.savingTraining')}
                    </>
                  ) : (
                    t('schedule.saveTraining')
                  )}
                </Button>
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('schedule.deleteTraining')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmText ?? t('schedule.deleteTrainingConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {t('schedule.deleteTraining')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
