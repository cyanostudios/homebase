import { CalendarClock, Check, ChevronDown, Lock, Plus, Settings, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { buildSlug } from '@/core/utils/slugUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import type { TrainingTime } from '@/plugins/teams/types/teams';

import { useSchedule } from '../hooks/useSchedule';
import { useSchedulePendingChanges } from '../hooks/useSchedulePendingChanges';
import { useSchedulePlans } from '../hooks/useSchedulePlans';
import { useScheduleSettings } from '../hooks/useScheduleSettings';
import {
  buildTeamSlots,
  DEFAULT_SCHEDULE_ID,
  isSlotVisibleInGrid,
  type ScheduleSlot,
  type ScheduleTrainingDialogState,
} from '../types/schedule';

import { PlanView } from './PlanView';
import { ScheduleSettingsView } from './ScheduleSettingsView';
import { ScheduleTimeGrid } from './ScheduleTimeGrid';
import { ScheduleTrainingDialog } from './ScheduleTrainingDialog';

export function ScheduleList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { teams } = useTeams();
  const {
    scheduleContentView,
    activeScheduleId,
    setActiveScheduleId,
    openScheduleSettings,
    closeScheduleSettingsView,
  } = useSchedule();
  const schedulePlans = useSchedulePlans();
  const { plans, createPlan, isLoading: isPlansLoading } = schedulePlans;
  const {
    getGridSettingsForSchedule,
    isLoading: isGridSettingsLoading,
    isLockedForSchedule,
  } = useScheduleSettings();
  const defaultGridSettings = getGridSettingsForSchedule(DEFAULT_SCHEDULE_ID);
  const isDefaultSchedule = activeScheduleId === DEFAULT_SCHEDULE_ID;
  const isLocked = isLockedForSchedule(activeScheduleId);
  const {
    displayTeams,
    isDirty,
    isSaving,
    saveError,
    setSaveError,
    getSlotHighlight,
    updateTeamTimes,
    commit,
    discard,
  } = useSchedulePendingChanges(teams);
  const { attemptNavigation, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [dialogState, setDialogState] = useState<ScheduleTrainingDialogState>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState('');
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [createScheduleError, setCreateScheduleError] = useState<string | null>(null);

  const activeScheduleName = useMemo(() => {
    if (isDefaultSchedule) {
      return t('schedule.defaultScheduleName');
    }
    return plans.find((plan) => plan.id === activeScheduleId)?.name ?? t('nav.schedule');
  }, [activeScheduleId, isDefaultSchedule, plans, t]);

  useEffect(() => {
    registerUnsavedChangesChecker('schedule-list', () => isDefaultSchedule && isDirty && !isLocked);
    return () => unregisterUnsavedChangesChecker('schedule-list');
  }, [
    isDefaultSchedule,
    isDirty,
    isLocked,
    registerUnsavedChangesChecker,
    unregisterUnsavedChangesChecker,
  ]);

  useEffect(() => {
    if (isDefaultSchedule && isLocked && isDirty) {
      discard();
    }
  }, [discard, isDefaultSchedule, isDirty, isLocked]);

  useEffect(() => {
    if (
      !isDefaultSchedule &&
      !isPlansLoading &&
      !plans.some((plan) => plan.id === activeScheduleId)
    ) {
      setActiveScheduleId(DEFAULT_SCHEDULE_ID);
    }
  }, [activeScheduleId, isDefaultSchedule, isPlansLoading, plans, setActiveScheduleId]);

  const weekSlots = useMemo(() => {
    const slots = buildTeamSlots(displayTeams, teamFilter);
    return slots.filter((slot) => isSlotVisibleInGrid(slot, defaultGridSettings));
  }, [displayTeams, defaultGridSettings, teamFilter]);

  const handleSelectSchedule = useCallback(
    (scheduleId: string) => {
      if (scheduleId === activeScheduleId) {
        return;
      }
      attemptNavigation(() => setActiveScheduleId(scheduleId));
    },
    [activeScheduleId, attemptNavigation, setActiveScheduleId],
  );

  const handleCreateSchedule = useCallback(async () => {
    const name = newScheduleName.trim();
    if (!name) {
      return;
    }
    setIsCreatingSchedule(true);
    setCreateScheduleError(null);
    try {
      const plan = await createPlan(name);
      setShowCreateDialog(false);
      setNewScheduleName('');
      setActiveScheduleId(plan.id);
    } catch {
      setCreateScheduleError(t('schedule.createError'));
    } finally {
      setIsCreatingSchedule(false);
    }
  }, [createPlan, newScheduleName, setActiveScheduleId, t]);

  const handleSlotClick = useCallback(
    (slot: ScheduleSlot) => {
      if (!slot.teamId) {
        return;
      }
      const team = displayTeams.find((item) => String(item.id) === String(slot.teamId));
      if (!team) {
        return;
      }
      attemptNavigation(() => {
        navigate(`/teams/${buildSlug(team, displayTeams, 'name')}`);
      });
    },
    [attemptNavigation, displayTeams, navigate],
  );

  const handleSlotMove = useCallback(
    (slot: ScheduleSlot, newDay: string, newStartTime: string, newEndTime: string) => {
      if (!slot.teamId || isLocked) {
        return;
      }

      updateTeamTimes(String(slot.teamId), (times) =>
        times.map((training, index) =>
          index === slot.trainingIndex
            ? { ...training, day: newDay, startTime: newStartTime, endTime: newEndTime }
            : training,
        ),
      );
    },
    [isLocked, updateTeamTimes],
  );

  const handleAddSlot = useCallback(
    (day: string, startMinutes: number) => {
      if (isLocked) {
        return;
      }
      setDialogState({ mode: 'create', day, startMinutes });
      setSaveError(null);
    },
    [isLocked, setSaveError],
  );

  const handleEditSlot = useCallback(
    (slot: ScheduleSlot) => {
      if (isLocked) {
        return;
      }
      setDialogState({ mode: 'edit', slot });
      setSaveError(null);
    },
    [isLocked, setSaveError],
  );

  const handleCreateTraining = useCallback(
    async (teamId: string, training: TrainingTime) => {
      updateTeamTimes(teamId, (times) => [...times, training]);
      return true;
    },
    [updateTeamTimes],
  );

  const handleUpdateTraining = useCallback(
    async (slot: ScheduleSlot, training: TrainingTime) => {
      if (!slot.teamId) {
        return false;
      }

      updateTeamTimes(String(slot.teamId), (times) =>
        times.map((item, index) =>
          index === slot.trainingIndex ? { ...item, ...training } : item,
        ),
      );
      return true;
    },
    [updateTeamTimes],
  );

  const handleDeleteTraining = useCallback(
    async (slot: ScheduleSlot) => {
      if (!slot.teamId) {
        return false;
      }

      updateTeamTimes(String(slot.teamId), (times) =>
        times.filter((_, index) => index !== slot.trainingIndex),
      );
      return true;
    },
    [updateTeamTimes],
  );

  const handleCommit = useCallback(async () => {
    const ok = await commit();
    if (!ok) {
      setSaveError(t('schedule.saveError'));
    }
  }, [commit, setSaveError, t]);

  const preferredTeamId = teamFilter !== 'all' ? teamFilter : undefined;

  if (scheduleContentView === 'settings') {
    return (
      <div className="plugin-schedule min-h-full bg-background">
        <div className="px-6 py-4">
          <ScheduleSettingsView
            schedulePlans={schedulePlans}
            defaultScheduleDirty={isDirty}
            onDiscardDefaultChanges={discard}
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={() => attemptNavigation(closeScheduleSettingsView)}
              >
                {t('common.close')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-schedule min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.schedule')}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t('schedule.listDescription')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isDefaultSchedule && isDirty && !isLocked ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 px-3 text-xs"
                  disabled={isSaving}
                  onClick={() => setShowDiscardDialog(true)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={handleCommit}
                  variant="primary"
                  size="sm"
                  icon={Check}
                  disabled={isSaving}
                  className="h-9 border-none bg-green-600 px-3 text-xs text-white hover:bg-green-700"
                >
                  {isSaving ? t('common.saving') : t('common.update')}
                </Button>
              </>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1.5 px-3 text-xs font-semibold"
                >
                  <span className="truncate">{activeScheduleName}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[12rem]">
                <DropdownMenuItem onClick={() => handleSelectSchedule(DEFAULT_SCHEDULE_ID)}>
                  <span>{t('schedule.defaultScheduleName')}</span>
                </DropdownMenuItem>
                {plans.map((plan) => (
                  <DropdownMenuItem key={plan.id} onClick={() => handleSelectSchedule(plan.id)}>
                    <span className="truncate">{plan.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={() => attemptNavigation(openScheduleSettings)}
              title={t('schedule.settings.title')}
            >
              {t('schedule.settings.title')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => {
                setShowCreateDialog(true);
                setCreateScheduleError(null);
                setNewScheduleName('');
              }}
            >
              {t('schedule.newSchedule')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTeamFilter('all')}
            className={cn(
              'group h-auto rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:px-5 sm:py-3 sm:text-sm',
              'flex items-center gap-1.5 sm:gap-2',
              teamFilter === 'all'
                ? 'border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary'
                : 'border-transparent bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary',
            )}
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>
              {t('schedule.filterAll')}{' '}
              <span
                className={cn(
                  'tabular-nums font-semibold',
                  teamFilter === 'all'
                    ? 'text-primary'
                    : 'text-muted-foreground group-hover:text-primary',
                )}
              >
                ({teams.length})
              </span>
            </span>
          </Button>
          {teams.map((team) => {
            const isActive = teamFilter === String(team.id);
            return (
              <Button
                key={team.id}
                type="button"
                variant="ghost"
                onClick={() => setTeamFilter(isActive ? 'all' : String(team.id))}
                className={cn(
                  'group h-auto rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:px-5 sm:py-3 sm:text-sm',
                  'flex items-center gap-1.5 sm:gap-2',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary'
                    : 'border-transparent bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary',
                )}
              >
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="truncate">{team.name}</span>
              </Button>
            );
          })}
        </div>

        {isDefaultSchedule ? (
          <Card className="rounded-xl border-0 bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                {activeScheduleName}
              </h3>
              {isLocked ? (
                <span title={t('schedule.lockedBadge')}>
                  <Lock
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-label={t('schedule.lockedBadge')}
                  />
                </span>
              ) : null}
            </div>
            {saveError ? <p className="mb-2 text-xs text-destructive">{saveError}</p> : null}
            {isGridSettingsLoading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : (
              <ScheduleTimeGrid
                slots={weekSlots}
                gridSettings={defaultGridSettings}
                savingSlotId={null}
                readOnly={isLocked}
                getSlotHighlight={isLocked ? undefined : getSlotHighlight}
                onSlotClick={handleSlotClick}
                onEditSlot={isLocked ? undefined : handleEditSlot}
                onAddSlot={isLocked ? undefined : handleAddSlot}
                onSlotMove={handleSlotMove}
              />
            )}
          </Card>
        ) : (
          <PlanView
            scheduleId={activeScheduleId}
            scheduleName={activeScheduleName}
            teamFilter={teamFilter}
            schedulePlans={schedulePlans}
          />
        )}
      </div>

      <ConfirmDialog
        isOpen={showDiscardDialog}
        title={t('dialog.unsavedChanges')}
        message={t('teams.form.unsavedMessage')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={() => {
          discard();
          setShowDiscardDialog(false);
        }}
        onCancel={() => setShowDiscardDialog(false)}
        variant="warning"
      />

      <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 flex-shrink-0 text-primary" />
              <AlertDialogTitle>{t('schedule.newSchedule')}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              {t('schedule.createTrainingDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">{t('schedule.scheduleName')}</Label>
            <Input
              value={newScheduleName}
              onChange={(event) => setNewScheduleName(event.target.value)}
              placeholder={t('schedule.namePlaceholder')}
              className="h-9"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleCreateSchedule();
                }
              }}
            />
            {createScheduleError ? (
              <p className="text-xs text-destructive">{createScheduleError}</p>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCreatingSchedule}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                disabled={!newScheduleName.trim() || isCreatingSchedule}
                onClick={(event) => {
                  event.preventDefault();
                  void handleCreateSchedule();
                }}
              >
                {isCreatingSchedule ? t('common.saving') : t('common.save')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {dialogState && isDefaultSchedule ? (
        <ScheduleTrainingDialog
          state={dialogState}
          teams={displayTeams}
          preferredTeamId={preferredTeamId}
          isSaving={false}
          onClose={() => setDialogState(null)}
          onCreate={handleCreateTraining}
          onUpdate={handleUpdateTraining}
          onDelete={handleDeleteTraining}
        />
      ) : null}
    </div>
  );
}
