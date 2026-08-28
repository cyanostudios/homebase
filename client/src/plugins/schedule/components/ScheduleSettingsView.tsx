import { ArrowUpToLine, CalendarClock, Copy, Download, Eraser, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import type { DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';
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

import { ScheduleLockToggle } from './ScheduleLockToggle';

export type ScheduleSettingsCategory = 'default' | 'plans';

function ScheduleSettingsActionsRow({ actions }: { actions: DetailHeaderMenuAction[] }) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {actions.map((action) => (
        <RoundIconLabelButton
          key={action.id}
          icon={action.icon}
          label={action.label}
          variant={action.variant ?? 'secondary'}
          alwaysExpanded
          disabled={action.disabled}
          contentClassName={action.contentClassName}
          onClick={action.onClick}
        />
      ))}
    </div>
  );
}

function ScheduleTitleWithLockStatus({
  name,
  locked,
  disabled,
  onToggle,
}: {
  name: string;
  locked: boolean;
  disabled?: boolean;
  onToggle: (nextLocked: boolean) => void | boolean | Promise<void | boolean>;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={cn(PLUGIN_PAGE_TITLE_CLASS, 'truncate text-xl')}>{name}</span>
      <ScheduleLockToggle locked={locked} disabled={disabled} onToggle={onToggle} />
    </div>
  );
}

interface ScheduleSettingsViewProps {
  onClose?: () => void;
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
          <SettingsHeaderSaveButton
            onClick={() => void handleSave()}
            isSaving={savingHours}
            disabled={isSaving}
          />
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

function ScheduleAvailableHoursFields({
  scheduleId,
  availableHours,
  isSaving,
  isLocked,
  onSave,
}: {
  scheduleId: string;
  availableHours?: number;
  isSaving: boolean;
  isLocked: boolean;
  onSave: (scheduleId: string, hours: number | null) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(availableHours != null ? String(availableHours) : '');
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    setDraft(availableHours != null ? String(availableHours) : '');
  }, [availableHours]);

  const parsedDraft = draft.trim() === '' ? null : Number(draft);
  const normalizedDraft =
    parsedDraft != null && Number.isFinite(parsedDraft) && parsedDraft >= 0
      ? Math.min(168, Math.round(parsedDraft * 100) / 100)
      : null;
  const isDirty =
    (availableHours == null && normalizedDraft != null) ||
    (availableHours != null && normalizedDraft == null) ||
    (availableHours != null && normalizedDraft != null && availableHours !== normalizedDraft);

  const handleSave = useCallback(async () => {
    setSavingHours(true);
    try {
      await onSave(scheduleId, normalizedDraft);
    } finally {
      setSavingHours(false);
    }
  }, [normalizedDraft, onSave, scheduleId]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('schedule.availableHoursHint')}</p>
      <div className="flex max-w-lg flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label className="text-xs">{t('schedule.availableHours')}</Label>
          <Input
            type="number"
            min={0}
            max={168}
            step={0.5}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-9 w-28"
            disabled={isLocked}
            placeholder="—"
          />
        </div>
        {isDirty && !isLocked ? (
          <SettingsHeaderSaveButton
            onClick={() => void handleSave()}
            isSaving={savingHours}
            disabled={isSaving || (draft.trim() !== '' && normalizedDraft == null)}
          />
        ) : null}
      </div>
    </div>
  );
}

