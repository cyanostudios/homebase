import {
  getInitialListViewMode,
  persistListViewModeSession,
  resolveListViewMode,
  type ListViewMode,
} from '@/core/list/listViewMode';

export type PulseListViewMode = ListViewMode;

export const PULSES_LIST_VIEW_MODE_STORAGE_KEY = 'pulses:listViewMode';

export function resolvePulseListViewMode(
  settings:
    | {
        listViewMode?: unknown;
      }
    | null
    | undefined,
): PulseListViewMode {
  return resolveListViewMode(settings);
}

export function getInitialPulseListViewMode(): PulseListViewMode {
  return getInitialListViewMode(PULSES_LIST_VIEW_MODE_STORAGE_KEY);
}

export function persistPulseListViewModeSession(mode: PulseListViewMode): void {
  persistListViewModeSession(PULSES_LIST_VIEW_MODE_STORAGE_KEY, mode);
}
