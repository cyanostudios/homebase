/**
 * ML field immutability helpers (Architect epic A).
 */

const { isIssuedStatus } = require('./vatEngine');

/** Fields frozen once status leaves draft (payment ledger excluded). */
const ML_LOCKED_FIELDS = [
  'invoiceNumber',
  'invoiceType',
  'contentProfile',
  'contactId',
  'contactName',
  'organizationNumber',
  'issueDate',
  'supplyDate',
  'dueDate',
  'paymentTerms',
  'lineItems',
  'invoiceDiscount',
  'currency',
  'orderNumber',
  'deliveryMethod',
  'notes',
  'creditedInvoiceId',
  'creditedInvoiceNumber',
  'correctionSummary',
  'vatBreakdown',
];

/** Workflow statuses a client may set on an already-issued invoice (not draft, not ledger-paid). */
const ISSUED_CLIENT_STATUS_ALLOWLIST = new Set(['sent', 'overdue', 'canceled']);

function normalizeComparable(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const d = new Date(trimmed);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return trimmed;
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function mlPayloadSlice(data) {
  const out = {};
  for (const key of ML_LOCKED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data || {}, key)) {
      out[key] = data[key];
    }
  }
  return out;
}

/**
 * True when any ML field in the incoming payload differs from the stored invoice.
 */
function hasMlFieldMutation(currentInvoice, incoming) {
  if (!incoming || typeof incoming !== 'object') {
    return false;
  }
  for (const key of ML_LOCKED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) {
      continue;
    }
    const next = normalizeComparable(incoming[key]);
    const prev = normalizeComparable(currentInvoice?.[key]);
    if (next !== prev) {
      return true;
    }
  }
  return false;
}

function assertDraftDeletable(invoice) {
  if (isIssuedStatus(invoice?.status)) {
    const err = new Error('Issued invoices cannot be deleted.');
    err.code = 'INVOICE_ML_LOCKED';
    err.statusCode = 409;
    throw err;
  }
}

/**
 * Resolve status transition for an issued invoice.
 * Ignores ML body fields (caller must not rewrite them).
 * Rejects unlock via draft and client-assigned paid/partially_paid.
 *
 * @returns {{ ok: true, status: string } | { ok: false, code: string, message: string }}
 */
function resolveIssuedStatusTransition(currentStatus, requestedStatus, { isPastDue = false } = {}) {
  const current = String(currentStatus || 'sent').trim() || 'sent';
  if (!isIssuedStatus(current)) {
    return { ok: true, status: current };
  }

  const requested =
    requestedStatus == null || String(requestedStatus).trim() === ''
      ? current
      : String(requestedStatus).trim();

  if (requested === 'draft') {
    return {
      ok: false,
      code: 'INVOICE_ML_LOCKED',
      message: 'Issued documents cannot return to draft.',
    };
  }

  // Ledger owns paid / partially_paid — keep current workflow status.
  if (requested === 'paid' || requested === 'partially_paid') {
    let status = current;
    if (status === 'sent' && isPastDue) {
      status = 'overdue';
    }
    return { ok: true, status };
  }

  if (!ISSUED_CLIENT_STATUS_ALLOWLIST.has(requested)) {
    return {
      ok: false,
      code: 'INVOICE_ML_LOCKED',
      message: 'This document is issued and cannot be changed.',
    };
  }

  let status = requested;
  if (status === 'sent' && isPastDue) {
    status = 'overdue';
  }
  return { ok: true, status };
}

module.exports = {
  ML_LOCKED_FIELDS,
  ISSUED_CLIENT_STATUS_ALLOWLIST,
  isIssuedStatus,
  hasMlFieldMutation,
  mlPayloadSlice,
  assertDraftDeletable,
  normalizeComparable,
  resolveIssuedStatusTransition,
};
