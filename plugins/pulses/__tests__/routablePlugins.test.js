const {
  listCandidatePluginsFromReq,
  normalizeRoutablePluginKey,
  isRoutablePluginKey,
  humanizePluginKey,
} = require('../routablePlugins');
const { AppError } = require('../../../server/core/errors/AppError');

describe('pulses routablePlugins', () => {
  test('lists enabled plugins from the session and skips excluded keys', () => {
    const req = {
      session: {
        user: {
          plugins: ['contacts', 'settings', 'public-cups', 'tasks', 'contacts'],
        },
      },
    };
    expect(listCandidatePluginsFromReq(req)).toEqual([
      { key: 'contacts', label: 'Contacts' },
      { key: 'tasks', label: 'Tasks' },
    ]);
  });

  test('humanizePluginKey title-cases dashed names', () => {
    expect(humanizePluginKey('ai-providers')).toBe('Ai Providers');
  });

  test('normalizeRoutablePluginKey rejects plugins not enabled for the user', () => {
    const req = { session: { user: { plugins: ['contacts'] } } };
    expect(() => normalizeRoutablePluginKey('slots', req)).toThrow(AppError);
    expect(normalizeRoutablePluginKey('contacts', req)).toBe('contacts');
  });

  test('isRoutablePluginKey without req accepts non-excluded keys', () => {
    expect(isRoutablePluginKey('notes')).toBe(true);
    expect(isRoutablePluginKey('settings')).toBe(false);
  });
});
