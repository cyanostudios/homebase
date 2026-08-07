const {
  buildSwishTypeCPayload,
  formatSwishAmount,
  parseSwishNumber,
  SWISH_LOCK,
} = require('../lib/swishPayload');

describe('ClubdeskSwishPayload (public cart)', () => {
  test('parseSwishNumber normalizes mobile', () => {
    expect(parseSwishNumber('070-123 45 67')).toEqual({ ok: true, value: '0701234567' });
  });

  test('formatSwishAmount uses comma decimals', () => {
    expect(formatSwishAmount(20)).toEqual({ ok: true, value: '20,00' });
    expect(formatSwishAmount(20.5)).toEqual({ ok: true, value: '20,50' });
  });

  test('buildSwishTypeCPayload locks cart amount', () => {
    const r = buildSwishTypeCPayload({
      payee: '0701234567',
      amount: 45,
      message: 'Kiosk',
      lockMask: SWISH_LOCK.AMOUNT,
    });
    expect(r.ok).toBe(true);
    expect(r.value).toBe('C0701234567;45,00;Kiosk;2');
  });

  test('buildSwishTypeCPayload rejects empty payee', () => {
    expect(buildSwishTypeCPayload({ payee: '' }).ok).toBe(false);
  });
});