export function ScheduleSettingsView({
  onClose,
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
    duplicatePlan,
    createPlan,
    addPlanEventCount,
    setPlanEventCount,
    bumpPlanEventsRevision,
  } = schedulePlans;
  const {
    getGridSettingsForSchedule,
    setGridSettingsForSchedule,
    getAvailableHours,
    setAvailableHours,
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
  const [planToDuplicate, setPlanToDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [defaultToDuplicate, setDefaultToDuplicate] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [clearingPlanId, setClearingPlanId] = useState<string | null>(null);
  const [transferringPlanId, setTransferringPlanId] = useState<string | null>(null);
  const [importingPlanId, setImportingPlanId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{
    planId: string;
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [activeCategory, setActiveCategory] = useState<ScheduleSettingsCategory>('default');

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'default',
        label: t('schedule.settingsCategories.default'),
        description: t('schedule.settingsCategories.defaultDescription'),
        icon: CalendarClock,
      },
      {
        id: 'plans',
        label: t('schedule.settingsCategories.plans'),
        description: t('schedule.settingsCategories.plansDescription'),
        icon: Copy,
      },
    ],
    [t],
  );

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

  const importTeamsToPlan = useCallback(
    async (planId: string) => {
      let importedCount = 0;
      for (const team of teams) {
        const teamId = String(team.id);
        const trainingTimes = team.training_times ?? [];
        for (const training of trainingTimes) {
          await scheduleApi.createEvent(planId, buildScheduleEventPayload(teamId, training, teams));
          importedCount += 1;
        }
      }
      addPlanEventCount(planId, importedCount);
      return importedCount;
    },
    [addPlanEventCount, teams],
  );

  const handleImportFromTeams = useCallback(
    async (planId: string) => {
      setImportingPlanId(planId);
      setImportMessage(null);
      try {
        const importedCount = await importTeamsToPlan(planId);
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
    [importTeamsToPlan, t],
  );

  const copyGridSettingsToPlan = useCallback(
    async (sourceId: string, targetId: string) => {
      const sourceGrid = getGridSettingsForSchedule(sourceId);
      await setGridSettingsForSchedule(targetId, sourceGrid);
    },
    [getGridSettingsForSchedule, setGridSettingsForSchedule],
  );

  const handleDuplicatePlan = useCallback(
    async (newName: string) => {
      if (!planToDuplicate) {
        return;
      }
      setIsDuplicating(true);
      setImportMessage(null);
      try {
        const plan = await duplicatePlan(planToDuplicate.id, newName);
        await copyGridSettingsToPlan(planToDuplicate.id, plan.id);
        setActiveScheduleId(plan.id);
        setImportMessage({
          planId: plan.id,
          type: 'success',
          text: t('schedule.duplicateScheduleDone', { name: plan.name }),
        });
        setPlanToDuplicate(null);
      } catch {
        setImportMessage({
          planId: planToDuplicate.id,
          type: 'error',
          text: t('schedule.duplicateScheduleError'),
        });
      } finally {
        setIsDuplicating(false);
      }
    },
    [copyGridSettingsToPlan, duplicatePlan, planToDuplicate, setActiveScheduleId, t],
  );

  const handleDuplicateDefaultSchedule = useCallback(
    async (newName: string) => {
      setIsDuplicating(true);
      setImportMessage(null);
      try {
        const plan = await createPlan(newName);
        await copyGridSettingsToPlan(DEFAULT_SCHEDULE_ID, plan.id);
        const importedCount = await importTeamsToPlan(plan.id);
        setActiveScheduleId(plan.id);
        setImportMessage({
          planId: plan.id,
          type: 'success',
          text: t('schedule.duplicateDefaultScheduleDone', {
            name: plan.name,
            count: importedCount,
          }),
        });
        setDefaultToDuplicate(false);
      } catch {
        setImportMessage({
          planId: DEFAULT_SCHEDULE_ID,
          type: 'error',
          text: t('schedule.duplicateScheduleError'),
        });
      } finally {
        setIsDuplicating(false);
      }
    },
    [copyGridSettingsToPlan, createPlan, importTeamsToPlan, setActiveScheduleId, t],
  );

  const defaultScheduleActions = useMemo((): DetailHeaderMenuAction[] => {
    return [
      {
        id: 'duplicate-default',
        label:
          isDuplicating && defaultToDuplicate
            ? t('common.loading')
            : t('schedule.duplicateSchedule'),
        icon: Copy,
        onClick: () => setDefaultToDuplicate(true),
        disabled: isDuplicating,
      },
    ];
  }, [defaultToDuplicate, isDuplicating, t]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  const defaultLocked = isLockedForSchedule(DEFAULT_SCHEDULE_ID);
  const defaultGridSettings = getGridSettingsForSchedule(DEFAULT_SCHEDULE_ID);

  return (
    <>
      <PluginSettingsPageShell
        title={t('schedule.settings.title')}
        subtitle={t('schedule.settingsSubtitle')}
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id as ScheduleSettingsCategory)}
        onClose={onClose}
        wrapContentInCard={false}
      >
        {activeCategory === 'default' ? (
          <Card padding="md" className={DETAIL_VIEW_CARD_CLASS}>
            <div className="space-y-6">
              <DetailSection
                title={
                  <ScheduleTitleWithLockStatus
                    name={t('schedule.defaultScheduleName')}
                    locked={defaultLocked}
                    disabled={isTogglingLock}
                    onToggle={(nextLocked) => setLockedForSchedule(DEFAULT_SCHEDULE_ID, nextLocked)}
                  />
                }
                prominentTitle
                className="pt-0"
              >
                <p className="text-sm text-muted-foreground">{t('schedule.defaultScheduleInfo')}</p>
              </DetailSection>
              <DetailSection
                title={t('schedule.settings.gridHoursSection')}
                subtleTitle
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
              <DetailSection title={t('schedule.availableHours')} subtleTitle className="pt-0">
                <ScheduleAvailableHoursFields
                  scheduleId={DEFAULT_SCHEDULE_ID}
                  availableHours={getAvailableHours(DEFAULT_SCHEDULE_ID)}
                  isSaving={isSaving}
                  isLocked={defaultLocked}
                  onSave={setAvailableHours}
                />
              </DetailSection>
              <ScheduleSettingsActionsRow actions={defaultScheduleActions} />
              {importMessage?.planId === DEFAULT_SCHEDULE_ID ? (
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
          </Card>
        ) : plans.length === 0 ? (
          <ListEmptyState message={t('schedule.settingsCategories.noPlansYet')} />
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => {
              const planLocked = isLockedForSchedule(plan.id);
              const draftName = renameDrafts[plan.id] ?? plan.name;
              const planGridSettings = getGridSettingsForSchedule(plan.id);
              const planActions: DetailHeaderMenuAction[] = [
                {
                  id: 'duplicate',
                  label:
                    isDuplicating && planToDuplicate?.id === plan.id
                      ? t('common.loading')
                      : t('schedule.duplicateSchedule'),
                  icon: Copy,
                  disabled: isDuplicating,
                  onClick: () => setPlanToDuplicate({ id: plan.id, name: plan.name }),
                },
                {
                  id: 'transfer',
                  label:
                    transferringPlanId === plan.id
                      ? t('common.loading')
                      : t('schedule.transferToDefault'),
                  icon: ArrowUpToLine,
                  disabled: transferringPlanId === plan.id,
                  onClick: () => setPlanToTransfer({ id: plan.id, name: plan.name }),
                },
                {
                  id: 'import',
                  label:
                    importingPlanId === plan.id
                      ? t('common.loading')
                      : t('schedule.importFromTeams'),
                  icon: Download,
                  disabled: importingPlanId === plan.id,
                  onClick: () => void handleImportFromTeams(plan.id),
                },
                {
                  id: 'clear',
                  label:
                    clearingPlanId === plan.id ? t('common.loading') : t('schedule.clearAllEvents'),
                  icon: Eraser,
                  variant: 'dangerSoft',
                  disabled: clearingPlanId === plan.id,
                  onClick: () => setPlanToClear({ id: plan.id, name: plan.name }),
                },
                {
                  id: 'delete',
                  label: t('schedule.deleteSchedule'),
                  icon: Trash2,
                  variant: 'danger',
                  onClick: () => setPlanToDelete({ id: plan.id, name: plan.name }),
                },
              ];

              return (
                <Card key={plan.id} padding="md" className={DETAIL_VIEW_CARD_CLASS}>
                  <div className="space-y-6">
                    <DetailSection
                      title={
                        <ScheduleTitleWithLockStatus
                          name={draftName}
                          locked={planLocked}
                          disabled={isTogglingLock}
                          onToggle={(nextLocked) => setLockedForSchedule(plan.id, nextLocked)}
                        />
                      }
                      prominentTitle
                      className="pt-0"
                    >
                      <div className="space-y-2">
                        <Label className="text-xs">{t('schedule.scheduleName')}</Label>
                        <div className="flex max-w-md flex-wrap items-center gap-2">
                          <Input
                            value={draftName}
                            onChange={(event) =>
                              setRenameDrafts((prev) => ({
                                ...prev,
                                [plan.id]: event.target.value,
                              }))
                            }
                            className="h-9 min-w-[12rem] flex-1"
                            placeholder={t('schedule.namePlaceholder')}
                            disabled={planLocked}
                          />
                          {!planLocked ? (
                            <SettingsHeaderSaveButton
                              onClick={() => void handleRename(plan.id)}
                              isSaving={renamingId === plan.id}
                              disabled={!draftName.trim()}
                            />
                          ) : null}
                        </div>
                      </div>
                    </DetailSection>
                    <DetailSection
                      title={t('schedule.settings.gridHoursSection')}
                      subtleTitle
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
                    <DetailSection
                      title={t('schedule.availableHours')}
                      subtleTitle
                      className="pt-0"
                    >
                      <ScheduleAvailableHoursFields
                        scheduleId={plan.id}
                        availableHours={getAvailableHours(plan.id)}
                        isSaving={isSaving}
                        isLocked={planLocked}
                        onSave={setAvailableHours}
                      />
                    </DetailSection>
                    <ScheduleSettingsActionsRow actions={planActions} />
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
                </Card>
              );
            })}
          </div>
        )}
      </PluginSettingsPageShell>

      <DuplicateDialog
        isOpen={Boolean(planToDuplicate)}
        title={t('schedule.duplicateSchedule')}
        nameLabel={t('schedule.scheduleName')}
        defaultName={planToDuplicate ? `${t('common.copyOf')} ${planToDuplicate.name}` : ''}
        confirmText={t('schedule.duplicateSchedule')}
        onConfirm={(newName) => void handleDuplicatePlan(newName)}
        onCancel={() => setPlanToDuplicate(null)}
      />

      <DuplicateDialog
        isOpen={defaultToDuplicate}
        title={t('schedule.duplicateSchedule')}
        nameLabel={t('schedule.scheduleName')}
        defaultName={`${t('common.copyOf')} ${t('schedule.defaultScheduleName')}`}
        confirmText={t('schedule.duplicateSchedule')}
        onConfirm={(newName) => void handleDuplicateDefaultSchedule(newName)}
        onCancel={() => setDefaultToDuplicate(false)}
      />

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
        message={planToClear ? t('schedule.clearAllEventsConfirm', { name: planToClear.name }) : ''}
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
    </>
  );
}
