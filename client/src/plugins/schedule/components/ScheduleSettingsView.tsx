import { ArrowUpToLine, Clock, Download, Eraser, Lock, Trash2, Unlock } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { useTeams } from '@/plugins/teams/hooks/useTeams';

import { scheduleApi } from '../api/scheduleApi';
import { useSchedule } from '../hooks/useSchedule';
import type { SchedulePlansState } from '../hooks/useSchedulePlans';
import { useScheduleSettings } from '../hooks/useScheduleSettings';
import {
  buildScheduleEventPayload,
  DEFAULT_SCHEDULE_ID,
  normalizeScheduleGridSettings,
  type ScheduleGridSettings,
} from '../types/schedule';

const LOCK_BUTTON_CLASS =
  'h-9 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30';
const UNLOCK_BUTTON_CLASS =
  'h-9 px-3 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30';

function ScheduleTitleWithLockStatus({ name, locked }: { name: string; locked: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate">{name}</span>
      {locked ? (
        <span title={t('schedule.lockedBadge')}>
          <Lock
            className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400"
            aria-label={t('schedule.lockedBadge')}
          />
        </span>
      ) : (
        <span title={t('schedule.settings.unlock')}>
          <Unlock
            className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400"
            aria-label={t('schedule.settings.unlock')}
          />
        </span>
      )}
    </div>
  );
}

interface ScheduleSettingsViewProps {
  inlineTrailing?: React.ReactNode;
  schedulePlans: SchedulePlansState;
  defaultScheduleDirty?: boolean;
  onDiscardDefaultChanges?: () => void;
}

function ScheduleGridHoursFields({
  scheduleId,
  gridSettings,
  isSaving,
  isLocked,
  onSave,
}: {
  scheduleId: string;
  gridSettings: ScheduleGridSettings;
  isSaving: boolean;
  isLocked: boolean;
  onSave: (scheduleId: string, next: ScheduleGridSettings) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(gridSettings);
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    setDraft(gridSettings);
  }, [gridSettings]);

  const handleSave = useCallback(async () => {
    const normalized = normalizeScheduleGridSettings(draft);
    setSavingHours(true);
    try {
      await onSave(scheduleId, normalized);
    } finally {
      setSavingHours(false);
    }
  }, [draft, onSave, scheduleId]);

  const isDirty =
    draft.startHour !== gridSettings.startHour || draft.endHour !== gridSettings.endHour;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('schedule.settings.gridHoursHint')}</p>
      <div className="flex max-w-lg flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label className="text-xs">{t('schedule.settings.startHourLabel')}</Label>
          <Input
            type="number"
            min={0}
            max={23}
            value={draft.startHour}
            onChange={(event) =>
              setDraft((prev) =>
                normalizeScheduleGridSettings({
                  ...prev,
                  startHour: Number(event.target.value),
                }),
              )
            }
            className="h-9 w-24"
            disabled={isLocked}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">{t('schedule.settings.endHourLabel')}</Label>
          <Input
            type="number"
            min={1}
            max={24}
            value={draft.endHour}
            onChange={(event) =>
              setDraft((prev) =>
                normalizeScheduleGridSettings({
                  ...prev,
                  endHour: Number(event.target.value),
                }),
              )
            }
            className="h-9 w-24"
            disabled={isLocked}
          />
        </div>
        {isDirty && !isLocked ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 shrink-0 px-3 text-xs"
            disabled={isSaving || savingHours}
            onClick={() => void handleSave()}
          >
            {savingHours ? t('common.saving') : t('common.save')}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('schedule.settings.gridHoursPreview', {
          start: String(draft.startHour).padStart(2, '0'),
          end: String(draft.endHour).padStart(2, '0'),
        })}
      </p>
    </div>
  );
}

