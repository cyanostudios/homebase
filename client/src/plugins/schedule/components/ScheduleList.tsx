import { CalendarClock, Check, ChevronDown, Plus, Settings, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogRoundCancel, DialogSaveButton } from '@/core/ui/DialogRoundButtons';
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
import {
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { useMobileActions } from '@/core/ui/MobileActionsContext';
import { buildSlug } from '@/core/utils/slugUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import type { TrainingTime } from '@/plugins/teams/types/teams';

import { useSchedule } from '../hooks/useSchedule';
import { useScheduleDaySpan } from '../hooks/useScheduleDaySpan';
import { useSchedulePendingChanges } from '../hooks/useSchedulePendingChanges';
import { useSchedulePlans } from '../hooks/useSchedulePlans';
import { useScheduleSettings } from '../hooks/useScheduleSettings';
import {
  buildTeamSlots,
  DEFAULT_SCHEDULE_ID,
  getPreferredTeamIdFromFilter,
  toggleScheduleTeamFilter,
  type ScheduleSlot,
  type ScheduleTrainingDialogState,
} from '../types/schedule';

import { PlanView } from './PlanView';
import { ScheduleDaySpanToggle } from './ScheduleDaySpanToggle';
import { ScheduleFooter } from './ScheduleFooter';
import { ScheduleLockToggle } from './ScheduleLockToggle';
import { ScheduleSettingsView } from './ScheduleSettingsView';
import { ScheduleSlotDetailDialog } from './ScheduleSlotDetailDialog';
import { ScheduleTimeGrid } from './ScheduleTimeGrid';
import { ScheduleWeekView } from './ScheduleWeekView';
import { ScheduleTrainingDialog } from './ScheduleTrainingDialog';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';

export function ScheduleList() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
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
    getAvailableHours,
    setColumnOrder,
    settings,
    isLoading: isGridSettingsLoading,
    isLockedForSchedule,
    setLockedForSchedule,
    isTogglingLock,
  } = useScheduleSettings();
  const defaultGridSettings = getGridSettingsForSchedule(DEFAULT_SCHEDULE_ID);
  const defaultAvailableHours = getAvailableHours(DEFAULT_SCHEDULE_ID);
  const isDefaultSchedule = activeScheduleId === DEFAULT_SCHEDULE_ID;
  const isLocked = isLockedForSchedule(activeScheduleId);
  const { daySpan, setDaySpan, visibleDays, isStackedView, canGoPrev, canGoNext, goPrev, goNext } =
    useScheduleDaySpan();
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
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [dialogState, setDialogState] = useState<ScheduleTrainingDialogState>(null);
  const [detailSlot, setDetailSlot] = useState<ScheduleSlot | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState('');
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [createScheduleError, setCreateScheduleError] = useState<string | null>(null);

  useMobileActions({
    onAdd: () => {
      setShowCreateDialog(true);
      setCreateScheduleError(null);
      setNewScheduleName('');
    },
    onSettings: () => attemptNavigation(openScheduleSettings),
  });

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
    return buildTeamSlots(displayTeams, teamFilter);
  }, [displayTeams, teamFilter]);

  /** Full-schedule slots for capacity footer (ignore team filter). */
  const capacitySlots = useMemo(() => buildTeamSlots(displayTeams, []), [displayTeams]);

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

  const handleSlotClick = useCallback((slot: ScheduleSlot) => {
    setDetailSlot(slot);
  }, []);

  const handleNavigateToTeam = useCallback(
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

  const columnOrdersByDay = settings.columnOrders?.[DEFAULT_SCHEDULE_ID] ?? {};

  const handleColumnOrderChange = useCallback(
    (day: string, order: string[]) => {
      if (isLocked) {
        return;
      }
      void setColumnOrder(DEFAULT_SCHEDULE_ID, day, order);
    },
    [isLocked, setColumnOrder],
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

  const handleCopySlot = useCallback(
    (slot: ScheduleSlot) => {
      if (isLocked) {
        return;
      }
      setDialogState({ mode: 'copy', slot });
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

  const preferredTeamId = getPreferredTeamIdFromFilter(teamFilter);

  if (scheduleContentView === 'settings') {
    return (
      <div className="plugin-schedule min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          <ScheduleSettingsView
            schedulePlans={schedulePlans}
            defaultScheduleDirty={isDirty}
            onDiscardDefaultChanges={discard}
            onClose={() => attemptNavigation(closeScheduleSettingsView)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-schedule min-h-full overflow-x-hidden bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="hidden min-w-0 space-y-1 md:block">
            <div className="flex items-center gap-2">
              <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.schedule')}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t('schedule.listDescription')}</p>
          </div>
          <div className="flex w-full shrink-0 items-center gap-2 md:w-auto md:gap-1">
            {isDefaultSchedule && isDirty && !isLocked ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 flex-1 md:flex-initial px-3 text-xs"
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
                  className="h-9 flex-1 md:flex-initial border-none bg-green-600 px-3 text-xs text-white hover:bg-green-700"
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
                  className="h-9 flex-1 md:flex-initial gap-1.5 px-3 text-xs font-semibold"
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
              className="hidden h-9 px-2.5 text-xs md:inline-flex md:flex-initial"
              onClick={() => attemptNavigation(openScheduleSettings)}
              aria-label={t('schedule.settings.title')}
              title={t('schedule.settings.title')}
            >
              <span className="hidden sm:inline">{t('schedule.settings.title')}</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Plus}
              className="hidden h-9 px-3 text-xs md:inline-flex md:flex-initial"
              onClick={() => {
                setShowCreateDialog(true);
                setCreateScheduleError(null);
                setNewScheduleName('');
              }}
              aria-label={t('schedule.newSchedule')}
            >
              <span className="hidden sm:inline">{t('schedule.newSchedule')}</span>
            </Button>
          </div>
        </div>

        <div className={LIST_FILTER_CHIP_ROW_CLASS}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTeamFilter([])}
            className={cn(
              teamFilter.length === 0 ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
            )}
          >
            <Users className="h-3.5 w-3.5" />
            <span>
              {t('schedule.filterAll')}{' '}
              <span className="tabular-nums font-semibold">({teams.length})</span>
            </span>
          </Button>
          {teams.map((team) => {
            const teamId = String(team.id);
            const isActive = teamFilter.includes(teamId);
            return (
              <Button
                key={team.id}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={isActive}
                onClick={() => setTeamFilter((prev) => toggleScheduleTeamFilter(prev, teamId))}
                className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
              >
                <Users className="h-3.5 w-3.5" />
                <span className="truncate">{formatTeamLabel(team)}</span>
              </Button>
            );
          })}
        </div>

        {isDefaultSchedule ? (
          <Card className="rounded-xl border-0 bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                  {activeScheduleName}
                </h3>
                <ScheduleLockToggle
                  locked={isLocked}
                  disabled={isTogglingLock}
                  onToggle={(nextLocked) => setLockedForSchedule(activeScheduleId, nextLocked)}
                />
              </div>
              {!isMobile ? (
                <ScheduleDaySpanToggle
                  daySpan={daySpan}
                  onSelect={setDaySpan}
                  canGoPrev={canGoPrev}
                  canGoNext={canGoNext}
                  onPrev={goPrev}
                  onNext={goNext}
                />
              ) : null}
            </div>
            {saveError ? <p className="mb-2 text-xs text-destructive">{saveError}</p> : null}
            {isGridSettingsLoading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : isMobile || isStackedView ? (
              <ScheduleWeekView slots={weekSlots} onSlotClick={handleSlotClick} />
            ) : (
              <ScheduleTimeGrid
                slots={weekSlots}
                gridSettings={defaultGridSettings}
                savingSlotId={null}
                readOnly={isLocked}
                visibleDays={visibleDays}
                columnOrdersByDay={columnOrdersByDay}
                onColumnOrderChange={isLocked ? undefined : handleColumnOrderChange}
                getSlotHighlight={isLocked ? undefined : getSlotHighlight}
                onSlotClick={handleSlotClick}
                onEditSlot={isLocked ? undefined : handleEditSlot}
                onCopySlot={isLocked ? undefined : handleCopySlot}
                onAddSlot={isLocked ? undefined : handleAddSlot}
                onUnlock={
                  isLocked ? () => setLockedForSchedule(activeScheduleId, false) : undefined
                }
                onSlotMove={handleSlotMove}
              />
            )}
            {!isGridSettingsLoading ? (
              <ScheduleFooter slots={capacitySlots} availableHours={defaultAvailableHours} />
            ) : null}
          </Card>
        ) : (
          <PlanView
            scheduleId={activeScheduleId}
            scheduleName={activeScheduleName}
            teamFilter={teamFilter}
            schedulePlans={schedulePlans}
            daySpan={daySpan}
            onDaySpanChange={setDaySpan}
            visibleDays={visibleDays}
            isStackedView={isStackedView}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onPrevDaySpan={goPrev}
            onNextDaySpan={goNext}
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
            <AlertDialogRoundCancel disabled={isCreatingSchedule} />
            <AlertDialogAction asChild onClick={(event) => event.preventDefault()}>
              <DialogSaveButton
                label={isCreatingSchedule ? t('common.saving') : t('common.save')}
                disabled={!newScheduleName.trim() || isCreatingSchedule}
                onClick={() => void handleCreateSchedule()}
              />
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

      <ScheduleSlotDetailDialog
        isOpen={detailSlot !== null}
        slot={detailSlot}
        isLocked={isLocked}
        onClose={() => setDetailSlot(null)}
        onEdit={isLocked ? undefined : handleEditSlot}
        onNavigateToTeam={handleNavigateToTeam}
      />
    </div>
  );
}
