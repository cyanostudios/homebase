const { assertFetchUrlAllowed, isAllowedSportadminHost } = require('../client/httpClient');

describe('SportAdmin http client host gate', () => {
  test('allows SportAdmin club hosts and CDN on the fixed list', () => {
    expect(isAllowedSportadminHost('sorgenfriff.web.sportadmin.se')).toBe(true);
    expect(isAllowedSportadminHost('cdn.sportadmin.se')).toBe(true);
    expect(isAllowedSportadminHost('portalweb.sportadmin.se')).toBe(true);
    expect(isAllowedSportadminHost('www.sorgenfriff.se')).toBe(false);
    expect(isAllowedSportadminHost('evil.example.com')).toBe(false);
  });

  test('rejects non-https and private hosts via validatePublicHttpsUrl', () => {
    expect(assertFetchUrlAllowed('http://sorgenfriff.web.sportadmin.se/').ok).toBe(false);
    expect(assertFetchUrlAllowed('https://127.0.0.1/').ok).toBe(false);
    expect(assertFetchUrlAllowed('https://sorgenfriff.web.sportadmin.se/start/').ok).toBe(true);
  });

  test('rejects arbitrary public HTTPS without matching configured siteHost', () => {
    expect(assertFetchUrlAllowed('https://evil.example.com/').ok).toBe(false);
    expect(assertFetchUrlAllowed('https://attacker.com/path').error).toMatch(
      /allowed SportAdmin host/i,
    );
  });

  test('allows configured custom club domain only as siteHost', () => {
    expect(
      assertFetchUrlAllowed('https://www.sorgenfriff.se/start/?ID=471967', {
        siteHost: 'www.sorgenfriff.se',
      }).ok,
    ).toBe(true);
    expect(
      assertFetchUrlAllowed('https://evil.example.com/', {
        siteHost: 'www.sorgenfriff.se',
      }).ok,
    ).toBe(false);
  });
});
