import { parseSwishNumber } from './swishNumber';
import type { BuildSwishTypeCInput, Result } from './types';
import { QR_MAX_PAYLOAD_LENGTH, SWISH_MESSAGE_MAX_LENGTH } from './types';

/**
 * Format SEK amount with exactly two decimals and a comma separator (Swish C-spec).
 * Requires a finite amount > 0.
 */
export function formatSwishAmount(amount: number): Result<string> {
  if (!Number.isFinite(amount)) {
    return { ok: false, error: 'Amount must be a finite number' };
  }
  if (amount <= 0) {
    return { ok: false, error: 'Amount must be greater than zero' };
  }
  // Round to öre (2 decimals); reject values that round to zero
  const ore = Math.round(amount * 100);
  if (ore <= 0) {
    return { ok: false, error: 'Amount must be at least 0,01 SEK' };
  }
  const whole = Math.floor(ore / 100);
  const frac = String(ore % 100).padStart(2, '0');
  return { ok: true, value: `${whole},${frac}` };
}

function prepareMessage(message: string | null | undefined): Result<string> {
  if (message == null || message === '') {
    return { ok: true, value: '' };
  }
  // Spec delimiter is `;` — replace with space, then cap, then URL-encode.
  const cleaned = String(message).replace(/;/g, ' ').trim().slice(0, SWISH_MESSAGE_MAX_LENGTH);
  return { ok: true, value: encodeURIComponent(cleaned) };
}

/**
 * Build Swish Type C QR payload:
 * `C{payee};{amount};{message};{lock_mask}`
 *
 * Amount uses comma decimals; message is URL-encoded; lock_mask defaults to 0.
 * @see https://www.swish.nu/marknadsmaterial/qr-generator
 */
export function buildSwishTypeCPayload(input: BuildSwishTypeCInput): Result<string> {
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
