/**
 * Long confirm/callback bodies for cross-plugin DuplicateDialog flows.
 * Extracted from App.tsx per guides/app-tsx-refactor-guide-for-cursor.md — behavior unchanged.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';

import { getSingularCap } from '@/core/pluginSingular';
import type { ExecuteDuplicateResult } from '@/core/types/pluginContract';
import { slotsApi } from '@/plugins/slots/api/slotsApi';

export type NoteForTaskState = {
  id: string;
  title?: string;
  content?: string;
  mentions?: unknown[];
} | null;

export type MatchForSlotState = {
  id: string;
  home_team: string;
  away_team: string;
  location?: string | null;
  start_time: string;
} | null;

type PluginContextRow = { plugin: { name: string }; context: any };

export function getDuplicateDialogDefaultName(
  currentPluginContext: any,
  currentItem: any,
  currentPlugin: { name: string } | null | undefined,
): string {
  const config = currentPluginContext?.getDuplicateConfig?.(currentItem);
  if (config) {
    return config.defaultName;
  }
  if (currentItem && currentPlugin && currentPlugin.name !== 'contacts') {
    return '';
  }
  return '';
}

export function getDuplicateDialogNameLabel(currentPluginContext: any, currentItem: any): string {
  const config = currentPluginContext?.getDuplicateConfig?.(currentItem);
  if (config) {
    return config.nameLabel;
  }
  return 'Name';
}

export function getDuplicateDialogConfirmOnly(
  currentPluginContext: any,
  currentItem: any,
  currentPlugin: { name: string } | null | undefined,
): boolean {
  const config = currentPluginContext?.getDuplicateConfig?.(currentItem);
  if (config && config.confirmOnly !== undefined) {
    return config.confirmOnly;
  }
  return currentPlugin?.name === 'estimates' || currentPlugin?.name === 'invoices';
}

export function buildDuplicateDialogOnConfirm(params: {
  currentPluginContext: any;
  currentItem: any;
  currentPlugin: { name: string } | null | undefined;
  setShowDuplicateDialog: (open: boolean) => void;
}): (newName: string) => void {
  const { currentPluginContext, currentItem, currentPlugin, setShowDuplicateDialog } = params;
  return (newName: string) => {
    if (!currentPluginContext || !currentItem) {
      setShowDuplicateDialog(false);
      return;
    }
    const executeDuplicate = currentPluginContext.executeDuplicate;
    if (typeof executeDuplicate === 'function') {
      executeDuplicate(currentItem, newName)
        .then(({ closePanel, highlightId }: ExecuteDuplicateResult) => {
          closePanel();
          if (highlightId !== null && highlightId !== undefined) {
            if (typeof currentPluginContext.setRecentlyDuplicatedNoteId === 'function') {
              currentPluginContext.setRecentlyDuplicatedNoteId(highlightId);
            }
            if (typeof currentPluginContext.setRecentlyDuplicatedTaskId === 'function') {
              currentPluginContext.setRecentlyDuplicatedTaskId(highlightId);
            }
            if (typeof currentPluginContext.setRecentlyDuplicatedEstimateId === 'function') {
              currentPluginContext.setRecentlyDuplicatedEstimateId(highlightId);
            }
            if (typeof currentPluginContext.setRecentlyDuplicatedMatchId === 'function') {
              currentPluginContext.setRecentlyDuplicatedMatchId(highlightId);
            }
            if (typeof currentPluginContext.setRecentlyDuplicatedSlotId === 'function') {
              currentPluginContext.setRecentlyDuplicatedSlotId(highlightId);
            }
          }
          setShowDuplicateDialog(false);
        })
        .catch((err: unknown) => {
          setShowDuplicateDialog(false);
          alert(
            (err as { message?: string; error?: string })?.message ??
              (err as { message?: string; error?: string })?.error ??
              'Failed to duplicate.',
          );
        });
      return;
    }
    const itemCopy = { ...currentItem };
    delete itemCopy.id;
    delete itemCopy.createdAt;
    delete itemCopy.updatedAt;
    if (currentPlugin) {
      const capName = getSingularCap(currentPlugin.name);
      const createFnName = `create${capName}`;
      const closeFnName = `close${capName}Panel`;
      const createFn = currentPluginContext[createFnName];
      const closeFn = currentPluginContext[closeFnName];
      if (createFn && closeFn) {
        createFn(itemCopy)
          .then(() => {
            closeFn();
            setShowDuplicateDialog(false);
          })
          .catch((err: unknown) => {
            setShowDuplicateDialog(false);
            alert(
              (err as { message?: string; error?: string })?.message ??
                (err as { message?: string; error?: string })?.error ??
                'Failed to duplicate.',
            );
          });
      } else {
        console.warn(`Create or close function not found for plugin: ${currentPlugin.name}`);
        setShowDuplicateDialog(false);
      }
    } else {
      setShowDuplicateDialog(false);
    }
  };
}

export function buildNoteToTaskOnConfirm(params: {
  noteForTask: NoteForTaskState;
  pluginContexts: PluginContextRow[];
  setShowToTaskDialog: (open: boolean) => void;
  setNoteForTask: Dispatch<SetStateAction<NoteForTaskState>>;
  attemptNavigation: (fn: () => void) => void;
  navigate: NavigateFunction;
}): (newName: string) => void {
  const {
    noteForTask,
    pluginContexts,
    setShowToTaskDialog,
    setNoteForTask,
    attemptNavigation,
    navigate,
  } = params;
  return (newName: string) => {
    if (!noteForTask) {
      setShowToTaskDialog(false);
      setNoteForTask(null);
      return;
    }
    const taskEntry = pluginContexts.find(({ plugin }) => plugin.name === 'tasks');
    const noteEntry = pluginContexts.find(({ plugin }) => plugin.name === 'notes');
    const taskContext = taskEntry?.context;
    const noteContext = noteEntry?.context;
    const createTask = taskContext?.createTask;
    const closeNotePanel = noteContext?.closeNotePanel;
    const setRecentlyDuplicatedTaskId = taskContext?.setRecentlyDuplicatedTaskId;
    if (typeof createTask !== 'function' || typeof closeNotePanel !== 'function') {
      setShowToTaskDialog(false);
      setNoteForTask(null);
      return;
    }
    const payload = {
      title: newName.trim() || 'Untitled',
      content: noteForTask.content ?? '',
      mentions: noteForTask.mentions ?? [],
      status: 'not started',
      priority: 'Medium',
      dueDate: null,
      assignedTo: null,
      createdFromNote: noteForTask.id,
    };
    createTask(payload)
      .then((newTask: { id?: string | number } | undefined) => {
        closeNotePanel();
        attemptNavigation(() => navigate('/tasks'));
        if (
          newTask?.id !== undefined &&
          newTask?.id !== null &&
          typeof setRecentlyDuplicatedTaskId === 'function'
        ) {
          setRecentlyDuplicatedTaskId(String(newTask.id));
        }
        setShowToTaskDialog(false);
        setNoteForTask(null);
      })
      .catch((err: unknown) => {
        setShowToTaskDialog(false);
        setNoteForTask(null);
        alert(
          (err as { message?: string; error?: string })?.message ??
            (err as { message?: string; error?: string })?.error ??
            'Failed to create task from note.',
        );
      });
  };
}

export function buildMatchToSlotOnConfirm(params: {
  matchForSlot: MatchForSlotState;
  pluginContexts: PluginContextRow[];
  setShowToSlotDialog: (open: boolean) => void;
  setMatchForSlot: (m: MatchForSlotState) => void;
  attemptNavigation: (fn: () => void) => void;
  navigate: NavigateFunction;
}): () => void {
  const {
    matchForSlot,
    pluginContexts,
    setShowToSlotDialog,
    setMatchForSlot,
    attemptNavigation,
    navigate,
  } = params;
  return () => {
    if (!matchForSlot) {
      setShowToSlotDialog(false);
      setMatchForSlot(null);
      return;
    }
    const matchEntry = pluginContexts.find(({ plugin }) => plugin.name === 'matches');
    const slotsEntry = pluginContexts.find(({ plugin }) => plugin.name === 'slots');
    const matchContext = matchEntry?.context;
    const slotsContext = slotsEntry?.context;
    const closeMatchPanel = matchContext?.closeMatchPanel;
    const setRecentlyDuplicatedSlotId = slotsContext?.setRecentlyDuplicatedSlotId;
    const locationStr = `${matchForSlot.home_team} – ${matchForSlot.away_team}${matchForSlot.location ? ` · ${matchForSlot.location}` : ''}`;
    slotsApi
      .createSlot({
        location: locationStr,
        slot_time: matchForSlot.start_time,
        capacity: 1,
        visible: true,
        notifications_enabled: true,
        match_id: matchForSlot.id,
      })
      .then(async (newSlot) => {
        if (typeof closeMatchPanel === 'function') {
          closeMatchPanel();
        }
        const refreshSlots = slotsContext?.refreshSlots;
        if (typeof refreshSlots === 'function') {
          await refreshSlots();
        }
        attemptNavigation(() => navigate('/slots'));
        if (newSlot?.id !== undefined && typeof setRecentlyDuplicatedSlotId === 'function') {
          setRecentlyDuplicatedSlotId(String(newSlot.id));
        }
        setShowToSlotDialog(false);
        setMatchForSlot(null);
      })
      .catch((err: unknown) => {
        setShowToSlotDialog(false);
        setMatchForSlot(null);
        alert(
          (err as { message?: string; error?: string })?.message ??
            (err as { message?: string; error?: string })?.error ??
            'Failed to create slot from match.',
        );
      });
  };
}
