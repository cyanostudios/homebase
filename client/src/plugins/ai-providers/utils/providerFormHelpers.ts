import type { ProviderSettings } from '../types/aiProviders';

export const MASKED_SECRET = '••••••••';

export interface ProviderDraft {
  enabled: boolean;
  apiKey: string;
  defaultModel: string;
  voiceId: string;
  hasApiKey: boolean;
}

export function draftFromProvider(provider: ProviderSettings): ProviderDraft {
  return {
    enabled: Boolean(provider.enabled),
    defaultModel: provider.defaultModel || '',
    voiceId: provider.voiceId || '',
    hasApiKey: Boolean(provider.hasApiKey),
    apiKey: provider.hasApiKey ? MASKED_SECRET : '',
  };
}

/** Build save payload from draft; omit apiKey when masked/empty (keep stored). */
export function buildSavePayload(
  draft: ProviderDraft,
  fallbackModel: string,
): {
  enabled: boolean;
  defaultModel: string;
  voiceId?: string | null;
  apiKey?: string | null;
} {
  const payload: {
    enabled: boolean;
    defaultModel: string;
    voiceId?: string | null;
    apiKey?: string | null;
  } = {
    enabled: draft.enabled,
    defaultModel: draft.defaultModel.trim() || fallbackModel || '',
    voiceId: draft.voiceId.trim() || null,
  };

  const trimmedKey = draft.apiKey.trim();
  if (trimmedKey && !trimmedKey.startsWith(MASKED_SECRET)) {
    payload.apiKey = trimmedKey;
  }

  return payload;
}
