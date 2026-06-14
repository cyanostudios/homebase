export type OverviewCardId =
  | 'schedule'
  | 'seasonBreaks'
  | 'responsibles'
  | 'notes'
  | 'requests'
  | 'matches';

export const DEFAULT_OVERVIEW_CARD_ORDER: OverviewCardId[] = [
  'schedule',
  'seasonBreaks',
  'responsibles',
  'notes',
  'requests',
  'matches',
];

export function getAvailableOverviewCardIds(hasMatches: boolean): OverviewCardId[] {
  return DEFAULT_OVERVIEW_CARD_ORDER.filter((id) => id !== 'matches' || hasMatches);
}

export function normalizeCardOrder(stored: unknown, hasMatches: boolean): OverviewCardId[] {
  const filtered = getAvailableOverviewCardIds(hasMatches);
  if (!Array.isArray(stored)) {
    return filtered;
  }
  const valid = stored.filter(
    (id): id is OverviewCardId => typeof id === 'string' && filtered.includes(id as OverviewCardId),
  );
  const missing = filtered.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}
