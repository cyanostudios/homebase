import {
  getInitialListViewMode,
  persistListViewModeSession,
  resolveListViewMode,
  type ListViewMode,
} from '@/core/list/listViewMode';

export type MailListViewMode = ListViewMode;

export const MAIL_LIST_VIEW_MODE_STORAGE_KEY = 'mail:listViewMode';

export function resolveMailListViewMode(
  settings:
    | {
        listViewMode?: unknown;
      }
    | null
    | undefined,
): MailListViewMode {
  return resolveListViewMode(settings);
}

export function getInitialMailListViewMode(): MailListViewMode {
  return getInitialListViewMode(MAIL_LIST_VIEW_MODE_STORAGE_KEY);
}

export function persistMailListViewModeSession(mode: MailListViewMode): void {
  persistListViewModeSession(MAIL_LIST_VIEW_MODE_STORAGE_KEY, mode);
}
