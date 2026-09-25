export const LIST_TOOLBAR_COLLAPSED_STORAGE_KEY = 'homebase.listToolbar.collapsed';

/** Per-plugin keys migrated into {@link LIST_TOOLBAR_COLLAPSED_STORAGE_KEY}. */
export const LEGACY_LIST_TOOLBAR_COLLAPSED_STORAGE_KEYS = [
  'homebase.contacts.toolbar.collapsed',
  'homebase.notes.toolbar.collapsed',
  'homebase.estimates.toolbar.collapsed',
  'homebase.invoices.toolbar.collapsed',
  'homebase.tasks.toolbar.collapsed',
  'homebase.requests.toolbar.collapsed',
  'homebase.teams.toolbar.collapsed',
  'homebase.matches.toolbar.collapsed',
  'homebase.garments.toolbar.collapsed',
  'homebase.slots.toolbar.collapsed',
  'homebase.cups.toolbar.collapsed',
  'homebase.files.toolbar.collapsed',
  'homebase.ingest.toolbar.collapsed',
  'homebase.mail.toolbar.collapsed',
  'homebase.pulses.toolbar.collapsed',
  'homebase.ai-providers.toolbar.collapsed',
  'homebase.clubdesk.guides.toolbar.collapsed',
  'homebase.clubdesk.priceList.toolbar.collapsed',
  'homebase.clubdesk.inventory.toolbar.collapsed',
] as const;

function readLegacyToolbarCollapsed(): boolean | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    let foundLegacy = false;
    let anyCollapsed = false;
    for (const key of LEGACY_LIST_TOOLBAR_COLLAPSED_STORAGE_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        foundLegacy = true;
        if (raw === '1') {
          anyCollapsed = true;
        }
      }
    }
    return foundLegacy ? anyCollapsed : null;
  } catch {
    return null;
  }
}

function deleteLegacyToolbarCollapsedKeys(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    for (const key of LEGACY_LIST_TOOLBAR_COLLAPSED_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function readListToolbarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const raw = window.localStorage.getItem(LIST_TOOLBAR_COLLAPSED_STORAGE_KEY);
    if (raw !== null) {
      return raw === '1';
    }

    const legacy = readLegacyToolbarCollapsed();
    const collapsed = legacy ?? false;
    writeListToolbarCollapsed(collapsed);
    if (legacy !== null) {
      deleteLegacyToolbarCollapsedKeys();
    }
    return collapsed;
  } catch {
    return false;
  }
}

export function writeListToolbarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(LIST_TOOLBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}
