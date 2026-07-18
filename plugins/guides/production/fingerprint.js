// plugins/guides/production/fingerprint.js
const crypto = require('crypto');

/**
 * @param {Record<string, unknown>} input
 */
function computeProductionFingerprint(input) {
  const step = String(input.step ?? '').toLowerCase();
  let canonical;

  if (step === 'translation') {
    canonical = {
      step,
      sourcePresentationText: input.sourcePresentationText ?? null,
      sourceLanguage: input.sourceLanguage ?? null,
      targetLanguage: input.targetLanguage ?? input.language ?? null,
      variantType: input.variantType,
      providerKey: input.providerKey,
      providerVersion: input.providerVersion ?? '1',
      regenerateNonce: input.regenerateNonce ?? null,
    };
  } else {
    canonical = {
      step,
      canonicalNarrative: input.canonicalNarrative ?? null,
      presentationText: input.presentationText ?? null,
      ingestRunId: input.ingestRunId ?? null,
      variantType: input.variantType,
      language: input.language,
      providerKey: input.providerKey,
      providerVersion: input.providerVersion ?? '1',
      regenerateNonce: input.regenerateNonce ?? null,
      sourcePackFingerprint: input.sourcePackFingerprint ?? null,
    };
  }

  const json = JSON.stringify(canonical, Object.keys(canonical).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}

module.exports = { computeProductionFingerprint };
