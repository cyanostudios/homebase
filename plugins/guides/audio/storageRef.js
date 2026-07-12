// plugins/guides/audio/storageRef.js
const { AppError } = require('../../../server/core/errors/AppError');

const STORAGE_REF_REGEX = /^([a-z][a-z0-9_-]{0,49}):(.+)$/;

function formatStorageRef(providerKey, externalFileId) {
  const key = String(providerKey).trim().toLowerCase();
  const id = String(externalFileId).trim();
  if (!key || !id) {
    throw new AppError('Invalid storage reference parts', 400, AppError.CODES.VALIDATION_ERROR);
  }
  const ref = `${key}:${id}`;
  if (ref.length > 500) {
    throw new AppError('storageRef exceeds maximum length', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return ref;
}

function parseStorageRef(storageRef) {
  if (storageRef === null || storageRef === undefined || storageRef === '') {
    throw new AppError('storageRef is required', 400, AppError.CODES.VALIDATION_ERROR);
  }
  const trimmed = String(storageRef).trim();
  const match = trimmed.match(STORAGE_REF_REGEX);
  if (!match) {
    throw new AppError('Invalid storageRef format', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return {
    providerKey: match[1],
    externalFileId: match[2],
  };
}

function sanitizeStorageRef(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  parseStorageRef(trimmed);
  return trimmed.slice(0, 500);
}

module.exports = {
  STORAGE_REF_REGEX,
  formatStorageRef,
  parseStorageRef,
  sanitizeStorageRef,
};
