import { MASKED_SECRET, buildSavePayload, draftFromProvider } from '../providerFormHelpers';
import type { ProviderSettings } from '../../types/aiProviders';

describe('providerFormHelpers', () => {
  const baseProvider: ProviderSettings = {
    id: '1',
    userId: '7',
    providerKey: 'openai',
    enabled: true,
    defaultModel: 'gpt-4o-mini',
    voiceId: null,
    apiKey: MASKED_SECRET,
    hasApiKey: true,
    createdAt: null,
    updatedAt: null,
  };

  test('draftFromProvider masks stored key', () => {
    expect(draftFromProvider(baseProvider)).toEqual({
      enabled: true,
      defaultModel: 'gpt-4o-mini',
      voiceId: '',
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
      voiceId: '',
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
        voiceId: '',
        hasApiKey: true,
      },
      'gpt-4o-mini',
    );
    expect(payload).toEqual({
      enabled: true,
      defaultModel: 'gpt-4.1-mini',
      voiceId: null,
    });
  });

  test('buildSavePayload includes new apiKey and voiceId', () => {
    const payload = buildSavePayload(
      {
        enabled: false,
        apiKey: 'sk-new',
        defaultModel: '',
        voiceId: 'voice-abc',
        hasApiKey: false,
      },
      'gpt-4o-mini',
    );
    expect(payload).toEqual({
      enabled: false,
      defaultModel: 'gpt-4o-mini',
      voiceId: 'voice-abc',
      apiKey: 'sk-new',
    });
  });
});
