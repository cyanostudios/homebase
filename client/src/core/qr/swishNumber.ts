import type { Result, SwishNumberKind } from './types';

const MOBILE = /^07\d{8}$/;
const CORPORATE = /^123\d{7}$/;

/**
 * Strip spaces/hyphens; map +46 / 46 mobile prefixes to domestic 07… form.
 */
export function normalizeSwishNumber(input: string): string {
  let s = (input ?? '').replace(/[\s-]/g, '');
  if (s.startsWith('+46')) {
    s = `0${s.slice(3)}`;
  } else if (/^46\d{9}$/.test(s)) {
    s = `0${s.slice(2)}`;
  }
  return s;
}

export function isValidSwishNumber(normalized: string): boolean {
  return MOBILE.test(normalized) || CORPORATE.test(normalized);
}

export function classifySwishNumber(normalized: string): SwishNumberKind | null {
  if (MOBILE.test(normalized)) return 'mobile';
  if (CORPORATE.test(normalized)) return 'corporate';
  return null;
}

/** Normalize then validate; returns Result with canonical 10-digit payee. */
export function parseSwishNumber(input: string): Result<string> {
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
