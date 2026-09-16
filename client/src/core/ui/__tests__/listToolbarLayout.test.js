const store = {};

global.window = {
  localStorage: {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    },
  },
};

const {
  LEGACY_LIST_TOOLBAR_COLLAPSED_STORAGE_KEYS,
  LIST_TOOLBAR_COLLAPSED_STORAGE_KEY,
  readListToolbarCollapsed,
  writeListToolbarCollapsed,
} = require('../listToolbarLayout');

describe('listToolbarLayout', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('exports global storage key and legacy key list', () => {
    expect(LIST_TOOLBAR_COLLAPSED_STORAGE_KEY).toBe('homebase.listToolbar.collapsed');
    expect(LEGACY_LIST_TOOLBAR_COLLAPSED_STORAGE_KEYS.length).toBeGreaterThanOrEqual(18);
    expect(LEGACY_LIST_TOOLBAR_COLLAPSED_STORAGE_KEYS).toContain(
      'homebase.contacts.toolbar.collapsed',
    );
  });

  test('readListToolbarCollapsed defaults to expanded when no keys exist', () => {
    expect(readListToolbarCollapsed()).toBe(false);
    expect(window.localStorage.getItem(LIST_TOOLBAR_COLLAPSED_STORAGE_KEY)).toBe('0');
  });

  test('readListToolbarCollapsed returns stored global preference', () => {
    window.localStorage.setItem(LIST_TOOLBAR_COLLAPSED_STORAGE_KEY, '1');
    expect(readListToolbarCollapsed()).toBe(true);
  });

  test('migrates legacy keys with any-collapsed-wins and deletes legacy keys', () => {
    window.localStorage.setItem('homebase.contacts.toolbar.collapsed', '0');
    window.localStorage.setItem('homebase.tasks.toolbar.collapsed', '1');

    expect(readListToolbarCollapsed()).toBe(true);
    expect(window.localStorage.getItem(LIST_TOOLBAR_COLLAPSED_STORAGE_KEY)).toBe('1');
    expect(window.localStorage.getItem('homebase.contacts.toolbar.collapsed')).toBeNull();
    expect(window.localStorage.getItem('homebase.tasks.toolbar.collapsed')).toBeNull();
  });

  test('migrates legacy all-expanded to global expanded', () => {
    window.localStorage.setItem('homebase.notes.toolbar.collapsed', '0');

    expect(readListToolbarCollapsed()).toBe(false);
    expect(window.localStorage.getItem(LIST_TOOLBAR_COLLAPSED_STORAGE_KEY)).toBe('0');
    expect(window.localStorage.getItem('homebase.notes.toolbar.collapsed')).toBeNull();
  });

  test('writeListToolbarCollapsed persists value', () => {
    writeListToolbarCollapsed(true);
    expect(window.localStorage.getItem(LIST_TOOLBAR_COLLAPSED_STORAGE_KEY)).toBe('1');
    writeListToolbarCollapsed(false);
    expect(window.localStorage.getItem(LIST_TOOLBAR_COLLAPSED_STORAGE_KEY)).toBe('0');
  });
});
