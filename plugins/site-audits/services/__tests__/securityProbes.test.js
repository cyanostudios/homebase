const { matchProbeSignature, runSecurityProbes, PROBE_PATHS } = require('../securityProbes');

describe('matchProbeSignature', () => {
  test('recognizes an env file and ignores an HTML soft-200', () => {
    expect(matchProbeSignature('/.env', 'DB_PASSWORD=secret\nAPP_KEY=abc\n')).toBe('env');
    expect(matchProbeSignature('/.env', 'DB_PASSWORD=only-one\n')).toBe('env');
    expect(matchProbeSignature('/.env', 'color=blue\n')).toBeNull();
    expect(
      matchProbeSignature(
        '/.env',
        '<!DOCTYPE html><html><body>DB_PASSWORD=secret\nAPP_KEY=abc</body></html>',
      ),
    ).toBeNull();
  });

  test('recognizes git HEAD, wp-config, server-status, and phpinfo', () => {
    expect(matchProbeSignature('/.git/HEAD', 'ref: refs/heads/main\n')).toBe('git-head');
    expect(matchProbeSignature('/.git/HEAD', 'a'.repeat(40))).toBe('git-head');
    expect(matchProbeSignature('/wp-config.php', "<?php\ndefine('DB_PASSWORD', 'x');\n")).toBe(
      'wp-config',
    );
    expect(matchProbeSignature('/wp-config.php', "<?php\n$table_prefix = 'wp_';\n")).toBe(
      'wp-config',
    );
    expect(
      matchProbeSignature(
        '/wp-config.php',
        "<!DOCTYPE html><html>define('DB_PASSWORD', 'x')</html>",
      ),
    ).toBeNull();
    expect(
      matchProbeSignature('/server-status', '<h1>Apache Server Status for example.com</h1>'),
    ).toBe('server-status');
    expect(
      matchProbeSignature('/server-status', '<html><title>Not the status page</title></html>'),
    ).toBeNull();
    expect(
      matchProbeSignature('/phpinfo.php', '<title>phpinfo()</title><h1>PHP Version 8.2</h1>'),
    ).toBe('phpinfo');
    expect(matchProbeSignature('/phpinfo.php', '<html><title>Home</title></html>')).toBeNull();
  });
});

describe('runSecurityProbes', () => {
  test('requests the five paths and marks only HTTP 200 signature matches as exposed', async () => {
    const fetched = [];
    const fetchImpl = jest.fn(async (url) => {
      fetched.push(url);
      if (String(url).endsWith('/.env')) {
        return {
          statusCode: 200,
          body: 'DB_PASSWORD=a\nSECRET_KEY=b\n',
          finalUrl: url,
          headers: { 'content-type': 'text/plain' },
          ok: true,
        };
      }
      if (String(url).endsWith('/.git/HEAD')) {
        return {
          statusCode: 404,
          body: 'ref: refs/heads/main',
          finalUrl: url,
          headers: {},
          ok: false,
        };
      }
      if (String(url).endsWith('/phpinfo.php')) {
        return {
          statusCode: 403,
          body: '<title>phpinfo()</title>',
          finalUrl: url,
          headers: {},
          ok: false,
        };
      }
      if (String(url).endsWith('/server-status')) {
        return {
          statusCode: 401,
          body: 'Apache Server Status',
          finalUrl: url,
          headers: {},
          ok: false,
        };
      }
      return { statusCode: 404, body: 'missing', finalUrl: url, headers: {}, ok: false };
    });

    const probes = await runSecurityProbes('https://example.com', {
      host: 'example.com',
      fetchImpl,
      delayMs: 0,
    });

    expect(PROBE_PATHS).toEqual([
      '/.env',
      '/.git/HEAD',
      '/wp-config.php',
      '/server-status',
      '/phpinfo.php',
    ]);
    expect(fetched).toEqual(PROBE_PATHS.map((path) => `https://example.com${path}`));
    expect(probes).toHaveLength(5);
    expect(probes.find((probe) => probe.path === '/.env')).toMatchObject({
      exposed: true,
      signature: 'env',
      statusCode: 200,
    });
    expect(probes.find((probe) => probe.path === '/.env').body).toBeUndefined();
    expect(probes.find((probe) => probe.path === '/.git/HEAD').exposed).toBe(false);
    expect(probes.find((probe) => probe.path === '/phpinfo.php').exposed).toBe(false);
    expect(probes.find((probe) => probe.path === '/server-status').exposed).toBe(false);
    expect(probes.find((probe) => probe.path === '/wp-config.php').exposed).toBe(false);
  });

  test('does not treat an off-host redirect as exposed', async () => {
    const fetchImpl = jest.fn(async (url) => ({
      statusCode: 200,
      body: 'DB_PASSWORD=a\nSECRET_KEY=b\nref: refs/heads/main\n',
      finalUrl: `https://evil.example${new URL(url).pathname}`,
      headers: { 'content-type': 'text/plain' },
      ok: true,
    }));

    const probes = await runSecurityProbes('https://example.com', {
      host: 'example.com',
      fetchImpl,
      delayMs: 0,
    });

    expect(probes.every((probe) => probe.exposed === false)).toBe(true);
    expect(probes.every((probe) => probe.offHost === true)).toBe(true);
  });

  test('a 200 HTML document at /.env is not exposure', async () => {
    const fetchImpl = async (url) => ({
      statusCode: 200,
      body: '<!DOCTYPE html><html><body>DB_PASSWORD=a\nAPP_KEY=b</body></html>',
      finalUrl: url,
      headers: { 'content-type': 'text/html' },
      ok: true,
    });
    const probes = await runSecurityProbes('https://example.com', {
      host: 'example.com',
      fetchImpl,
      delayMs: 0,
    });
    expect(probes.find((probe) => probe.path === '/.env').exposed).toBe(false);
  });
});
