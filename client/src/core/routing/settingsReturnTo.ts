// Remember where to return after closing global Settings (/settings).

import { navPageToPath } from '@/core/routing/routeMap';

export const SETTINGS_RETURN_TO_KEY = 'homebase:settings-return-to';

export function isSafeSettingsReturnPath(path: string | null | undefined): path is string {
  return Boolean(
    path &&
      path.startsWith('/') &&
      !path.startsWith('//') &&
      path !== navPageToPath.settings &&
      !path.startsWith(`${navPageToPath.settings}?`) &&
      !path.startsWith(`${navPageToPath.settings}/`),
  );
}

export function rememberSettingsReturnPath(path: string): void {
  if (!isSafeSettingsReturnPath(path)) {
    return;
  }
  try {
    sessionStorage.setItem(SETTINGS_RETURN_TO_KEY, path);
  } catch {
    // ignore quota / private mode
  }
}

export function readSettingsReturnPath(): string | null {
  try {
    const stored = sessionStorage.getItem(SETTINGS_RETURN_TO_KEY);
    return isSafeSettingsReturnPath(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function clearSettingsReturnPath(): void {
  try {
    sessionStorage.removeItem(SETTINGS_RETURN_TO_KEY);
  } catch {
    // ignore
  }
}

/** Navigate to global Settings while remembering the current location for Close. */
export function navigateToSettings(
  navigate: (to: string, options?: { state?: unknown }) => void,
  currentPathWithSearch: string,
): void {
  const from = currentPathWithSearch;
  if (isSafeSettingsReturnPath(from)) {
    rememberSettingsReturnPath(from);
    navigate(navPageToPath.settings, { state: { from } });
    return;
  }
  navigate(navPageToPath.settings);
}
