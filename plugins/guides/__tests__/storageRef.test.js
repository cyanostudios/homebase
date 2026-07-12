// plugins/guides/__tests__/storageRef.test.js
const { AppError } = require('../../../server/core/errors/AppError');
const { formatStorageRef, parseStorageRef, sanitizeStorageRef } = require('../audio/storageRef');

describe('guide audio storageRef', () => {
  test('formatStorageRef builds namespaced reference', () => {
    expect(formatStorageRef('local', 'guide-audio-7.wav')).toBe('local:guide-audio-7.wav');
  });

  test('parseStorageRef accepts valid reference', () => {
    expect(parseStorageRef('local:guide-audio-7.wav')).toEqual({
      providerKey: 'local',
      externalFileId: 'guide-audio-7.wav',
    });
  });

  test('parseStorageRef rejects invalid format', () => {
    expect(() => parseStorageRef('not-valid')).toThrow(AppError);
    expect(() => parseStorageRef('')).toThrow(AppError);
  });

  test('sanitizeStorageRef validates and trims', () => {
    expect(sanitizeStorageRef(' local:file.wav ')).toBe('local:file.wav');
    expect(sanitizeStorageRef(null)).toBeNull();
    expect(() => sanitizeStorageRef('bad')).toThrow(AppError);
  });
});
