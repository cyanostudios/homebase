const AudioProvider = require('../AudioProvider');
const { calculateTtsCost } = require('../../../ai-providers/CostCalculator');

const DEFAULT_MODEL = 'eleven_multilingual_v2';
const DEFAULT_TIMEOUT_MS = 60_000;
/** Public demo voice (George) — override with GUIDES_AUDIO_ELEVENLABS_VOICE_ID. */
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const ELEVENLABS_TTS_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';
const OUTPUT_FORMAT = 'mp3_44100_128';
/** Minimal probe text — connection test uses TTS (keys often lack user_read). */
const CONNECTION_PROBE_TEXT = 'Hi';

function parseElevenLabsErrorDetail(body) {
  let detail = body?.detail?.message || body?.detail || body?.message || '';
  if (typeof detail === 'object' && detail !== null) {
    detail = detail.message || JSON.stringify(detail);
  }
  return String(detail || '');
}

class ElevenLabsAudioProvider extends AudioProvider {
  /**
   * @param {{
   *   apiKey?: string,
   *   model?: string,
   *   voiceId?: string,
   *   timeoutMs?: number,
   *   fetchFn?: typeof fetch,
   * }} [options]
   */
  constructor(options = {}) {
    super();
    this.name = 'elevenlabs';
    this._apiKey = options.apiKey ?? process.env.ELEVENLABS_API_KEY ?? '';
    this._model = options.model ?? process.env.GUIDES_AUDIO_ELEVENLABS_MODEL ?? DEFAULT_MODEL;
    this._voiceId =
      options.voiceId ?? process.env.GUIDES_AUDIO_ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
    this._timeoutMs =
      options.timeoutMs ??
      (Number(process.env.GUIDES_AUDIO_ELEVENLABS_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
    this._fetch = options.fetchFn ?? fetch;
    this.version = `elevenlabs@${this._model}@voice-${this._voiceId}`;
  }

  /**
   * Probes text_to_speech (not GET /v1/user) — restricted API keys often lack user_read.
   */
  async testConnection() {
    if (!this._apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const result = await this.generate({}, { presentationText: CONNECTION_PROBE_TEXT });
    if (result.status !== 'ready') {
      throw new Error(result.errorMessage || 'ElevenLabs TTS connection test failed');
    }

    return { ok: true, model: this._model };
  }

  /**
   * @returns {Promise<Array<{ id: string, name: string, category?: string }>>}
   */
  async listVoices() {
    if (!this._apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    let response;
    try {
      response = await this._fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'xi-api-key': this._apiKey,
        },
        signal: AbortSignal.timeout(this._timeoutMs),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ElevenLabs voices request failed';
      if (message.includes('TimeoutError') || message.includes('aborted')) {
        throw new Error('ElevenLabs request timed out');
      }
      throw new Error(message);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = parseElevenLabsErrorDetail(body);
      } catch {
        // ignore
      }
      throw new Error(detail || `ElevenLabs voices failed (${response.status})`);
    }

    const body = await response.json();
    const voices = Array.isArray(body?.voices) ? body.voices : [];
    return voices
      .map((voice) => ({
        id: String(voice.voice_id || voice.voiceId || ''),
        name: String(voice.name || voice.voice_id || ''),
        category: voice.category ? String(voice.category) : undefined,
      }))
      .filter((voice) => voice.id);
  }

  /**
   * @param {import('express').Request} _req
   * @param {{ presentationId: string|number, presentationText?: string|null, language?: string }} input
   */
  async generate(_req, input) {
    const presentationText = String(input.presentationText ?? '').trim();
    if (!presentationText) {
      return {
        status: 'failed',
        errorMessage: 'presentationText is required for audio generation',
      };
    }

    if (!this._apiKey) {
      return {
        status: 'failed',
        errorMessage: 'ELEVENLABS_API_KEY is not configured',
      };
    }

    const url = `${ELEVENLABS_TTS_BASE}/${encodeURIComponent(this._voiceId)}?output_format=${OUTPUT_FORMAT}`;

    let response;
    try {
      response = await this._fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this._apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: presentationText,
          model_id: this._model,
        }),
        signal: AbortSignal.timeout(this._timeoutMs),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ElevenLabs TTS request failed';
      if (message.includes('TimeoutError') || message.includes('aborted')) {
        return { status: 'failed', errorMessage: 'ElevenLabs request timed out' };
      }
      return { status: 'failed', errorMessage: message };
    }

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = parseElevenLabsErrorDetail(body);
      } catch {
        // ignore
      }
      return {
        status: 'failed',
        errorMessage: detail || `ElevenLabs TTS failed (${response.status})`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    if (!audioBuffer.length) {
      return { status: 'failed', errorMessage: 'ElevenLabs returned empty audio' };
    }

    // Rough duration for mp3_44100_128 (~128 kbps).
    const durationMs = Math.max(1, Math.round((audioBuffer.length * 8) / 128));
    const cost = calculateTtsCost({
      providerKey: this.name,
      model: this._model,
      characterCount: presentationText.length,
    });

    return {
      status: 'ready',
      audioBuffer,
      durationMs,
      mimeType: 'audio/mpeg',
      cost: cost ?? undefined,
    };
  }

  async getStatus(_req, input) {
    return { status: input.status ?? 'pending' };
  }

  async cancel(_req, _input) {
    return { status: 'pending' };
  }
}

module.exports = ElevenLabsAudioProvider;
