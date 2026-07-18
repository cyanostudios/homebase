// plugins/guides/providers/translation/adapters/OpenAITranslationProvider.js
const TranslationPromptLoader = require('../TranslationPromptLoader');
const ProviderRateLimiter = require('../../shared/ProviderRateLimiter');
const { mapHttpStatusToFailureCode } = require('../../../../ai-providers/generationFailureCodes');
const { calculateCost } = require('../../../../ai-providers/CostCalculator');

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_RPM = 60;
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

function parseRetryAfterMs(response) {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number.parseInt(header, 10);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  return 30_000;
}

class OpenAITranslationProvider {
  /**
   * @param {{ apiKey?: string, model?: string, timeoutMs?: number, rpm?: number, fetchFn?: typeof fetch, promptLoader?: typeof TranslationPromptLoader }} [options]
   */
  constructor(options = {}) {
    this.key = 'openai';
    this._apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this._model =
      options.model ??
      process.env.GUIDES_TRANSLATION_OPENAI_MODEL ??
      process.env.GUIDES_TEXT_OPENAI_MODEL ??
      DEFAULT_MODEL;
    this._timeoutMs =
      options.timeoutMs ??
      (Number(process.env.GUIDES_TRANSLATION_OPENAI_TIMEOUT_MS) ||
        Number(process.env.GUIDES_TEXT_OPENAI_TIMEOUT_MS) ||
        DEFAULT_TIMEOUT_MS);
    this._rpm =
      options.rpm ??
      (Number(process.env.GUIDES_TRANSLATION_RATE_LIMIT_RPM) ||
        Number(process.env.GUIDES_TEXT_RATE_LIMIT_RPM) ||
        DEFAULT_RPM);
    this._fetch = options.fetchFn ?? fetch;
    this._promptLoader = options.promptLoader ?? TranslationPromptLoader;

    const promptSetVersion = this._promptLoader.getPromptSetVersion();
    this.version = `openai-trans@${this._model}@prompts-${promptSetVersion}`;
  }

  /**
   * @param {import('express').Request} _req
   * @param {{ presentationText: string, sourceLanguage: string, targetLanguage: string }} input
   */
  async translate(_req, input) {
    const presentationText = String(input.presentationText ?? '').trim();
    if (!presentationText) {
      return {
        status: 'failed',
        failureCode: 'content_input_invalid',
        errorMessage: 'presentationText is required for translation',
      };
    }

    if (!this._apiKey) {
      return {
        status: 'failed',
        failureCode: 'provider_auth_failed',
        errorMessage: 'OPENAI_API_KEY is not configured',
      };
    }

    const rateCheck = ProviderRateLimiter.tryAcquire(`${this.key}-translation`, this._rpm);
    if (!rateCheck.allowed) {
      return {
        status: 'retry',
        failureCode: 'provider_rate_limited',
        retryAfterMs: rateCheck.retryAfterMs,
        errorMessage: 'Translation provider rate limit exceeded',
      };
    }

    let prompts;
    try {
      prompts = this._promptLoader.getPrompts({
        presentationText,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Prompt loading failed';
      return { status: 'failed', failureCode: 'provider_invalid_request', errorMessage: message };
    }

    const requestedAt = new Date().toISOString();
    const startMs = Date.now();

    let response;
    try {
      response = await this._fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this._apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this._model,
          messages: [
            { role: 'system', content: prompts.system },
            { role: 'user', content: prompts.user },
          ],
          max_tokens: prompts.maxCompletionTokens,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(this._timeoutMs),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OpenAI request failed';
      if (message.includes('TimeoutError') || message.includes('aborted')) {
        return {
          status: 'failed',
          failureCode: 'provider_unavailable',
          errorMessage: 'OpenAI request timed out',
        };
      }
      return {
        status: 'failed',
        failureCode: 'provider_unavailable',
        errorMessage: message,
      };
    }

    const latencyMs = Date.now() - startMs;

    if (response.status === 429) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.error?.message ?? '';
      } catch {
        // ignore
      }
      const failureCode = mapHttpStatusToFailureCode(429, detail);
      return {
        status: failureCode === 'provider_quota_exhausted' ? 'failed' : 'retry',
        failureCode,
        retryAfterMs:
          failureCode === 'provider_rate_limited' ? parseRetryAfterMs(response) : undefined,
        errorMessage: detail || 'OpenAI rate limit (429)',
      };
    }

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.error?.message ?? '';
      } catch {
        // ignore
      }
      return {
        status: 'failed',
        failureCode: mapHttpStatusToFailureCode(response.status, detail),
        errorMessage: detail || `OpenAI request failed (${response.status})`,
      };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return {
        status: 'failed',
        failureCode: 'provider_unknown_error',
        errorMessage: 'Invalid JSON response from OpenAI',
      };
    }

    const rawText = data?.choices?.[0]?.message?.content ?? '';
    const translatedText = String(rawText).trim();
    if (!translatedText) {
      return {
        status: 'failed',
        failureCode: 'provider_unknown_error',
        errorMessage: 'OpenAI returned empty translation',
      };
    }

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;
    const usage = {
      provider: this.key,
      model: this._model,
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs,
    };
    const cost = calculateCost({ providerKey: this.key, model: this._model, usage });

    return {
      status: 'ready',
      translatedText,
      providerResult: {
        translatedText,
        raw: {
          text: rawText,
          model: this._model,
          promptVersion: prompts.promptVersion,
          promptSetVersion: prompts.promptSetVersion,
          sourceLanguage: input.sourceLanguage,
          targetLanguage: input.targetLanguage,
          finishReason: data?.choices?.[0]?.finish_reason ?? null,
        },
        usage,
        cost: cost ?? undefined,
        requestedAt,
        latencyMs,
      },
    };
  }
}

module.exports = OpenAITranslationProvider;
