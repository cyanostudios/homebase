import { CalendarClock, Check, Plus, Settings, Users, X } from 'lucide-react';
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
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Card } from '@/components/ui/card';
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
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';

export function ScheduleList({ isCompanion = false }: { isCompanion?: boolean } = {}) {
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
    useScheduleDaySpan({ companion: isCompanion });
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
  const [chooseScheduleOpen, setChooseScheduleOpen] = useState(false);

  useMobileActions({
    onAdd: isCompanion
      ? undefined
      : () => {
          setShowCreateDialog(true);
          setCreateScheduleError(null);
          setNewScheduleName('');
        },
    onSettings: isCompanion ? undefined : () => attemptNavigation(openScheduleSettings),
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
        setChooseScheduleOpen(false);
        return;
      }
      attemptNavigation(() => {
        setActiveScheduleId(scheduleId);
        setChooseScheduleOpen(false);
      });
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

  if (scheduleContentView === 'settings' && !isCompanion) {
    return (
      <div className={cn('plugin-schedule', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
        <ScheduleSettingsView
          schedulePlans={schedulePlans}
          defaultScheduleDirty={isDirty}
          onDiscardDefaultChanges={discard}
          onClose={() => attemptNavigation(closeScheduleSettingsView)}
        />
      </div>
    );
  }

  return (
    <div className={cn('plugin-schedule', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className={isCompanion ? 'block' : 'hidden md:block'}>
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  {isCompanion ? (
                    <p className="truncate text-sm font-medium text-muted-foreground">
                      {activeScheduleName}
                    </p>
                  ) : (
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{activeScheduleName}</h2>
                  )}
                  {!isCompanion ? (
                    <ExpandableIconButton
                      icon={Settings}
                      label={t('common.settings')}
                      variant="soft"
                      onClick={() => attemptNavigation(openScheduleSettings)}
                    />
                  ) : null}
                  <RoundIconLabelButton
                    icon={CalendarClock}
                    label={t('schedule.chooseSchedule')}
                    variant={chooseScheduleOpen ? 'primary' : 'soft'}
                    alwaysExpanded
                    aria-expanded={chooseScheduleOpen}
                    onClick={() => setChooseScheduleOpen((open) => !open)}
                  />
                  <ScheduleLockToggle
                    locked={isLocked}
                    disabled={isTogglingLock}
                    onToggle={(nextLocked) => setLockedForSchedule(activeScheduleId, nextLocked)}
                  />
                  {isDefaultSchedule && isDirty && !isLocked ? (
                    <>
                      <RoundIconLabelButton
                        type="button"
                        icon={X}
                        label={t('common.cancel')}
                        variant="secondary"
                        alwaysExpanded
                        disabled={isSaving}
                        onClick={() => setShowDiscardDialog(true)}
                      />
                      <RoundIconLabelButton
                        type="button"
                        icon={Check}
                        label={isSaving ? t('common.saving') : t('common.update')}
                        variant="success"
                        alwaysExpanded
                        disabled={isSaving}
                        onClick={() => void handleCommit()}
                      />
                    </>
                  ) : null}
                </div>
              </div>
              {chooseScheduleOpen ? (
                <div className="flex flex-wrap items-center gap-1">
                  <RoundIconLabelButton
                    icon={CalendarClock}
                    label={t('schedule.defaultScheduleName')}
                    variant={isDefaultSchedule ? 'primary' : 'secondary'}
                    alwaysExpanded
                    contentClassName={
                      isDefaultSchedule ? undefined : 'text-foreground group-hover:text-primary'
                    }
                    onClick={() => handleSelectSchedule(DEFAULT_SCHEDULE_ID)}
                  />
                  {plans.map((plan) => {
                    const isActive = !isDefaultSchedule && plan.id === activeScheduleId;
                    return (
                      <RoundIconLabelButton
                        key={plan.id}
                        icon={CalendarClock}
                        label={plan.name}
                        variant={isActive ? 'primary' : 'secondary'}
                        alwaysExpanded
                        contentClassName={
                          isActive ? undefined : 'text-foreground group-hover:text-primary'
                        }
                        onClick={() => handleSelectSchedule(plan.id)}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
              <ScheduleDaySpanToggle
                daySpan={daySpan}
                onSelect={setDaySpan}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                onPrev={goPrev}
                onNext={goNext}
                companion={isCompanion}
              />
              {!isCompanion ? (
                <ExpandableIconButton
                  icon={Plus}
                  label={t('schedule.newSchedule')}
                  variant="soft"
                  alwaysExpanded
                  onClick={() => {
                    setShowCreateDialog(true);
                    setCreateScheduleError(null);
                    setNewScheduleName('');
                  }}
                />
              ) : null}
            </div>
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
            {isMobile ? (
              <div className="mb-3 flex items-center gap-2">
                <ScheduleLockToggle
                  locked={isLocked}
                  disabled={isTogglingLock}
                  onToggle={(nextLocked) => setLockedForSchedule(activeScheduleId, nextLocked)}
                />
              </div>
            ) : null}
            {saveError ? <p className="mb-2 text-xs text-destructive">{saveError}</p> : null}
            {isGridSettingsLoading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : isMobile || isStackedView ? (
              <ScheduleWeekView slots={weekSlots} onSlotClick={handleSlotClick} />
            ) : (
              <div className={isCompanion ? 'overflow-x-auto' : undefined}>
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
              </div>
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
            visibleDays={visibleDays}
            isStackedView={isStackedView}
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
