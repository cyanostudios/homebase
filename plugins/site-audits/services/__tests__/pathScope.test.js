const { isInPathScope, pathScopeFromStartUrl } = require('../pathScope');

describe('pathScopeFromStartUrl', () => {
  test('root means whole site', () => {
    expect(pathScopeFromStartUrl('https://www.example.com/')).toBeNull();
    expect(pathScopeFromStartUrl('https://www.example.com')).toBeNull();
  });

  test('strips trailing slash on a section path', () => {
    expect(pathScopeFromStartUrl('https://www.concentrix.com/nordics-baltics/')).toBe(
      '/nordics-baltics',
    );
    expect(pathScopeFromStartUrl('https://www.concentrix.com/nordics-baltics')).toBe(
      '/nordics-baltics',
    );
  });

  test('keeps nested paths', () => {
    expect(pathScopeFromStartUrl('https://example.com/a/b/c')).toBe('/a/b/c');
  });
});

describe('isInPathScope', () => {
  const scope = '/nordics-baltics';

  test('null scope allows everything', () => {
    expect(isInPathScope('https://example.com/anywhere', null)).toBe(true);
  });

  test('exact section and children match', () => {
    expect(isInPathScope('https://www.concentrix.com/nordics-baltics', scope)).toBe(true);
    expect(isInPathScope('https://www.concentrix.com/nordics-baltics/', scope)).toBe(true);
    expect(isInPathScope('https://www.concentrix.com/nordics-baltics/offices', scope)).toBe(true);
  });

  test('sibling and parent paths do not match', () => {
    expect(isInPathScope('https://www.concentrix.com/', scope)).toBe(false);
    expect(isInPathScope('https://www.concentrix.com/about', scope)).toBe(false);
    expect(isInPathScope('https://www.concentrix.com/nordics-baltics-extra', scope)).toBe(false);
  });
});
