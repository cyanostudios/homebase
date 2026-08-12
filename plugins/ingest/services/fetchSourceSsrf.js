// Shared SSRF helpers for ingest fetch strategies (no axios/puppeteer imports).
const { validatePublicHttpsUrl } = require('../../../server/core/utils/ssrfUrlGuard');

/**
 * Fail closed if a redirect landed on a non-public / non-HTTPS URL.
 * @param {string|null|undefined} finalUrl
 * @returns {{ ok: true } | { ok: false, errorMessage: string }}
 */
function assertFinalUrlPublicHttps(finalUrl) {
  if (!finalUrl || typeof finalUrl !== 'string') {
    return { ok: true };
  }
  const check = validatePublicHttpsUrl(finalUrl);
  if (!check.ok) {
    return {
      ok: false,
      errorMessage: `Final URL after redirect is not allowed: ${check.error}`,
    };
  }
  return { ok: true };
}

module.exports = { assertFinalUrlPublicHttps };
