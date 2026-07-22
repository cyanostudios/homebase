/**
 * Data-driven metadata for supported AI providers.
 * Env var names preserve P-TEXT / P-AI-SETTINGS fallback behavior.
 * Frontend and save whitelist are driven solely from this catalog.
 */
function freezeModels(models) {
  return Object.freeze(models.map((model) => Object.freeze({ ...model })));
}

const PROVIDER_CATALOG = Object.freeze({
  openai: Object.freeze({
    key: 'openai',
    defaultModel: 'gpt-4o-mini',
    envApiKey: 'OPENAI_API_KEY',
    envModel: 'GUIDES_TEXT_OPENAI_MODEL',
    /** True when Guides has a registered text adapter for this provider. */
    textGenerationCapable: true,
    models: freezeModels([
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o mini',
        pricing: {
          inputPer1M: 0.15,
          outputPer1M: 0.6,
          currency: 'USD',
          effectiveDate: '2026-07',
        },
      },
      {
        id: 'gpt-4o',
        label: 'GPT-4o',
        pricing: {
          inputPer1M: 2.5,
          outputPer1M: 10,
          currency: 'USD',
          effectiveDate: '2026-07',
        },
      },
      {
        id: 'gpt-4.1-mini',
        label: 'GPT-4.1 mini',
        pricing: {
          inputPer1M: 0.4,
          outputPer1M: 1.6,
          currency: 'USD',
          effectiveDate: '2026-07',
        },
      },
      {
        id: 'gpt-4.1',
        label: 'GPT-4.1',
        pricing: {
          inputPer1M: 2,
          outputPer1M: 8,
          currency: 'USD',
          effectiveDate: '2026-07',
        },
      },
      {
        id: 'o4-mini',
        label: 'o4-mini',
        pricing: {
          inputPer1M: 1.1,
          outputPer1M: 4.4,
          currency: 'USD',
          effectiveDate: '2026-07',
        },
      },
      {
        id: 'o3-mini',
        label: 'o3-mini',
        pricing: {
          inputPer1M: 1.1,
          outputPer1M: 4.4,
          currency: 'USD',
          effectiveDate: '2026-07',
        },
      },
    ]),
  }),
  anthropic: Object.freeze({
    key: 'anthropic',
    defaultModel: 'claude-sonnet-4-5',
    envApiKey: 'ANTHROPIC_API_KEY',
    envModel: 'GUIDES_TEXT_ANTHROPIC_MODEL',
    models: freezeModels([
      { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
      { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
    ]),
  }),
  google: Object.freeze({
    key: 'google',
    defaultModel: 'gemini-2.0-flash',
    envApiKey: 'GEMINI_API_KEY',
    envModel: 'GUIDES_TEXT_GOOGLE_MODEL',
    models: freezeModels([
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ]),
  }),
  xai: Object.freeze({
    key: 'xai',
    defaultModel: 'grok-3',
    envApiKey: 'XAI_API_KEY',
    envModel: 'GUIDES_TEXT_XAI_MODEL',
    models: freezeModels([
      { id: 'grok-3', label: 'Grok 3' },
      { id: 'grok-3-mini', label: 'Grok 3 mini' },
      { id: 'grok-2', label: 'Grok 2' },
      { id: 'grok-2-vision-1212', label: 'Grok 2 Vision' },
    ]),
  }),
  mistral: Object.freeze({
    key: 'mistral',
    defaultModel: 'mistral-small-latest',
    envApiKey: 'MISTRAL_API_KEY',
    envModel: 'GUIDES_TEXT_MISTRAL_MODEL',
    models: freezeModels([
      { id: 'mistral-large-latest', label: 'Mistral Large' },
      { id: 'mistral-medium-latest', label: 'Mistral Medium' },
      { id: 'mistral-small-latest', label: 'Mistral Small' },
      { id: 'codestral-latest', label: 'Codestral' },
      { id: 'open-mistral-nemo', label: 'Mistral Nemo' },
    ]),
  }),
  cohere: Object.freeze({
    key: 'cohere',
    defaultModel: 'command-r-plus',
    envApiKey: 'COHERE_API_KEY',
    envModel: 'GUIDES_TEXT_COHERE_MODEL',
    models: freezeModels([
      { id: 'command-a-03-2025', label: 'Command A' },
      { id: 'command-r-plus', label: 'Command R+' },
      { id: 'command-r', label: 'Command R' },
      { id: 'command-r7b-12-2024', label: 'Command R7B' },
    ]),
  }),
  deepseek: Object.freeze({
    key: 'deepseek',
    defaultModel: 'deepseek-chat',
    envApiKey: 'DEEPSEEK_API_KEY',
    envModel: 'GUIDES_TEXT_DEEPSEEK_MODEL',
    models: freezeModels([
      { id: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
    ]),
  }),
  openrouter: Object.freeze({
    key: 'openrouter',
    defaultModel: 'openai/gpt-4o-mini',
    envApiKey: 'OPENROUTER_API_KEY',
    envModel: 'GUIDES_TEXT_OPENROUTER_MODEL',
    models: freezeModels([
      { id: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o mini' },
      { id: 'openai/gpt-4o', label: 'OpenAI GPT-4o' },
      { id: 'anthropic/claude-sonnet-4.5', label: 'Anthropic Claude Sonnet 4.5' },
      { id: 'google/gemini-2.0-flash-001', label: 'Google Gemini 2.0 Flash' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta Llama 3.3 70B' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
    ]),
  }),
  'azure-openai': Object.freeze({
    key: 'azure-openai',
    defaultModel: 'gpt-4o-mini',
    envApiKey: 'AZURE_OPENAI_API_KEY',
    envModel: 'GUIDES_TEXT_AZURE_OPENAI_MODEL',
    models: freezeModels([
      { id: 'gpt-4o-mini', label: 'gpt-4o-mini (deployment)' },
      { id: 'gpt-4o', label: 'gpt-4o (deployment)' },
      { id: 'gpt-4.1', label: 'gpt-4.1 (deployment)' },
      { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini (deployment)' },
      { id: 'o4-mini', label: 'o4-mini (deployment)' },
    ]),
  }),
  elevenlabs: Object.freeze({
    key: 'elevenlabs',
    defaultModel: 'eleven_multilingual_v2',
    envApiKey: 'ELEVENLABS_API_KEY',
    envModel: 'GUIDES_AUDIO_ELEVENLABS_MODEL',
    envVoiceId: 'GUIDES_AUDIO_ELEVENLABS_VOICE_ID',
    defaultVoiceId: 'JBFqnCBsd6RMkjVDRZzb',
    models: freezeModels([
      {
        id: 'eleven_multilingual_v2',
        label: 'Eleven Multilingual v2',
        pricing: {
          per1kCharacters: 0.1,
          currency: 'USD',
          effectiveDate: '2026-07',
        },
      },
      {
        id: 'eleven_v3',
        label: 'Eleven v3',
        pricing: {
          per1kCharacters: 0.1,
          currency: 'USD',
          effectiveDate: '2026-07',
        },
      },
      {
        id: 'eleven_flash_v2_5',
        label: 'Eleven Flash v2.5',
        pricing: {
          per1kCharacters: 0.05,
          currency: 'USD',
          effectiveDate: '2026-07',
        },
      },
      {
        id: 'eleven_turbo_v2_5',
        label: 'Eleven Turbo v2.5',
        pricing: {
          per1kCharacters: 0.05,
          currency: 'USD',
          effectiveDate: '2026-07',
        },
      },
      {
        id: 'eleven_flash_v2',
        label: 'Eleven Flash v2',
        pricing: {
          per1kCharacters: 0.05,
          currency: 'USD',
          effectiveDate: '2026-07',
        },
      },
    ]),
  }),
});

const SUPPORTED_PROVIDERS = new Set(Object.keys(PROVIDER_CATALOG));

function getProviderCatalogEntry(providerKey) {
  const normalized = String(providerKey ?? '')
    .trim()
    .toLowerCase();
  return PROVIDER_CATALOG[normalized] ?? null;
}

function getProviderDefaultModel(providerKey) {
  return getProviderCatalogEntry(providerKey)?.defaultModel ?? null;
}

module.exports = {
  PROVIDER_CATALOG,
  SUPPORTED_PROVIDERS,
  getProviderCatalogEntry,
  getProviderDefaultModel,
};
