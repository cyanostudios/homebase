export type AnalyticsDatePresetId =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'monthToDate'
  | 'lastQuarter'
  | 'yearToDate'
  | 'lastYear'
  | 'custom';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toUtcDateInputValue(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDaysUtc(dateInputValue: string, days: number): string {
  const base = new Date(`${dateInputValue}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) {
    throw new Error(`Invalid date: ${dateInputValue}`);
  }
  base.setUTCDate(base.getUTCDate() + days);
  return toUtcDateInputValue(base);
}

export function dateInputValueFromIso(iso: string | undefined): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return toUtcDateInputValue(d);
}

export function startOfDayUtcIso(dateInputValue: string): string {
  return new Date(`${dateInputValue}T00:00:00.000Z`).toISOString();
}

export function endOfDayUtcIso(dateInputValue: string): string {
  return new Date(`${dateInputValue}T23:59:59.999Z`).toISOString();
}

export function getPresetRangeUtcIso(
  preset: Exclude<AnalyticsDatePresetId, 'custom'>,
  now = new Date(),
): { from: string; to: string } {
  const today = toLocalDateInputValue(now);

  if (preset === 'today') {
    return { from: startOfDayUtcIso(today), to: endOfDayUtcIso(today) };
  }
  if (preset === 'yesterday') {
    const y = addDaysUtc(today, -1);
    return { from: startOfDayUtcIso(y), to: endOfDayUtcIso(y) };
  }
  if (preset === 'last7') {
    const fromDay = addDaysUtc(today, -6);
    return { from: startOfDayUtcIso(fromDay), to: endOfDayUtcIso(today) };
  }
  if (preset === 'last30') {
    const fromDay = addDaysUtc(today, -29);
    return { from: startOfDayUtcIso(fromDay), to: endOfDayUtcIso(today) };
  }
  if (preset === 'monthToDate') {
    const fromDay = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`;
    return { from: startOfDayUtcIso(fromDay), to: endOfDayUtcIso(today) };
  }
  if (preset === 'lastQuarter') {
    const fromDay = addDaysUtc(today, -89);
    return { from: startOfDayUtcIso(fromDay), to: endOfDayUtcIso(today) };
  }
  if (preset === 'yearToDate') {
    const fromDay = `${now.getFullYear()}-01-01`;
    return { from: startOfDayUtcIso(fromDay), to: endOfDayUtcIso(today) };
  }
  if (preset === 'lastYear') {
    const fromDay = addDaysUtc(today, -364);
    return { from: startOfDayUtcIso(fromDay), to: endOfDayUtcIso(today) };
  }

  // Exhaustive guard for future edits

  const _exhaustive: never = preset;
  return { from: startOfDayUtcIso(today), to: endOfDayUtcIso(today) };
}

export const ANALYTICS_DATE_PRESET_OPTIONS: Array<{ id: AnalyticsDatePresetId; label: string }> = [
  { id: 'last30', label: 'Senaste 30 dagarna' },
  { id: 'today', label: 'Idag' },
  { id: 'yesterday', label: 'Igår' },
  { id: 'last7', label: 'Senaste 7 dagarna' },
  { id: 'monthToDate', label: 'Denna månaden (hittills)' },
  { id: 'lastQuarter', label: 'Senaste kvartalet' },
  { id: 'yearToDate', label: 'Innevarande år' },
  { id: 'lastYear', label: 'Senaste året' },
  { id: 'custom', label: 'Anpassat' },
];
