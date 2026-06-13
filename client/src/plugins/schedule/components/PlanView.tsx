import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { buildSlug } from '@/core/utils/slugUtils';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import type { TrainingTime } from '@/plugins/teams/types/teams';

import { scheduleApi } from '../api/scheduleApi';
import { useScheduleSettings } from '../hooks/useScheduleSettings';
import type { SchedulePlansState } from '../hooks/useSchedulePlans';
import {
  buildPlanSlots,
  buildScheduleEventPayload,
  getSlotDragId,
  isSlotVisibleInGrid,
  type PlanEvent,
  type SchedulePlanWithEvents,
  type ScheduleSlot,
  type ScheduleTrainingDialogState,
} from '../types/schedule';

import { ScheduleTimeGrid } from './ScheduleTimeGrid';
import { ScheduleTrainingDialog } from './ScheduleTrainingDialog';

export function PlanView({
  scheduleId,
  scheduleName,
  teamFilter,
  schedulePlans,
}: {
  scheduleId: string;
  scheduleName: string;
  teamFilter: string;
  schedulePlans: SchedulePlansState;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { teams } = useTeams();
  const { addPlanEventCount, adjustPlanEventCount, eventsRevision } = schedulePlans;
  const {
    getGridSettingsForSchedule,
    isLoading: isGridSettingsLoading,
    isLockedForSchedule,
  } = useScheduleSettings();
  const gridSettings = getGridSettingsForSchedule(scheduleId);
  const isLocked = isLockedForSchedule(scheduleId);
  const [planData, setPlanData] = useState<SchedulePlanWithEvents | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingSlotId, setSavingSlotId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<ScheduleTrainingDialogState>(null);

  const loadPlan = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await scheduleApi.getSchedule(scheduleId);
      setPlanData(data);
    } catch {
      setLoadError(t('schedule.saveError'));
      setPlanData(null);
    } finally {
      setIsLoading(false);
    }
  }, [scheduleId, t]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan, eventsRevision[scheduleId]]);

  const weekSlots = useMemo(() => {
    if (!planData) {
      return [];
    }
    const slots = buildPlanSlots(planData.events, teams, teamFilter);
    return slots.filter((slot) => isSlotVisibleInGrid(slot, gridSettings));
  }, [gridSettings, planData, teamFilter, teams]);

  const handleSlotClick = useCallback(
    (slot: ScheduleSlot) => {
      if (!slot.teamId) {
        return;
      }
      const team = teams.find((item) => String(item.id) === String(slot.teamId));
      if (!team) {
        return;
      }
      navigate(`/teams/${buildSlug(team, teams, 'name')}`);
    },
    [navigate, teams],
  );

  const updateLocalEvent = useCallback((event: PlanEvent) => {
    setPlanData((prev) => {
      if (!prev) {
        return prev;
      }
      const exists = prev.events.some((item) => item.id === event.id);
      return {
        ...prev,
        events: exists
          ? prev.events.map((item) => (item.id === event.id ? event : item))
          : [...prev.events, event],
        event_count: exists ? prev.event_count : prev.event_count + 1,
      };
    });
  }, []);

  const removeLocalEvent = useCallback((eventId: string) => {
    setPlanData((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        events: prev.events.filter((item) => item.id !== eventId),
        event_count: Math.max(0, prev.event_count - 1),
      };
    });
  }, []);

  const handleSlotMove = useCallback(
    async (slot: ScheduleSlot, newDay: string, newStartTime: string, newEndTime: string) => {
      if (!slot.eventId || !planData || isLocked) {
        return;
      }

      const slotId = getSlotDragId(slot);
      setSavingSlotId(slotId);
      setSaveError(null);

      const teamId = slot.teamId ? String(slot.teamId) : '';
      const payload = buildScheduleEventPayload(
        teamId,
        {
          day: newDay,
          startTime: newStartTime,
          endTime: newEndTime,
          location: slot.location,
        },
        teams,
      );

      try {
        const updated = await scheduleApi.updateEvent(scheduleId, slot.eventId, payload);
        updateLocalEvent(updated);
      } catch {
        setSaveError(t('schedule.moveError'));
      } finally {
        setSavingSlotId(null);
      }
    },
    [isLocked, planData, scheduleId, t, teams, updateLocalEvent],
  );

  const handleAddSlot = useCallback(
    (day: string, startMinutes: number) => {
      if (isLocked) {
        return;
      }
      setDialogState({ mode: 'create', day, startMinutes });
      setSaveError(null);
    },
    [isLocked],
  );

  const handleEditSlot = useCallback(
    (slot: ScheduleSlot) => {
      if (isLocked) {
        return;
      }
      setDialogState({ mode: 'edit', slot });
      setSaveError(null);
    },
    [isLocked],
  );

  const handleCreateTraining = useCallback(
    async (teamId: string, training: TrainingTime) => {
      setSaveError(null);
      try {
        const created = await scheduleApi.createEvent(
          scheduleId,
          buildScheduleEventPayload(teamId, training, teams),
        );
        updateLocalEvent(created);
        addPlanEventCount(scheduleId, 1);
        return true;
      } catch {
        setSaveError(t('schedule.createError'));
        return false;
      }
    },
    [addPlanEventCount, scheduleId, t, teams, updateLocalEvent],
  );

  const handleUpdateTraining = useCallback(
    async (slot: ScheduleSlot, training: TrainingTime) => {
      if (!slot.eventId) {
        return false;
      }

      setSaveError(null);
      const teamId = slot.teamId ? String(slot.teamId) : '';
      try {
        const updated = await scheduleApi.updateEvent(
          scheduleId,
          slot.eventId,
          buildScheduleEventPayload(teamId, training, teams),
        );
        updateLocalEvent(updated);
        return true;
      } catch {
        setSaveError(t('schedule.saveError'));
        return false;
      }
    },
    [scheduleId, t, teams, updateLocalEvent],
  );

  const handleDeleteTraining = useCallback(
    async (slot: ScheduleSlot) => {
      if (!slot.eventId) {
        return false;
      }

      setSaveError(null);
      try {
        await scheduleApi.deleteEvent(scheduleId, slot.eventId);
        removeLocalEvent(slot.eventId);
        adjustPlanEventCount(scheduleId, -1);
        return true;
      } catch {
        setSaveError(t('schedule.deleteError'));
        return false;
      }
    },
    [adjustPlanEventCount, removeLocalEvent, scheduleId, t],
  );

  const preferredTeamId = teamFilter !== 'all' ? teamFilter : undefined;

  return (
    <>
      <Card className="rounded-xl border-0 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {scheduleName}
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
        {loadError ? <p className="mb-2 text-xs text-destructive">{loadError}</p> : null}
        {saveError ? <p className="mb-2 text-xs text-destructive">{saveError}</p> : null}
        {isLoading || isGridSettingsLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : weekSlots.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">{t('schedule.noScheduleEvents')}</p>
        ) : null}
        {!isLoading && !isGridSettingsLoading ? (
          <ScheduleTimeGrid
            slots={weekSlots}
            gridSettings={gridSettings}
            savingSlotId={savingSlotId}
            readOnly={isLocked}
            onSlotClick={handleSlotClick}
            onEditSlot={isLocked ? undefined : handleEditSlot}
            onAddSlot={isLocked ? undefined : handleAddSlot}
            onSlotMove={handleSlotMove}
          />
        ) : null}
      </Card>

      {dialogState ? (
        <ScheduleTrainingDialog
          state={dialogState}
          teams={teams}
          preferredTeamId={preferredTeamId}
          isSaving={Boolean(savingSlotId)}
          deleteConfirmText={t('schedule.deleteEventConfirm')}
          onClose={() => setDialogState(null)}
          onCreate={handleCreateTraining}
          onUpdate={handleUpdateTraining}
          onDelete={handleDeleteTraining}
        />
      ) : null}
    </>
  );
}
