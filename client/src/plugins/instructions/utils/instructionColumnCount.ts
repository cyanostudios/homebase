export type InstructionColumnCount = 1 | 2 | 3;

export const INSTRUCTIONS_COLUMN_COUNT_STORAGE_KEY = 'instructions:columnCount';
export const INSTRUCTIONS_SETTINGS_KEY = 'instructions';

export function resolveInstructionColumnCount(settings: unknown): InstructionColumnCount {
  const raw =
    settings && typeof settings === 'object'
      ? (settings as { columnCount?: unknown }).columnCount
      : undefined;
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 3) {
    return n;
  }
  return 2;
}

export function getInitialInstructionColumnCount(): InstructionColumnCount {
  if (typeof window === 'undefined') {
    return 2;
  }
  const stored = window.sessionStorage.getItem(INSTRUCTIONS_COLUMN_COUNT_STORAGE_KEY);
  const n = Number(stored);
  if (n === 1 || n === 2 || n === 3) {
    return n;
  }
  return 2;
}
