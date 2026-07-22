// server/core/storage/adapters/LocalStorageAdapter.js
const path = require('path');
const fs = require('fs');
const StorageProvider = require('../StorageProvider');

class LocalStorageAdapter extends StorageProvider {
  /**
   * @param {{ uploadRoot: string }} opts
   */
  constructor(opts) {
    super();
    this.name = 'local';
    this.uploadRoot = opts.uploadRoot;
  }

  /**
   * Multer has already written the file to disk at input.path with filename input.storedFilename.
   * @param {import('express').Request} _req
   * @param {{ path: string, storedFilename: string, filename: string, mimeType?: string|null, size?: number|null, keyPrefix?: string, objectKey?: string }} input
   */
  async upload(_req, input) {
    const storedFilename = input.storedFilename || path.basename(input.path);
    const relativeKey = resolveRelativeKey(input, storedFilename);
    return {
      externalFileId: relativeKey,
      url: `/api/files/raw/${encodeURIComponent(relativeKey)}`,
      size: input.size != null ? Number(input.size) : null,
    };
  }

  /**
   * @param {import('express').Request} _req
   * @param {{ externalFileId: string }} input
   */
  async download(_req, input) {
    const abs = resolveSafePath(this.uploadRoot, input.externalFileId);
    if (!fs.existsSync(abs)) {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      throw err;
    }
    return fs.createReadStream(abs);
  }

  /**
   * @param {import('express').Request} _req
   * @param {{ externalFileId: string }} input
   */
  async delete(_req, input) {
    const abs = resolveSafePath(this.uploadRoot, input.externalFileId);
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
    }
  }

  /**
   * @param {import('express').Request} _req
   * @param {{ pageSize?: number }} [_input]
   */
  async list(_req, _input) {
    void _input;
    return [];
  }
}

/**
 * @param {{ keyPrefix?: string, objectKey?: string }} input
 * @param {string} storedFilename
 */
function resolveRelativeKey(input, storedFilename) {
  const explicit = String(input.objectKey ?? '')
    .trim()
    .replace(/^\/+/, '');
  if (explicit) {
    return explicit;
  }
  const prefix = String(input.keyPrefix ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  return prefix ? `${prefix}/${storedFilename}` : storedFilename;
}

/**
 * Resolve a path under uploadRoot; reject traversal outside the root.
 * @param {string} uploadRoot
 * @param {string} externalFileId
 */
function resolveSafePath(uploadRoot, externalFileId) {
  const relative = String(externalFileId || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const abs = path.resolve(uploadRoot, relative);
  const root = path.resolve(uploadRoot);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    const err = new Error('Invalid file path');
    err.code = 'EINVAL';
    throw err;
  }
  return abs;
}

module.exports = LocalStorageAdapter;
