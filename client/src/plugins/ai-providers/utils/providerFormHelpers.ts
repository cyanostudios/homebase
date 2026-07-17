import type { ProviderSettings } from '../types/aiProviders';

export const MASKED_SECRET = '••••••••';

export interface ProviderDraft {
  enabled: boolean;
  apiKey: string;
  defaultModel: string;
  hasApiKey: boolean;
}

export function draftFromProvider(provider: ProviderSettings): ProviderDraft {
  return {
    enabled: Boolean(provider.enabled),
    defaultModel: provider.defaultModel || '',
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
  apiKey?: string | null;
} {
  const payload: {
    enabled: boolean;
    defaultModel: string;
    apiKey?: string | null;
  } = {
    enabled: draft.enabled,
    defaultModel: draft.defaultModel.trim() || fallbackModel || '',
  };

  const trimmedKey = draft.apiKey.trim();
  if (trimmedKey && !trimmedKey.startsWith(MASKED_SECRET)) {
    payload.apiKey = trimmedKey;
  }

  return payload;
}
