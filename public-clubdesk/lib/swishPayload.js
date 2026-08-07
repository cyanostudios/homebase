/**
 * Swish Type C payload builder for public Clubdesk cart QR.
 * Mirrors client/src/core/qr (swishNumber + swishPayload) for vanilla JS.
 * UMD: Jest (CommonJS) + browser global `ClubdeskSwishPayload`.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.ClubdeskSwishPayload = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SWISH_LOCK = { PAYEE: 1, AMOUNT: 2, MESSAGE: 4 };
  const SWISH_MESSAGE_MAX_LENGTH = 50;
  const QR_MAX_PAYLOAD_LENGTH = 500;
  const MOBILE = /^07\d{8}$/;
  const CORPORATE = /^123\d{7}$/;

  function normalizeSwishNumber(input) {
    let s = String(input ?? '').replace(/[\s-]/g, '');
    if (s.startsWith('+46')) {
      s = `0${s.slice(3)}`;
    } else if (/^46\d{9}$/.test(s)) {
      s = `0${s.slice(2)}`;
    }
    return s;
  }

  function isValidSwishNumber(normalized) {
    return MOBILE.test(normalized) || CORPORATE.test(normalized);
  }

  function parseSwishNumber(input) {
    const normalized = normalizeSwishNumber(input);
    if (!normalized) {
      return { ok: false, error: 'Swish number is required' };
    }
    if (!isValidSwishNumber(normalized)) {
      return {
        ok: false,
        error: 'Invalid Swish number (expected 07XXXXXXXX or 123XXXXXXX)',
      };
    }
    return { ok: true, value: normalized };
  }

  function formatSwishAmount(amount) {
    if (!Number.isFinite(amount)) {
      return { ok: false, error: 'Amount must be a finite number' };
    }
    if (amount <= 0) {
      return { ok: false, error: 'Amount must be greater than zero' };
    }
    const ore = Math.round(amount * 100);
    if (ore <= 0) {
      return { ok: false, error: 'Amount must be at least 0,01 SEK' };
    }
    const whole = Math.floor(ore / 100);
    const frac = String(ore % 100).padStart(2, '0');
    return { ok: true, value: `${whole},${frac}` };
  }

  function prepareMessage(message) {
    if (message == null || message === '') {
      return { ok: true, value: '' };
    }
    const cleaned = String(message).replace(/;/g, ' ').trim().slice(0, SWISH_MESSAGE_MAX_LENGTH);
    return { ok: true, value: encodeURIComponent(cleaned) };
  }

  /**
   * @param {{ payee: string, amount?: number|null, message?: string|null, lockMask?: number }} input
   */
  function buildSwishTypeCPayload(input) {
    const payeeResult = parseSwishNumber(input.payee);
    if (!payeeResult.ok) return payeeResult;

    let amountField = '';
    if (input.amount != null) {
      const amountResult = formatSwishAmount(input.amount);
      if (!amountResult.ok) return amountResult;
      amountField = amountResult.value;
    }

    const messageResult = prepareMessage(input.message);
    if (!messageResult.ok) return messageResult;

    const lockMask =
      input.lockMask === undefined || input.lockMask === null ? 0 : Number(input.lockMask);
    if (!Number.isInteger(lockMask) || lockMask < 0 || lockMask > 7) {
      return { ok: false, error: 'lockMask must be an integer 0–7' };
    }

    const payload = `C${payeeResult.value};${amountField};${messageResult.value};${lockMask}`;
    if (payload.length > QR_MAX_PAYLOAD_LENGTH) {
      return { ok: false, error: 'Swish payload exceeds maximum length' };
    }
    return { ok: true, value: payload };
  }

  return {
    SWISH_LOCK,
    SWISH_MESSAGE_MAX_LENGTH,
    parseSwishNumber,
    formatSwishAmount,
    buildSwishTypeCPayload,
  };
});
