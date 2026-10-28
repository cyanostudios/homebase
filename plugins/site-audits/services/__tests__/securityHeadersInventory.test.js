const {
  buildSecurityHeadersInventory,
  cspHasFrameAncestors,
} = require('../securityHeadersInventory');

describe('securityHeadersInventory', () => {
  test('marks frame protection via X-Frame-Options', () => {
    const matrix = buildSecurityHeadersInventory({
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'permissions-policy': 'geolocation=()',
    });
    expect(matrix.frameProtection).toMatchObject({ present: true, via: 'xfo' });
    expect(matrix.referrerPolicy.present).toBe(true);
    expect(matrix.permissionsPolicy.present).toBe(true);
  });

  test('marks frame protection via CSP frame-ancestors', () => {
    expect(cspHasFrameAncestors("default-src 'self'; frame-ancestors 'none'")).toBe(true);
    const matrix = buildSecurityHeadersInventory({
      'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
    });
    expect(matrix.frameProtection.present).toBe(true);
    expect(matrix.frameProtection.via).toBe('csp');
  });

  test('truncates long header values', () => {
    const long = `max-age=${'1'.repeat(300)}`;
    const matrix = buildSecurityHeadersInventory({ 'strict-transport-security': long });
    expect(matrix.hsts.present).toBe(true);
    expect(matrix.hsts.value.length).toBeLessThanOrEqual(201);
  });
});
