// plugins/ai-providers/generationFailureCodes.js
// Stable, credit-free failure taxonomy (SSOT). Guides maps code → i18n only.

const GENERATION_FAILURE_CODES = Object.freeze([
  'provider_not_configured',
  'provider_not_generation_capable',
  'provider_auth_failed',
  'provider_quota_exhausted',
  'provider_rate_limited',
  'provider_unavailable',
  'provider_invalid_request',
  'content_input_invalid',
  'provider_unknown_error',
]);

const GENERATION_FAILURE_CODE_SET = new Set(GENERATION_FAILURE_CODES);

const RETRYABLE_FAILURE_CODES = Object.freeze(['provider_rate_limited', 'provider_unavailable']);

/**
 * Map HTTP status (+ optional vendor message) to a GenerationFailureCode.
 * Never includes tokens, balance, or credit amounts.
 * @param {number} status
 * @param {string} [vendorMessage]
 * @returns {string}
 */
function mapHttpStatusToFailureCode(status, vendorMessage = '') {
  const msg = String(vendorMessage || '').toLowerCase();
  if (status === 401 || status === 403) return 'provider_auth_failed';
  if (status === 402) return 'provider_quota_exhausted';
  if (
    status === 429 &&
    (msg.includes('quota') ||
      msg.includes('billing') ||
      msg.includes('insufficient') ||
      msg.includes('credit') ||
      msg.includes('balance'))
  ) {
    return 'provider_quota_exhausted';
  }
  if (status === 429) return 'provider_rate_limited';
  if (status === 400 || status === 404 || status === 422) return 'provider_invalid_request';
  if (status >= 500 && status < 600) return 'provider_unavailable';
  if (
    msg.includes('quota') ||
    msg.includes('billing') ||
    msg.includes('insufficient_quota') ||
    msg.includes('credit')
  ) {
    return 'provider_quota_exhausted';
  }
  return 'provider_unknown_error';
}

function isRetryableFailureCode(code) {
  return RETRYABLE_FAILURE_CODES.includes(code);
}

function isGenerationFailureCode(code) {
  return GENERATION_FAILURE_CODE_SET.has(code);
}

module.exports = {
  GENERATION_FAILURE_CODES,
  RETRYABLE_FAILURE_CODES,
  mapHttpStatusToFailureCode,
  isRetryableFailureCode,
  isGenerationFailureCode,
};
