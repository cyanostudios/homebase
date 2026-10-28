const { validateAuditUrl, isPrivateIp, resolveAndAssertPublic } = require('../urlGuard');

describe('validateAuditUrl', () => {
  test('allows public http and https URLs', () => {
    expect(validateAuditUrl('https://example.com/path').ok).toBe(true);
    expect(validateAuditUrl('http://example.com/path').ok).toBe(true);
  });

  test('rejects URLs with embedded credentials', () => {
    expect(validateAuditUrl('https://user:pass@example.com/').ok).toBe(false);
  });

  test('rejects non-http(s) schemes', () => {
    expect(validateAuditUrl('ftp://example.com/').ok).toBe(false);
    expect(validateAuditUrl('file:///etc/passwd').ok).toBe(false);
  });

  test('rejects localhost and loopback hostnames', () => {
    expect(validateAuditUrl('http://localhost/').ok).toBe(false);
    expect(validateAuditUrl('http://127.0.0.1/').ok).toBe(false);
  });

  test('rejects private IPv4 literals', () => {
    expect(validateAuditUrl('http://192.168.1.10/').ok).toBe(false);
    expect(validateAuditUrl('http://10.0.0.5/').ok).toBe(false);
    expect(validateAuditUrl('http://172.16.0.1/').ok).toBe(false);
  });

  test('rejects an IPv6 loopback literal', () => {
    expect(validateAuditUrl('http://[::1]/').ok).toBe(false);
  });

  test('rejects alternate IPv4 encodings that normalize to loopback', () => {
    expect(validateAuditUrl('http://2130706433/').ok).toBe(false);
    expect(validateAuditUrl('http://0x7f000001/').ok).toBe(false);
    expect(validateAuditUrl('http://0177.0.0.1/').ok).toBe(false);
    expect(validateAuditUrl('http://127.1/').ok).toBe(false);
  });

  test('rejects IPv4-mapped IPv6 literals, including the hex form Node rewrites them to', () => {
    expect(validateAuditUrl('http://[::ffff:127.0.0.1]/').ok).toBe(false);
    expect(validateAuditUrl('http://[::ffff:7f00:1]/').ok).toBe(false);
    expect(validateAuditUrl('http://[::ffff:a9fe:a9fe]/').ok).toBe(false);
    expect(validateAuditUrl('http://[::ffff:10.0.0.1]/').ok).toBe(false);
  });

  test('rejects link-local, site-local, and documentation IPv6 literals', () => {
    expect(validateAuditUrl('http://[fea0::1]/').ok).toBe(false);
    expect(validateAuditUrl('http://[febf::1]/').ok).toBe(false);
    expect(validateAuditUrl('http://[fec0::1]/').ok).toBe(false);
    expect(validateAuditUrl('http://[2001:db8::1]/').ok).toBe(false);
  });

  test('rejects transition addresses that embed a private IPv4', () => {
    expect(validateAuditUrl('http://[64:ff9b::7f00:1]/').ok).toBe(false);
    expect(validateAuditUrl('http://[2002:7f00:1::]/').ok).toBe(false);
    expect(validateAuditUrl('http://[2002:a00:1::]/').ok).toBe(false);
  });

  test('allows a public IPv4-mapped address and a public 6to4 embedding', () => {
    expect(validateAuditUrl('http://[::ffff:8.8.8.8]/').ok).toBe(true);
    expect(validateAuditUrl('http://[2002:808:808::]/').ok).toBe(true);
  });

  test('rejects malformed URLs', () => {
    expect(validateAuditUrl('not a url').ok).toBe(false);
    expect(validateAuditUrl('').ok).toBe(false);
  });
});

describe('isPrivateIp', () => {
  test('flags private/reserved IPv4 ranges', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('172.16.5.1')).toBe(true);
    expect(isPrivateIp('192.168.0.1')).toBe(true);
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('169.254.1.1')).toBe(true);
    expect(isPrivateIp('100.64.0.1')).toBe(true); // CGNAT
  });

  test('allows public IPv4 addresses', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('93.184.216.34')).toBe(false);
  });

  test('flags IPv6 loopback, link-local and unique-local addresses', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('fd00::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
  });

  test('flags IPv4-mapped IPv6 addresses pointing at private ranges', () => {
    expect(isPrivateIp('::ffff:10.0.0.5')).toBe(true);
    expect(isPrivateIp('::ffff:7f00:1')).toBe(true);
    expect(isPrivateIp('[::ffff:a9fe:a9fe]')).toBe(true);
  });

  test('flags the whole link-local range and reserved IPv4 documentation ranges', () => {
    expect(isPrivateIp('fea0::1')).toBe(true);
    expect(isPrivateIp('febf::1')).toBe(true);
    expect(isPrivateIp('192.0.2.1')).toBe(true);
    expect(isPrivateIp('198.51.100.1')).toBe(true);
    expect(isPrivateIp('203.0.113.5')).toBe(true);
  });

  test('does not treat a public IPv4-mapped address as private', () => {
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
  });

  test('allows a public IPv6 address', () => {
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false);
  });
});

describe('resolveAndAssertPublic', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('rejects when DNS resolves only to a private address', async () => {
    const dns = require('dns');
    jest.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

    const result = await resolveAndAssertPublic('internal.example.com');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/private/i);
  });

  test('allows when DNS resolves to a public address', async () => {
    const dns = require('dns');
    jest.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);

    const result = await resolveAndAssertPublic('example.com');
    expect(result.ok).toBe(true);
    expect(result.addresses).toEqual(['8.8.8.8']);
  });

  test('fails closed when DNS lookup errors', async () => {
    const dns = require('dns');
    jest.spyOn(dns.promises, 'lookup').mockRejectedValue(new Error('ENOTFOUND'));

    const result = await resolveAndAssertPublic('does-not-exist.example');
    expect(result.ok).toBe(false);
  });

  test('rejects when DNS resolves to an IPv4-mapped or link-local IPv6 address', async () => {
    const dns = require('dns');
    const lookup = jest.spyOn(dns.promises, 'lookup');

    lookup.mockResolvedValueOnce([{ address: '::ffff:7f00:1', family: 6 }]);
    const mapped = await resolveAndAssertPublic('mapped.example.com');
    expect(mapped.ok).toBe(false);

    lookup.mockResolvedValueOnce([{ address: 'fea0::1', family: 6 }]);
    const linkLocal = await resolveAndAssertPublic('link.local.example');
    expect(linkLocal.ok).toBe(false);
  });

  test('rejects a private address when any DNS record is private', async () => {
    const dns = require('dns');
    jest.spyOn(dns.promises, 'lookup').mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.9', family: 4 },
    ]);

    const result = await resolveAndAssertPublic('mixed.example.com');
    expect(result.ok).toBe(false);
  });
});
