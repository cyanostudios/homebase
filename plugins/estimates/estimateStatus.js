const { AppError } = require('../../server/core/errors/AppError');

const ESTIMATE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'invoiced'];

function sanitizeEstimateStatus(raw, fallback = 'draft') {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (ESTIMATE_STATUSES.includes(value)) {
    return value;
  }
  return fallback;
}

function assertClientEstimateStatus(raw, fallback = 'draft') {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    return fallback;
  }
  if (value === 'invoiced') {
    throw new AppError(
      'Status invoiced can only be set via convert-to-invoice',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  if (!ESTIMATE_STATUSES.includes(value)) {
    throw new AppError('Invalid estimate status', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return value;
}

module.exports = {
  ESTIMATE_STATUSES,
  sanitizeEstimateStatus,
  assertClientEstimateStatus,
};
