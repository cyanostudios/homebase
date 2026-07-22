const ElevenLabsAudioProvider = require('../audio/adapters/ElevenLabsAudioProvider');

describe('ElevenLabsAudioProvider', () => {
  test('testConnection succeeds via minimal TTS probe', async () => {
    const audioBytes = Buffer.from([1, 2, 3, 4]);
    const fetchFn = jest.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        audioBytes.buffer.slice(
          audioBytes.byteOffset,
          audioBytes.byteOffset + audioBytes.byteLength,
        ),
    }));
    const provider = new ElevenLabsAudioProvider({
      apiKey: 'xi-test',
      model: 'eleven_multilingual_v2',
      voiceId: 'voice-1',
      fetchFn,
    });

    await expect(provider.testConnection()).resolves.toEqual({
      ok: true,
      model: 'eleven_multilingual_v2',
    });
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('/v1/text-to-speech/voice-1'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'xi-api-key': 'xi-test' }),
      }),
    );
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.text).toBe('Hi');
  });

  test('testConnection throws when API key missing', async () => {
    const provider = new ElevenLabsAudioProvider({ apiKey: '', fetchFn: jest.fn() });
    await expect(provider.testConnection()).rejects.toThrow('ELEVENLABS_API_KEY');
  });

  test('testConnection throws on TTS failure', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ detail: { message: 'Invalid API key' } }),
    }));
    const provider = new ElevenLabsAudioProvider({ apiKey: 'bad', fetchFn });
    await expect(provider.testConnection()).rejects.toThrow('Invalid API key');
  });

  test('generate returns mp3 buffer on success', async () => {
    const audioBytes = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const fetchFn = jest.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        audioBytes.buffer.slice(
          audioBytes.byteOffset,
          audioBytes.byteOffset + audioBytes.byteLength,
        ),
    }));
    const provider = new ElevenLabsAudioProvider({
      apiKey: 'xi-test',
      voiceId: 'voice-1',
      model: 'eleven_multilingual_v2',
      fetchFn,
    });

    const result = await provider.generate({}, { presentationText: 'Hello guide' });
    expect(result.status).toBe('ready');
    expect(result.mimeType).toBe('audio/mpeg');
    expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
    expect(result.audioBuffer.equals(audioBytes)).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('/v1/text-to-speech/voice-1'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'xi-api-key': 'xi-test' }),
      }),
    );
  });

  test('generate fails when text empty', async () => {
    const provider = new ElevenLabsAudioProvider({ apiKey: 'xi-test', fetchFn: jest.fn() });
    const result = await provider.generate({}, { presentationText: '  ' });
    expect(result.status).toBe('failed');
  });

  test('listVoices maps ElevenLabs voice list', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        voices: [
          { voice_id: 'abc', name: 'Alice', category: 'premade' },
          { voice_id: 'def', name: 'Bob' },
        ],
      }),
    }));
    const provider = new ElevenLabsAudioProvider({ apiKey: 'xi-test', fetchFn });
    await expect(provider.listVoices()).resolves.toEqual([
      { id: 'abc', name: 'Alice', category: 'premade' },
      { id: 'def', name: 'Bob', category: undefined },
    ]);
  });
});
