import { buildSwishTypeCPayload, formatSwishAmount } from '../swishPayload';
import { SWISH_LOCK } from '../types';

describe('formatSwishAmount', () => {
  it('formats with comma and two decimals', () => {
    expect(formatSwishAmount(100)).toEqual({ ok: true, value: '100,00' });
    expect(formatSwishAmount(100.5)).toEqual({ ok: true, value: '100,50' });
    expect(formatSwishAmount(99.999)).toEqual({ ok: true, value: '100,00' });
  });

  it('rejects non-positive and non-finite', () => {
    expect(formatSwishAmount(0).ok).toBe(false);
    expect(formatSwishAmount(-1).ok).toBe(false);
    expect(formatSwishAmount(Number.NaN).ok).toBe(false);
  });

  it('rejects sub-öre amounts that round to 0,00', () => {
    expect(formatSwishAmount(0.001).ok).toBe(false);
    expect(formatSwishAmount(0.004).ok).toBe(false);
    expect(formatSwishAmount(0.005)).toEqual({ ok: true, value: '0,01' });
  });
});

describe('buildSwishTypeCPayload', () => {
  it('builds golden corporate invoice payload', () => {
    const r = buildSwishTypeCPayload({
      payee: '1237856901',
      amount: 100,
      message: '12229445',
      lockMask: 0,
    });
    expect(r).toEqual({ ok: true, value: 'C1237856901;100,00;12229445;0' });
  });

  it('URL-encodes message with spaces', () => {
    const r = buildSwishTypeCPayload({
      payee: '0701234567',
      amount: 50,
      message: 'Faktura 1',
      lockMask: 0,
    });
    expect(r).toEqual({ ok: true, value: 'C0701234567;50,00;Faktura%201;0' });
  });

  it('allows empty amount and message', () => {
    const r = buildSwishTypeCPayload({ payee: '0701234567' });
    expect(r).toEqual({ ok: true, value: 'C0701234567;;;0' });
  });

  it('defaults lock mask to 0', () => {
    const r = buildSwishTypeCPayload({ payee: '0701234567', amount: 10 });
    expect(r.ok && r.value.endsWith(';0')).toBe(true);
  });

  it('supports lock bitmask (amount + message editable = 6)', () => {
    const r = buildSwishTypeCPayload({
      payee: '0701234567',
      amount: 10,
      message: 'x',
      lockMask: SWISH_LOCK.AMOUNT | SWISH_LOCK.MESSAGE,
    });
    expect(r).toEqual({ ok: true, value: 'C0701234567;10,00;x;6' });
  });

  it('replaces semicolon in message with space then encodes', () => {
    const r = buildSwishTypeCPayload({
      payee: '0701234567',
      message: 'a;b',
    });
    expect(r).toEqual({ ok: true, value: 'C0701234567;;a%20b;0' });
  });

  it('caps message at 50 chars before encoding', () => {
    const long = 'x'.repeat(60);
    const r = buildSwishTypeCPayload({ payee: '0701234567', message: long });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const msg = r.value.split(';')[2];
      expect(decodeURIComponent(msg).length).toBe(50);
    }
  });

  it('rejects invalid payee', () => {
    expect(buildSwishTypeCPayload({ payee: 'bad' }).ok).toBe(false);
  });

  it('rejects amount <= 0 when provided', () => {
    expect(buildSwishTypeCPayload({ payee: '0701234567', amount: 0 }).ok).toBe(false);
  });

  it('rejects invalid lockMask', () => {
    expect(buildSwishTypeCPayload({ payee: '0701234567', lockMask: 8 }).ok).toBe(false);
    expect(buildSwishTypeCPayload({ payee: '0701234567', lockMask: 1.5 }).ok).toBe(false);
  });
});
