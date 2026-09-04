// Shared invoice number series helpers (mirrors client invoiceNumbering.ts).

const DEFAULT_INVOICE_NUMBER_PREFIX = '';
const DEFAULT_INVOICE_NUMBER_START = 1;
const DEFAULT_INVOICE_INCLUDE_YEAR = true;
const MAX_INVOICE_NUMBER_PREFIX_LENGTH = 12;
const MAX_INVOICE_NUMBER_START = 999999;

function sanitizeInvoiceNumberPrefix(raw) {
  if (typeof raw !== 'string') {
    return DEFAULT_INVOICE_NUMBER_PREFIX;
  }
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, MAX_INVOICE_NUMBER_PREFIX_LENGTH);
}

function sanitizeInvoiceNumberStart(raw) {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_INVOICE_NUMBER_START;
  }
  return Math.min(Math.floor(n), MAX_INVOICE_NUMBER_START);
}

function sanitizeInvoiceIncludeYear(raw) {
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (raw === 'false' || raw === 0 || raw === '0') {
    return false;
  }
  if (raw === 'true' || raw === 1 || raw === '1') {
    return true;
  }
  return DEFAULT_INVOICE_INCLUDE_YEAR;
}

function resolveInvoiceNumbering(settings) {
  return {
    numberPrefix: sanitizeInvoiceNumberPrefix(settings?.numberPrefix),
    numberStart: sanitizeInvoiceNumberStart(settings?.numberStart),
    includeYear: sanitizeInvoiceIncludeYear(settings?.includeYear),
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Postgres ~ pattern for the active series (prefix + optional year). */
function buildInvoiceNumberMatchRegex(prefix, year, includeYear) {
  if (includeYear) {
    return prefix ? `^${escapeRegExp(prefix)}-${year}-[0-9]+$` : `^${year}-[0-9]+$`;
  }
  return prefix ? `^${escapeRegExp(prefix)}-[0-9]+$` : '^[0-9]+$';
}

function buildInvoiceNumber(prefix, year, sequence, includeYear = true) {
  const padded = String(sequence).padStart(3, '0');
  if (includeYear) {
    return prefix ? `${prefix}-${year}-${padded}` : `${year}-${padded}`;
  }
  return prefix ? `${prefix}-${padded}` : padded;
}

function parseSequenceFromInvoiceNumber(invoiceNumber, prefix, year, includeYear = true) {
  if (typeof invoiceNumber !== 'string' || !invoiceNumber) {
    return null;
  }
  let expectedHead;
  if (includeYear) {
    expectedHead = prefix ? `${prefix}-${year}-` : `${year}-`;
  } else {
    expectedHead = prefix ? `${prefix}-` : '';
  }
  if (expectedHead) {
    if (!invoiceNumber.startsWith(expectedHead)) {
      return null;
    }
  } else if (!/^[0-9]+$/.test(invoiceNumber)) {
    return null;
  }
  const seq = parseInt(expectedHead ? invoiceNumber.slice(expectedHead.length) : invoiceNumber, 10);
  if (!Number.isFinite(seq) || seq < 1) {
    return null;
  }
  return seq;
}

module.exports = {
  DEFAULT_INVOICE_NUMBER_PREFIX,
  DEFAULT_INVOICE_NUMBER_START,
  DEFAULT_INVOICE_INCLUDE_YEAR,
  resolveInvoiceNumbering,
  buildInvoiceNumberMatchRegex,
  buildInvoiceNumber,
  parseSequenceFromInvoiceNumber,
};
