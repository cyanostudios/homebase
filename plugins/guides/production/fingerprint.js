// plugins/guides/production/fingerprint.js
const crypto = require('crypto');

/**
 * @param {Record<string, unknown>} input
 */
function computeProductionFingerprint(input) {
  const canonical = {
    canonicalNarrative: input.canonicalNarrative ?? null,
    presentationText: input.presentationText ?? null,
    variantType: input.variantType,
    language: input.language,
    step: input.step,
    providerKey: input.providerKey,
    providerVersion: input.providerVersion ?? '1',
  };
  const json = JSON.stringify(canonical, Object.keys(canonical).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}

module.exports = { computeProductionFingerprint };
