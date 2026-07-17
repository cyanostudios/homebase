import { MASKED_SECRET, buildSavePayload, draftFromProvider } from '../providerFormHelpers';
import type { ProviderSettings } from '../../types/aiProviders';

describe('providerFormHelpers', () => {
  const baseProvider: ProviderSettings = {
    id: '1',
    userId: '7',
    providerKey: 'openai',
    enabled: true,
    defaultModel: 'gpt-4o-mini',
    apiKey: MASKED_SECRET,
    hasApiKey: true,
    createdAt: null,
    updatedAt: null,
  };

  test('draftFromProvider masks stored key', () => {
    expect(draftFromProvider(baseProvider)).toEqual({
      enabled: true,
      defaultModel: 'gpt-4o-mini',
      hasApiKey: true,
      apiKey: MASKED_SECRET,
    });
  });

  test('draftFromProvider leaves apiKey empty when no key', () => {
    expect(
      draftFromProvider({
        ...baseProvider,
        hasApiKey: false,
        apiKey: '',
        enabled: false,
      }),
    ).toEqual({
      enabled: false,
      defaultModel: 'gpt-4o-mini',
      hasApiKey: false,
      apiKey: '',
    });
  });

  test('buildSavePayload omits masked apiKey', () => {
    const payload = buildSavePayload(
      {
        enabled: true,
        apiKey: MASKED_SECRET,
        defaultModel: 'gpt-4.1-mini',
        hasApiKey: true,
      },
      'gpt-4o-mini',
    );
    expect(payload).toEqual({
      enabled: true,
      defaultModel: 'gpt-4.1-mini',
    });
  });

  test('buildSavePayload includes new apiKey', () => {
    const payload = buildSavePayload(
      {
        enabled: false,
        apiKey: 'sk-new',
        defaultModel: '',
        hasApiKey: false,
      },
      'gpt-4o-mini',
    );
    expect(payload).toEqual({
      enabled: false,
      defaultModel: 'gpt-4o-mini',
      apiKey: 'sk-new',
    });
  });
});
