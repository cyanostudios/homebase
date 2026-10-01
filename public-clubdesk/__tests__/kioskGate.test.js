const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('kiosk staff gate', () => {
  test('cookie helpers stay valid for later re-enable', () => {
    const gate = path.join(root, 'api/kiosk_gate.php');
    const code = `
      require ${JSON.stringify(gate)};
      $secret = str_repeat('s', 32);
      $now = 1700000000;
      if (kioskStaffGateOpen('short')) { fwrite(STDERR, 'short secret opened the gate'); exit(1); }
      if (!kioskStaffGateOpen($secret)) { fwrite(STDERR, '32-char secret closed the gate'); exit(1); }
      $cookie = kioskStaffIssueCookie($now, $secret);
      if (!kioskStaffCookieValid($cookie, $secret, $now)) { fwrite(STDERR, 'fresh cookie rejected'); exit(1); }
      if (kioskStaffCookieValid($cookie, $secret, $now + 43200)) { fwrite(STDERR, 'expired cookie accepted'); exit(1); }
      if (kioskStaffCookieValid($cookie, str_repeat('x', 32), $now)) { fwrite(STDERR, 'wrong secret accepted'); exit(1); }
      $farExpiry = $now + 43201;
      $far = $farExpiry . '.' . hash_hmac('sha256', (string) $farExpiry, $secret);
      if (kioskStaffCookieValid($far, $secret, $now)) { fwrite(STDERR, 'cookie beyond 12 hours accepted'); exit(1); }
      if (kioskStaffCookieValid(null, $secret, $now)) { fwrite(STDERR, 'missing cookie accepted'); exit(1); }
      echo 'ok';
    `;
    const out = execFileSync('php', ['-r', code], { encoding: 'utf8' });
    expect(out.trim()).toBe('ok');
  });

  test('stock write is open for local development (staff cookie paused)', () => {
    const src = read('api/inventory_quantity.php');
    expect(src).toMatch(/kioskSameOriginAllowed/);
    expect(src).not.toMatch(/kioskStaffCookieValid/);
    expect(src).toMatch(/Staff cookie gate paused/);
  });

  test('article HTML shows stock buttons and keeps the internal note off', () => {
    const page = read('inventory.php');
    expect(page).toMatch(/\$internalNote = '';/);
    expect(page).toMatch(/data-stock-delta/);
    expect(page).toMatch(/inventory-stock-app\.js/);
    expect(page).not.toMatch(/kiosk-unlock/);
    expect(page).not.toMatch(/kiosk-unlock-app\.js/);
    expect(page).not.toMatch(/\$staffGateOpen/);
  });

  test('unlock endpoint remains available for later re-enable', () => {
    const src = read('api/kiosk_session.php');
    expect(src).toMatch(/hash_equals\(\$secret, \$presented\)/);
    expect(src).toMatch(/503/);
    expect(src).toMatch(/kioskStaffGateOpen/);
    expect(src).not.toMatch(/PUBLIC_CLUBDESK_KIOSK_SECRET/);
  });
});
