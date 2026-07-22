import type { TFunction } from 'i18next';

/**
 * Prefer the server/provider error message so quota/billing details surface in the UI.
 */
export function resolveAudioGenerateErrorMessage(err: unknown, t: TFunction): string {
  const error = err as { status?: number; message?: string };
  const raw = String(error.message ?? '').trim();
  const lower = raw.toLowerCase();

  if (error.status === 409) {
    return t('guides.audio.alreadyProcessing');
  }
  if (error.status === 400 && lower.includes('approved')) {
    return t('guides.audio.requiresApproval');
  }
  if (error.status === 400 && (lower.includes('presentationtext') || lower.includes('text'))) {
    return t('guides.audio.noPresentationText');
  }
  if (raw && raw !== 'Request failed' && raw !== 'Network error') {
    return raw;
  }
  return t('guides.audio.actionFailed');
}
