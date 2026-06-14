import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTeams } from '@/plugins/teams/hooks/useTeams';
import type { Team, TrainingTime } from '@/plugins/teams/types/teams';

import { getSlotDragId, type ScheduleSlot } from '../types/schedule';

export type ScheduleSlotHighlight = 'pending' | 'saved' | null;

const SAVED_HIGHLIGHT_MS = 3000;

function trainingKey(training: TrainingTime): string {
  return `${training.day}|${training.startTime}|${training.endTime}|${training.location}`;
}

function computePendingSlotIds(
  pendingByTeamId: Record<string, TrainingTime[]>,
  teams: Team[],
): Set<string> {
  const ids = new Set<string>();
  for (const [teamId, draft] of Object.entries(pendingByTeamId)) {
    const team = teams.find((item) => String(item.id) === String(teamId));
    if (!team) {
      continue;
    }
    const original = team.training_times;
    draft.forEach((training, index) => {
      const orig = original[index];
      if (!orig || trainingKey(orig) !== trainingKey(training)) {
        ids.add(
          getSlotDragId({
            day: training.day,
            startTime: training.startTime,
            endTime: training.endTime,
            location: training.location,
            teamId,
            trainingIndex: index,
          }),
        );
      }
    });
  }
  return ids;
}

export function useSchedulePendingChanges(teams: Team[]) {
  const { saveTeamTrainingTimes } = useTeams();
  const [pendingByTeamId, setPendingByTeamId] = useState<Record<string, TrainingTime[]>>({});
  const [savedSlotIds, setSavedSlotIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayTeams = useMemo(
    () =>
      teams.map((team) => {
        const draft = pendingByTeamId[String(team.id)];
        return draft ? { ...team, training_times: draft } : team;
      }),
    [pendingByTeamId, teams],
  );

  const pendingSlotIds = useMemo(
    () => computePendingSlotIds(pendingByTeamId, teams),
    [pendingByTeamId, teams],
  );

  const isDirty = pendingSlotIds.size > 0;

  const clearSavedHighlight = useCallback(() => {
    if (savedHighlightTimeoutRef.current) {
      clearTimeout(savedHighlightTimeoutRef.current);
      savedHighlightTimeoutRef.current = null;
    }
    setSavedSlotIds(new Set());
  }, []);

  const scheduleSavedHighlight = useCallback(
    (ids: Set<string>) => {
      clearSavedHighlight();
      setSavedSlotIds(new Set(ids));
      savedHighlightTimeoutRef.current = setTimeout(() => {
        setSavedSlotIds(new Set());
        savedHighlightTimeoutRef.current = null;
      }, SAVED_HIGHLIGHT_MS);
    },
    [clearSavedHighlight],
  );

  useEffect(() => () => clearSavedHighlight(), [clearSavedHighlight]);

  const getSlotHighlight = useCallback(
    (slot: ScheduleSlot): ScheduleSlotHighlight => {
      const slotId = getSlotDragId(slot);
      if (pendingSlotIds.has(slotId)) {
        return 'pending';
      }
      if (savedSlotIds.has(slotId)) {
        return 'saved';
      }
      return null;
    },
    [pendingSlotIds, savedSlotIds],
  );

  const updateTeamTimes = useCallback(
    (teamId: string, updater: (times: TrainingTime[]) => TrainingTime[]) => {
      setSaveError(null);
      setPendingByTeamId((prev) => {
        const team = teams.find((item) => String(item.id) === String(teamId));
        if (!team) {
          return prev;
        }
        const base = prev[String(teamId)] ?? team.training_times;
        return { ...prev, [String(teamId)]: updater([...base]) };
      });
    },
    [teams],
  );

  const commit = useCallback(async () => {
    const entries = Object.entries(pendingByTeamId);
    if (!entries.length) {
      return true;
    }

    const idsToHighlight = new Set(pendingSlotIds);

    setIsSaving(true);
    setSaveError(null);

    const results = await Promise.all(
      entries.map(([teamId, times]) => saveTeamTrainingTimes(teamId, times)),
    );

    setIsSaving(false);

    if (results.every(Boolean)) {
      setPendingByTeamId({});
      setSaveError(null);
      scheduleSavedHighlight(idsToHighlight);
      return true;
    }

    return false;
  }, [pendingByTeamId, pendingSlotIds, saveTeamTrainingTimes, scheduleSavedHighlight]);

  const discard = useCallback(() => {
    setPendingByTeamId({});
    setSaveError(null);
    clearSavedHighlight();
  }, [clearSavedHighlight]);

  return {
    displayTeams,
    isDirty,
    isSaving,
    saveError,
    setSaveError,
    getSlotHighlight,
    updateTeamTimes,
    commit,
    discard,
  };
}
