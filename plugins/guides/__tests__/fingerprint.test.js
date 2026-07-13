// plugins/guides/__tests__/fingerprint.test.js
const { computeProductionFingerprint } = require('../production/fingerprint');

describe('computeProductionFingerprint', () => {
  test('is stable for same canonical input', () => {
    const input = {
      canonicalNarrative: 'Hello world',
      presentationText: null,
      variantType: 'normal',
      language: 'sv',
      step: 'text_derivation',
      providerKey: 'noop',
      providerVersion: '1',
    };
    const a = computeProductionFingerprint(input);
    const b = computeProductionFingerprint(input);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  test('changes when step or provider changes', () => {
    const base = {
      canonicalNarrative: 'Hello',
      presentationText: null,
      variantType: 'normal',
      language: 'sv',
      step: 'text_derivation',
      providerKey: 'noop',
      providerVersion: '1',
    };
    const otherStep = computeProductionFingerprint({ ...base, step: 'translation' });
    const otherProvider = computeProductionFingerprint({ ...base, providerVersion: '2' });
    expect(otherStep).not.toBe(computeProductionFingerprint(base));
    expect(otherProvider).not.toBe(computeProductionFingerprint(base));
  });
});
