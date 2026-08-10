export type AIProvidersColumnCount = 1 | 2 | 3;

export const AI_PROVIDERS_SETTINGS_KEY = 'ai-providers';
export const AI_PROVIDERS_COLUMN_COUNT_STORAGE_KEY = 'ai-providers:columnCount';

export function isAIProvidersColumnCount(value: unknown): value is AIProvidersColumnCount {
  return value === 1 || value === 2 || value === 3;
}

/** Prefer columnCount; migrate legacy viewMode (grid→3, list→1). Default 1. */
export function resolveAIProvidersColumnCount(
  settings:
    | {
        columnCount?: unknown;
        viewMode?: unknown;
      }
    | null
    | undefined,
): AIProvidersColumnCount {
  if (isAIProvidersColumnCount(settings?.columnCount)) {
    return settings.columnCount;
  }
  if (
    typeof settings?.columnCount === 'string' &&
    isAIProvidersColumnCount(Number(settings.columnCount))
  ) {
    return Number(settings.columnCount) as AIProvidersColumnCount;
  }
  if (settings?.viewMode === 'grid') {
    return 3;
  }
  return 1;
}

export function parseStoredAIProvidersColumnCount(
  raw: string | null,
): AIProvidersColumnCount | null {
  if (raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return isAIProvidersColumnCount(n) ? n : null;
}

export function getInitialAIProvidersColumnCount(): AIProvidersColumnCount {
  if (typeof window === 'undefined') {
    return 1;
  }
  const fromColumn = parseStoredAIProvidersColumnCount(
    window.sessionStorage.getItem(AI_PROVIDERS_COLUMN_COUNT_STORAGE_KEY),
  );
  if (fromColumn !== null) {
    return fromColumn;
  }
  const legacy = window.sessionStorage.getItem('ai-providers:viewMode');
  if (legacy === 'grid') {
    return 3;
  }
  return 1;
}
