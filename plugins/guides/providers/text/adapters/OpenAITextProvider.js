// plugins/guides/providers/text/adapters/OpenAITextProvider.js
const TextPromptLoader = require('../TextPromptLoader');
const ProviderRateLimiter = require('../../shared/ProviderRateLimiter');

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

class OpenAITextProvider {
  /**
   * @param {{ apiKey?: string, model?: string, timeoutMs?: number, rpm?: number, fetchFn?: typeof fetch, promptLoader?: typeof TextPromptLoader }} [options]
   */
  constructor(options = {}) {
    this.key = 'openai';
    this._apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this._model = options.model ?? process.env.GUIDES_TEXT_OPENAI_MODEL ?? DEFAULT_MODEL;
    this._timeoutMs =
      options.timeoutMs ??
      (Number(process.env.GUIDES_TEXT_OPENAI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
    this._rpm = options.rpm ?? (Number(process.env.GUIDES_TEXT_RATE_LIMIT_RPM) || DEFAULT_RPM);
    this._fetch = options.fetchFn ?? fetch;
    this._promptLoader = options.promptLoader ?? TextPromptLoader;

    const promptSetVersion = this._promptLoader.getPromptSetVersion();
    this.version = `openai@${this._model}@prompts-${promptSetVersion}`;
  }

  /**
   * @param {import('express').Request} _req
   * @param {{ canonicalNarrative: string|null|undefined, variantType: string, language: string }} input
   */
  async generate(_req, input) {
    const narrative = String(input.canonicalNarrative ?? '').trim();
    if (!narrative) {
      return {
        status: 'failed',
        errorMessage: 'canonicalNarrative is required for text derivation',
      };
    }

    if (!this._apiKey) {
      return { status: 'failed', errorMessage: 'OPENAI_API_KEY is not configured' };
    }

    const rateCheck = ProviderRateLimiter.tryAcquire(this.key, this._rpm);
    if (!rateCheck.allowed) {
      return {
        status: 'retry',
        retryAfterMs: rateCheck.retryAfterMs,
        errorMessage: 'Text provider rate limit exceeded',
      };
    }

    let prompts;
    try {
      prompts = this._promptLoader.getPrompts(input.variantType, {
        canonicalNarrative: narrative,
        language: input.language,
        variantType: input.variantType,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Prompt loading failed';
      return { status: 'failed', errorMessage: message };
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
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(this._timeoutMs),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OpenAI request failed';
      if (message.includes('TimeoutError') || message.includes('aborted')) {
        return { status: 'failed', errorMessage: 'OpenAI request timed out' };
      }
      return { status: 'failed', errorMessage: message };
    }

    const latencyMs = Date.now() - startMs;

    if (response.status === 429) {
      return {
        status: 'retry',
        retryAfterMs: parseRetryAfterMs(response),
        errorMessage: 'OpenAI rate limit (429)',
      };
    }

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.error?.message ?? '';
      } catch {
        // ignore parse errors
      }
      return {
        status: 'failed',
        errorMessage: detail || `OpenAI request failed (${response.status})`,
      };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return { status: 'failed', errorMessage: 'Invalid JSON response from OpenAI' };
    }

    const rawText = data?.choices?.[0]?.message?.content ?? '';
    const presentationText = String(rawText).trim();
    if (!presentationText) {
      return { status: 'failed', errorMessage: 'OpenAI returned empty presentation text' };
    }

    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : undefined;

    return {
      status: 'ready',
      presentationText,
      providerResult: {
        presentationText,
        raw: {
          text: rawText,
          model: this._model,
          promptVersion: prompts.promptVersion,
          promptSetVersion: prompts.promptSetVersion,
          variantType: input.variantType,
          language: input.language,
          finishReason: data?.choices?.[0]?.finish_reason ?? null,
        },
        usage,
        requestedAt,
        latencyMs,
      },
    };
  }
}

module.exports = OpenAITextProvider;
