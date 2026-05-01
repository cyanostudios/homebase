// server/core/storage/StorageProviderRegistry.js
const googledriveSettingsStore = require('./googledriveSettingsStore');
const { isR2Configured } = require('./adapters/R2StorageAdapter');

/** @type {Map<string, import('./StorageProvider')>} */
const providers = new Map();

/**
 * @param {string} name
 * @param {InstanceType<typeof import('./StorageProvider')>} instance
 */
function register(name, instance) {
  instance.name = name;
  providers.set(name, instance);
}

/**
 * @param {string} name
 */
function get(name) {
  const p = providers.get(name);
  if (!p) {
    throw new Error(`Storage provider not registered: ${name}`);
  }
  return p;
}

/**
 * @param {string} name
 */
function has(name) {
  return providers.has(name);
}

/**
 * @param {import('express').Request} req
 */
async function resolveForUpload(req) {
  if (isR2Configured() && has('r2')) {
    return get('r2');
  }
  try {
    const s = await googledriveSettingsStore.getSettings(req);
    if (s?.connected && s.accessToken) {
      return get('googledrive');
    }
  } catch {
    // fall back to local
  }
  return get('local');
}

/**
 * @param {{ storageProvider?: string|null, externalFileId?: string|null }} row - camelCase from model
 */
function resolveForFileRow(row) {
  const sp = row.storageProvider || 'local';
  if (sp === 'r2' && row.externalFileId && has('r2')) {
    return get('r2');
  }
  if (sp === 'googledrive' && row.externalFileId) {
    return get('googledrive');
  }
  return get('local');
}

module.exports = {
  register,
  get,
  has,
  resolveForUpload,
  resolveForFileRow,
};
