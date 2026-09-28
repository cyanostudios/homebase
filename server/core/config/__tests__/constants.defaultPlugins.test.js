const { DEFAULT_USER_PLUGINS } = require('../../config/constants');

describe('DEFAULT_USER_PLUGINS', () => {
  test('is Main category plugins plus files', () => {
    expect(DEFAULT_USER_PLUGINS).toEqual(['contacts', 'notes', 'tasks', 'requests', 'files']);
  });
});
