const { withCupappenUtm, decodeUrlEntities } = require('../lib/utm');

describe('Cupappen withCupappenUtm', () => {
  test('decodes &amp; before appending so query keys stay intact', () => {
    expect(
      withCupappenUtm('https://www.procup.se/cup/my_regteam01_skin04.php?ev=40369&amp;lang=SVE'),
    ).toBe(
      'https://www.procup.se/cup/my_regteam01_skin04.php?ev=40369&lang=SVE&utm_source=cupappen',
    );
  });

  test('appends ?utm_source on bare .htm paths', () => {
    expect(withCupappenUtm('https://www.procup.se/cup/40396.htm')).toBe(
      'https://www.procup.se/cup/40396.htm?utm_source=cupappen',
    );
  });

  test('preserves fragment after UTM', () => {
    expect(withCupappenUtm('https://cupmate.se/register?x=1&amp;y=2#frag')).toBe(
      'https://cupmate.se/register?x=1&y=2&utm_source=cupappen#frag',
    );
  });

  test('replaces existing utm_source without dropping other params', () => {
    expect(withCupappenUtm('https://example.com/a?utm_source=other&foo=1')).toBe(
      'https://example.com/a?utm_source=cupappen&foo=1',
    );
    expect(withCupappenUtm('https://example.com/a?foo=1&utm_source=other')).toBe(
      'https://example.com/a?foo=1&utm_source=cupappen',
    );
  });

  test('decodeUrlEntities turns &amp; into &', () => {
    expect(decodeUrlEntities('a=1&amp;b=2')).toBe('a=1&b=2');
  });

  test('empty input stays empty', () => {
    expect(withCupappenUtm('')).toBe('');
    expect(withCupappenUtm('   ')).toBe('');
  });
});
