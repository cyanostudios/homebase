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
   * @param {{ path: string, storedFilename: string, filename: string, mimeType?: string|null, size?: number|null }} input
   */
  async upload(_req, input) {
    const storedFilename = input.storedFilename || path.basename(input.path);
    return {
      externalFileId: storedFilename,
      url: `/api/files/raw/${storedFilename}`,
      size: input.size != null ? Number(input.size) : null,
    };
  }

  /**
   * @param {import('express').Request} _req
   * @param {{ externalFileId: string }} input
   */
  async download(_req, input) {
    const abs = path.join(this.uploadRoot, path.basename(input.externalFileId));
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
    const abs = path.join(this.uploadRoot, path.basename(input.externalFileId));
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

module.exports = LocalStorageAdapter;
