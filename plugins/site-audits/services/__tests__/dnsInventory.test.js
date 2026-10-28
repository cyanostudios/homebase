const { hasSpf, hasDmarc } = require('../dnsInventory');

describe('dnsInventory parsers', () => {
  test('detects SPF and DMARC in TXT records', () => {
    expect(hasSpf(['v=spf1 include:_spf.google.com ~all'])).toBe(true);
    expect(hasSpf(['something else'])).toBe(false);
    expect(hasDmarc(['v=DMARC1; p=none'])).toBe(true);
    expect(hasDmarc(['v=spf1 -all'])).toBe(false);
  });
});
