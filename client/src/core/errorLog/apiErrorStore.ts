/**
 * Central API error store. Persists to localStorage until user clears.
 * Used by fetch wrapper to capture API errors.
 */

const STORAGE_KEY = 'homebase-api-errors';
const MAX_ENTRIES = 200;

export interface ApiErrorEntry {
  id: string;
  message: string;
  timestamp: string;
  url?: string;
  status?: number;
  statusText?: string;
  method?: string;
  body?: string;
}

type Listener = () => void;

function loadFromStorage(): ApiErrorEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(entries: ApiErrorEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

let entries: ApiErrorEntry[] = loadFromStorage();
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getApiErrorEntries(): ApiErrorEntry[] {
  return [...entries];
}

export function getApiErrorCount(): number {
  return entries.length;
}

export function addApiError(entry: Omit<ApiErrorEntry, 'id' | 'timestamp'>): void {
  const full: ApiErrorEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  entries = [full, ...entries].slice(0, MAX_ENTRIES);
  saveToStorage(entries);
  notify();
}

export function clearApiErrors(): void {
  entries = [];
  saveToStorage(entries);
  notify();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
