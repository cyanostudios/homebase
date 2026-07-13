// server/core/storage/adapters/__tests__/R2StorageAdapter.test.js
const { Readable } = require('stream');

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn((input) => ({ __type: 'PutObjectCommand', input })),
  DeleteObjectCommand: jest.fn((input) => ({ __type: 'DeleteObjectCommand', input })),
  GetObjectCommand: jest.fn((input) => ({ __type: 'GetObjectCommand', input })),
}));

const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { R2StorageAdapter } = require('../R2StorageAdapter');

describe('R2StorageAdapter.download', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      R2_ACCOUNT_ID: 'acct',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET_NAME: 'bucket',
      R2_PUBLIC_URL: 'https://cdn.example.com',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('returns Body stream from GetObjectCommand', async () => {
    const body = Readable.from(Buffer.from('audio-bytes'));
    mockSend.mockResolvedValueOnce({ Body: body });

    const adapter = new R2StorageAdapter();
    const stream = await adapter.download({}, { externalFileId: 'cups/guide-audio-1.wav' });

    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'bucket',
      Key: 'cups/guide-audio-1.wav',
    });
    expect(stream).toBe(body);
  });

  test('rejects empty externalFileId', async () => {
    const adapter = new R2StorageAdapter();
    await expect(adapter.download({}, { externalFileId: '' })).rejects.toThrow(
      'externalFileId is required for R2 download',
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('throws when response has no Body', async () => {
    mockSend.mockResolvedValueOnce({ Body: null });

    const adapter = new R2StorageAdapter();
    await expect(
      adapter.download({}, { externalFileId: 'cups/guide-audio-1.wav' }),
    ).rejects.toThrow('Empty response body from R2');
  });
});
