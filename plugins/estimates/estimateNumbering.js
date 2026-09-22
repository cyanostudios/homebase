// Estimate number series — flat settings keys (mirrors invoice flat series, no numberingByType).

const {
  resolveInvoiceNumbering,
  buildInvoiceNumberMatchRegex,
  buildInvoiceNumber,
  parseSequenceFromInvoiceNumber,
  DEFAULT_INVOICE_NUMBER_START,
} = require('../invoices/invoiceNumbering');

function resolveEstimateNumbering(settings) {
  return resolveInvoiceNumbering(settings);
}

module.exports = {
  resolveEstimateNumbering,
  buildInvoiceNumberMatchRegex,
  buildInvoiceNumber,
  parseSequenceFromInvoiceNumber,
  DEFAULT_ESTIMATE_NUMBER_START: DEFAULT_INVOICE_NUMBER_START,
};
