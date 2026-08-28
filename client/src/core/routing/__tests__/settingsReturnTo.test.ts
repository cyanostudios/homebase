import { navPageToPath } from '@/core/routing/routeMap';
import {
  SETTINGS_RETURN_TO_KEY,
  clearSettingsReturnPath,
  isSafeSettingsReturnPath,
  navigateToSettings,
  readSettingsReturnPath,
  rememberSettingsReturnPath,
} from '@/core/routing/settingsReturnTo';

describe('settingsReturnTo', () => {
  const store = new Map<string, string>();

  beforeAll(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => {
          store.clear();
        },
      },
    });
  });

  beforeEach(() => {
    store.clear();
  });

  it('accepts app paths and rejects settings / open redirects', () => {
    expect(isSafeSettingsReturnPath('/tasks')).toBe(true);
    expect(isSafeSettingsReturnPath('/teams/abc?tab=1')).toBe(true);
    expect(isSafeSettingsReturnPath(navPageToPath.settings)).toBe(false);
    expect(isSafeSettingsReturnPath('/settings?x=1')).toBe(false);
    expect(isSafeSettingsReturnPath('//evil.example')).toBe(false);
    expect(isSafeSettingsReturnPath('https://evil.example')).toBe(false);
  });

  it('persists and clears return path in sessionStorage', () => {
    rememberSettingsReturnPath('/contacts');
    expect(store.get(SETTINGS_RETURN_TO_KEY)).toBe('/contacts');
    expect(readSettingsReturnPath()).toBe('/contacts');
    clearSettingsReturnPath();
    expect(readSettingsReturnPath()).toBe(null);
  });

  it('navigateToSettings passes from state and remembers path', () => {
    const navigate = jest.fn();
    navigateToSettings(navigate, '/notes/hello');
    expect(navigate).toHaveBeenCalledWith(navPageToPath.settings, {
      state: { from: '/notes/hello' },
    });
    expect(readSettingsReturnPath()).toBe('/notes/hello');
  });

  it('navigateToSettings skips from when already on settings', () => {
    const navigate = jest.fn();
    navigateToSettings(navigate, navPageToPath.settings);
    expect(navigate).toHaveBeenCalledWith(navPageToPath.settings);
    expect(readSettingsReturnPath()).toBe(null);
  });
});
