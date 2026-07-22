const { AppError } = require('../../../server/core/errors/AppError');
const { formatStorageRef, parseStorageRef, sanitizeStorageRef } = require('../audio/storageRef');

describe('guide audio storageRef', () => {
  test('formatStorageRef builds namespaced reference', () => {
    expect(formatStorageRef('local', 'guides/audio/12.wav')).toBe('local:guides/audio/12.wav');
  });

  test('parseStorageRef accepts valid reference', () => {
    expect(parseStorageRef('r2:guides/audio/12-1.wav')).toEqual({
      providerKey: 'r2',
      externalFileId: 'guides/audio/12-1.wav',
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
