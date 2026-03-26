import type { TFunction } from 'i18next';

/**
 * Builds the confirmation message for a delete dialog.
 *
 * Each plugin passes its own entityKey (e.g. 'notes', 'tasks') so the correct
 * i18n strings are used. The keys `<entityKey>.deleteConfirmThis` and
 * `<entityKey>.deleteConfirmNamed` must exist in the translation files.
 */
export function buildDeleteMessage(t: TFunction, entityKey: string, displayName?: string): string {
  if (!displayName) {
    return t(`${entityKey}.deleteConfirmThis`);
  }
  return `${t(`${entityKey}.deleteConfirmNamed`, { name: displayName })} ${t('bulk.cannotUndo')}`;
}
