// plugins/guides/__tests__/fingerprint.test.js
const { computeProductionFingerprint } = require('../production/fingerprint');

describe('computeProductionFingerprint', () => {
  test('is stable for same canonical input', () => {
    const input = {
      canonicalNarrative: 'Hello world',
      presentationText: null,
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
      language: 'sv',
      step: 'text_derivation',
      providerKey: 'noop',
      providerVersion: '1',
    };
    const otherStep = computeProductionFingerprint({
      ...base,
      step: 'translation',
      sourcePresentationText: 'Hi',
      sourceLanguage: 'sv',
      targetLanguage: 'en',
    });
    const otherProvider = computeProductionFingerprint({ ...base, providerVersion: '2' });
    expect(otherStep).not.toBe(computeProductionFingerprint(base));
    expect(otherProvider).not.toBe(computeProductionFingerprint(base));
  });

  test('includes ingestRunId for text derivation', () => {
    const base = {
      canonicalNarrative: 'Hello',
      language: 'sv',
      step: 'text_derivation',
      providerKey: 'noop',
      providerVersion: '1',
    };
    const withoutIngest = computeProductionFingerprint(base);
    const withIngest = computeProductionFingerprint({ ...base, ingestRunId: '42' });
    expect(withoutIngest).not.toBe(withIngest);
  });

  test('uses translation-specific fields', () => {
    const base = {
      step: 'translation',
      sourcePresentationText: 'Hello',
      sourceLanguage: 'sv',
      targetLanguage: 'en',
      providerKey: 'noop',
      providerVersion: '1',
    };
    const changedTarget = computeProductionFingerprint({ ...base, targetLanguage: 'de' });
    expect(changedTarget).not.toBe(computeProductionFingerprint(base));
  });

  test('regenerateNonce produces unique fingerprint', () => {
    const base = {
      canonicalNarrative: 'Hello',
      language: 'sv',
      step: 'text_derivation',
      providerKey: 'noop',
      providerVersion: '1',
    };
    const first = computeProductionFingerprint({ ...base, regenerateNonce: '1' });
    const second = computeProductionFingerprint({ ...base, regenerateNonce: '2' });
    expect(first).not.toBe(second);
  });

  test('changes when prompt set version in providerVersion changes', () => {
    const base = {
      canonicalNarrative: 'Hello',
      language: 'sv',
      step: 'text_derivation',
      providerKey: 'openai',
      providerVersion: 'openai@gpt-4o-mini@prompts-v1',
    };
    const v2 = computeProductionFingerprint({
      ...base,
      providerVersion: 'openai@gpt-4o-mini@prompts-v2',
    });
    expect(v2).not.toBe(computeProductionFingerprint(base));
  });

  test('ignores variantType differences for text derivation', () => {
    const base = {
      canonicalNarrative: 'Hello',
      language: 'sv',
      step: 'text_derivation',
      providerKey: 'noop',
      providerVersion: '1',
    };
    const withVariant = computeProductionFingerprint({ ...base, variantType: 'deep' });
    expect(withVariant).toBe(computeProductionFingerprint(base));
  });
});