export function ScheduleSettingsView({
  inlineTrailing,
  schedulePlans,
  defaultScheduleDirty = false,
  onDiscardDefaultChanges,
}: ScheduleSettingsViewProps) {
  const { t } = useTranslation();
  const { teams, saveTeamTrainingTimes } = useTeams();
  const { activeScheduleId, setActiveScheduleId } = useSchedule();
  const {
    plans,
    renamePlan,
    deletePlan,
    addPlanEventCount,
    setPlanEventCount,
    bumpPlanEventsRevision,
  } = schedulePlans;
  const {
    getGridSettingsForSchedule,
    setGridSettingsForSchedule,
    isLoading,
    isSaving,
    isTogglingLock,
    isLockedForSchedule,
    setLockedForSchedule,
  } = useScheduleSettings();
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [planToDelete, setPlanToDelete] = useState<{ id: string; name: string } | null>(null);
  const [planToClear, setPlanToClear] = useState<{ id: string; name: string } | null>(null);
  const [planToTransfer, setPlanToTransfer] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [clearingPlanId, setClearingPlanId] = useState<string | null>(null);
  const [transferringPlanId, setTransferringPlanId] = useState<string | null>(null);
  const [importingPlanId, setImportingPlanId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{
    planId: string;
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleRename = useCallback(
    async (id: string) => {
      const name = (renameDrafts[id] ?? '').trim();
      if (!name) {
        return;
      }
      setRenamingId(id);
      try {
        await renamePlan(id, name);
        setRenameDrafts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } finally {
        setRenamingId(null);
      }
    },
    [renameDrafts, renamePlan],
  );

  const handleDeletePlan = useCallback(async () => {
    if (!planToDelete) {
      return;
    }
    setIsDeleting(true);
    try {
      await deletePlan(planToDelete.id);
      if (activeScheduleId === planToDelete.id) {
        setActiveScheduleId(DEFAULT_SCHEDULE_ID);
      }
      setPlanToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }, [activeScheduleId, deletePlan, planToDelete, setActiveScheduleId]);

  const handleClearPlanEvents = useCallback(async () => {
    if (!planToClear) {
      return;
    }
    setIsClearing(true);
    setClearingPlanId(planToClear.id);
    try {
      await scheduleApi.clearAllEvents(planToClear.id);
      setPlanEventCount(planToClear.id, 0);
      bumpPlanEventsRevision(planToClear.id);
      setPlanToClear(null);
    } catch {
      setImportMessage({
        planId: planToClear.id,
        type: 'error',
        text: t('schedule.clearAllEventsError'),
      });
      setPlanToClear(null);
    } finally {
      setIsClearing(false);
      setClearingPlanId(null);
    }
  }, [bumpPlanEventsRevision, planToClear, setPlanEventCount, t]);

  const handleTransferToDefault = useCallback(async () => {
    if (!planToTransfer) {
      return;
    }

    if (isLockedForSchedule(DEFAULT_SCHEDULE_ID)) {
      setImportMessage({
        planId: planToTransfer.id,
        type: 'error',
        text: t('schedule.transferToDefaultLockedError'),
      });
      setPlanToTransfer(null);
      return;
    }

    setIsTransferring(true);
    setTransferringPlanId(planToTransfer.id);
    setImportMessage(null);

    try {
      const byTeam = await scheduleApi.getEventsGroupedByTeam(planToTransfer.id);
      const entries = Object.entries(byTeam);
      const results = await Promise.all(
        entries.map(([teamId, times]) => saveTeamTrainingTimes(teamId, times)),
      );

      if (!results.every(Boolean)) {
        setImportMessage({
          planId: planToTransfer.id,
          type: 'error',
          text: t('schedule.transferToDefaultError'),
        });
        return;
      }

      onDiscardDefaultChanges?.();
      setImportMessage({
        planId: planToTransfer.id,
        type: 'success',
        text: t('schedule.transferToDefaultDone', { count: entries.length }),
      });
    } catch {
      setImportMessage({
        planId: planToTransfer.id,
        type: 'error',
        text: t('schedule.transferToDefaultError'),
      });
    } finally {
      setIsTransferring(false);
      setTransferringPlanId(null);
      setPlanToTransfer(null);
    }
  }, [isLockedForSchedule, onDiscardDefaultChanges, planToTransfer, saveTeamTrainingTimes, t]);

  const handleImportFromTeams = useCallback(
    async (planId: string) => {
      setImportingPlanId(planId);
      setImportMessage(null);
      try {
        let importedCount = 0;
        for (const team of teams) {
          const teamId = String(team.id);
          const trainingTimes = team.training_times ?? [];
          for (const training of trainingTimes) {
            await scheduleApi.createEvent(
              planId,
              buildScheduleEventPayload(teamId, training, teams),
            );
            importedCount += 1;
          }
        }
        addPlanEventCount(planId, importedCount);
        setImportMessage({
          planId,
          type: 'success',
          text: t('schedule.importFromTeamsDone', { count: importedCount }),
        });
      } catch {
        setImportMessage({
          planId,
          type: 'error',
          text: t('schedule.importFromTeamsError'),
        });
      } finally {
        setImportingPlanId(null);
      }
    },
    [addPlanEventCount, t, teams],
  );

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  const defaultLocked = isLockedForSchedule(DEFAULT_SCHEDULE_ID);
  const defaultGridSettings = getGridSettingsForSchedule(DEFAULT_SCHEDULE_ID);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div className="flex flex-shrink-0 items-center justify-between">
          <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
            <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
              {t('schedule.settings.title')}
            </h2>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">{inlineTrailing}</div>
        </div>

        <Card padding="md" className="overflow-hidden border border-border/70 bg-card shadow-sm">
          <DetailSection
            title={
              <ScheduleTitleWithLockStatus
                name={t('schedule.defaultScheduleName')}
                locked={defaultLocked}
              />
            }
            className="pt-0"
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('schedule.defaultScheduleInfo')}</p>
              <DetailSection
                title={
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{t('schedule.settings.gridHoursSection')}</span>
                  </div>
                }
                className="pt-0"
              >
                <ScheduleGridHoursFields
                  scheduleId={DEFAULT_SCHEDULE_ID}
                  gridSettings={defaultGridSettings}
                  isSaving={isSaving}
                  isLocked={defaultLocked}
                  onSave={setGridSettingsForSchedule}
                />
              </DetailSection>
              <div className="flex flex-wrap items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    {defaultLocked ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Unlock}
                        className={UNLOCK_BUTTON_CLASS}
                        disabled={isTogglingLock}
                        onClick={() => void setLockedForSchedule(DEFAULT_SCHEDULE_ID, false)}
                      >
                        {isTogglingLock ? t('common.saving') : t('schedule.settings.unlock')}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Lock}
                        className={LOCK_BUTTON_CLASS}
                        disabled={isTogglingLock}
                        onClick={() => void setLockedForSchedule(DEFAULT_SCHEDULE_ID, true)}
                      >
                        {isTogglingLock ? t('common.saving') : t('schedule.settings.lock')}
                      </Button>
                    )}
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {defaultLocked
                      ? t('schedule.settings.lockHintLocked')
                      : t('schedule.settings.lockHintUnlocked')}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </DetailSection>
        </Card>

        {plans.map((plan) => {
          const planLocked = isLockedForSchedule(plan.id);
          const draftName = renameDrafts[plan.id] ?? plan.name;
          const planGridSettings = getGridSettingsForSchedule(plan.id);
          return (
            <Card
              key={plan.id}
              padding="md"
              className="overflow-hidden border border-border/70 bg-card shadow-sm"
            >
              <DetailSection
                title={<ScheduleTitleWithLockStatus name={draftName} locked={planLocked} />}
                className="pt-0"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{t('schedule.scheduleName')}</Label>
                    <div className="flex max-w-md gap-2">
                      <Input
                        value={draftName}
                        onChange={(event) =>
                          setRenameDrafts((prev) => ({ ...prev, [plan.id]: event.target.value }))
                        }
                        className="h-9"
                        placeholder={t('schedule.namePlaceholder')}
                        disabled={planLocked}
                      />
                      {!planLocked ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-9 shrink-0 px-3 text-xs"
                          disabled={renamingId === plan.id || !draftName.trim()}
                          onClick={() => void handleRename(plan.id)}
                        >
                          {renamingId === plan.id ? t('common.saving') : t('common.save')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <DetailSection
                    title={
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{t('schedule.settings.gridHoursSection')}</span>
                      </div>
                    }
                    className="pt-0"
                  >
                    <ScheduleGridHoursFields
                      scheduleId={plan.id}
                      gridSettings={planGridSettings}
                      isSaving={isSaving}
                      isLocked={planLocked}
                      onSave={setGridSettingsForSchedule}
                    />
                  </DetailSection>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {planLocked ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={Unlock}
                            className={UNLOCK_BUTTON_CLASS}
                            disabled={isTogglingLock}
                            onClick={() => void setLockedForSchedule(plan.id, false)}
                          >
                            {isTogglingLock ? t('common.saving') : t('schedule.settings.unlock')}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={Lock}
                            className={LOCK_BUTTON_CLASS}
                            disabled={isTogglingLock}
                            onClick={() => void setLockedForSchedule(plan.id, true)}
                          >
                            {isTogglingLock ? t('common.saving') : t('schedule.settings.lock')}
                          </Button>
                        )}
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {planLocked
                          ? t('schedule.settings.lockHintLocked')
                          : t('schedule.settings.lockHintUnlocked')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={ArrowUpToLine}
                          className="h-9 px-3 text-xs"
                          disabled={transferringPlanId === plan.id}
                          onClick={() => setPlanToTransfer({ id: plan.id, name: plan.name })}
                        >
                          {transferringPlanId === plan.id
                            ? t('common.loading')
                            : t('schedule.transferToDefault')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {t('schedule.transferToDefaultHint')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={Download}
                          className="h-9 px-3 text-xs"
                          disabled={importingPlanId === plan.id}
                          onClick={() => void handleImportFromTeams(plan.id)}
                        >
                          {importingPlanId === plan.id
                            ? t('common.loading')
                            : t('schedule.importFromTeams')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {t('schedule.importFromTeamsHint')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={Eraser}
                          className="h-9 px-3 text-xs"
                          disabled={clearingPlanId === plan.id}
                          onClick={() => setPlanToClear({ id: plan.id, name: plan.name })}
                        >
                          {clearingPlanId === plan.id
                            ? t('common.loading')
                            : t('schedule.clearAllEvents')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {t('schedule.clearAllEventsHint')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={Trash2}
                          className="h-9 px-3 text-xs text-destructive hover:text-destructive"
                          onClick={() => setPlanToDelete({ id: plan.id, name: plan.name })}
                        >
                          {t('schedule.deleteSchedule')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {t('schedule.deleteScheduleConfirm', { name: plan.name })}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {importMessage?.planId === plan.id ? (
                    <p
                      className={
                        importMessage.type === 'error'
                          ? 'text-xs text-destructive'
                          : 'text-xs text-muted-foreground'
                      }
                    >
                      {importMessage.text}
                    </p>
                  ) : null}
                </div>
              </DetailSection>
            </Card>
          );
        })}

        <ConfirmDialog
          isOpen={Boolean(planToTransfer)}
          title={t('schedule.transferToDefault')}
          message={
            planToTransfer
              ? defaultScheduleDirty
                ? t('schedule.transferToDefaultConfirmDirty', { name: planToTransfer.name })
                : t('schedule.transferToDefaultConfirm', { name: planToTransfer.name })
              : ''
          }
          confirmText={t('schedule.transferToDefault')}
          cancelText={t('common.cancel')}
          onConfirm={() => void handleTransferToDefault()}
          onCancel={() => setPlanToTransfer(null)}
          variant="warning"
          confirmDisabled={isTransferring}
        />

        <ConfirmDialog
          isOpen={Boolean(planToClear)}
          title={t('schedule.clearAllEvents')}
          message={
            planToClear ? t('schedule.clearAllEventsConfirm', { name: planToClear.name }) : ''
          }
          confirmText={t('schedule.clearAllEvents')}
          cancelText={t('common.cancel')}
          onConfirm={() => void handleClearPlanEvents()}
          onCancel={() => setPlanToClear(null)}
          variant="danger"
          confirmDisabled={isClearing}
        />

        <ConfirmDialog
          isOpen={Boolean(planToDelete)}
          title={t('schedule.deleteSchedule')}
          message={
            planToDelete ? t('schedule.deleteScheduleConfirm', { name: planToDelete.name }) : ''
          }
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          onConfirm={() => void handleDeletePlan()}
          onCancel={() => setPlanToDelete(null)}
          variant="danger"
          confirmDisabled={isDeleting}
        />
      </div>
    </TooltipProvider>
  );
}
