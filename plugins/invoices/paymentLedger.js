// plugins/invoices/paymentLedger.js
// Payment ledger is the source of truth for amount_paid and paid/partially_paid status.

const PAYMENT_DERIVED_STATUSES = new Set(['paid', 'partially_paid']);

/**
 * Client may not assign paid/partially_paid via generic invoice create/update.
 * Those statuses are applied only by refreshInvoicePaymentState from invoice_payments.
 */
function sanitizeClientInvoiceStatus(requestedStatus, currentStatus = 'draft') {
  const fallback = currentStatus || 'draft';
  let status = requestedStatus || fallback;
  if (PAYMENT_DERIVED_STATUSES.has(status)) {
    // Keep current workflow status (e.g. sent); never demote to draft.
    return fallback;
  }
  return status;
}

/**
 * Given ledger sum + current invoice fields, derive status and paidAt.
 * Canceled is preserved (amount_paid may still be updated by caller).
 */
function derivePaymentStatus({
  currentStatus,
  amountPaid,
  total,
  dueDate,
  isPastDue,
  currentPaidAt = null,
}) {
  const paid = Number(amountPaid) || 0;
  const invoiceTotal = Number(total) || 0;
  let status = currentStatus || 'draft';
  let paidAt = currentPaidAt || null;

  if (status === 'canceled') {
    return { status: 'canceled', paidAt: null, amountPaid: paid };
  }

  if (invoiceTotal > 0 && paid + 0.001 >= invoiceTotal) {
    status = 'paid';
    if (!paidAt) {
      paidAt = new Date().toISOString();
    }
  } else if (paid > 0) {
    status = 'partially_paid';
    paidAt = null;
  } else if (status === 'paid' || status === 'partially_paid') {
    status = typeof isPastDue === 'function' && isPastDue(dueDate) ? 'overdue' : 'sent';
    paidAt = null;
  }

  return { status, paidAt, amountPaid: paid };
}

module.exports = {
  PAYMENT_DERIVED_STATUSES,
  sanitizeClientInvoiceStatus,
  derivePaymentStatus,
};
