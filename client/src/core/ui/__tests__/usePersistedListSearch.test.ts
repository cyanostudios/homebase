import { getPersistedListSearch, setPersistedListSearch } from '../usePersistedListSearch';

describe('persisted list search store', () => {
  test('keeps values per key', () => {
    setPersistedListSearch('jest-key-a', 'alpha');
    setPersistedListSearch('jest-key-b', 'beta');
    expect(getPersistedListSearch('jest-key-a')).toBe('alpha');
    expect(getPersistedListSearch('jest-key-b')).toBe('beta');
    expect(getPersistedListSearch('jest-key-missing')).toBe('');
  });
});
