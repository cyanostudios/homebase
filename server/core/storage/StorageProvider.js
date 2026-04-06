// server/core/storage/StorageProvider.js
// Base contract for storage adapters (local disk, Google Drive, etc.)

/**
 * @typedef {Object} UploadResult
 * @property {string} externalFileId - Provider-native file identifier (or stored filename for local)
 * @property {string} url - URL clients use to open/download (relative or absolute)
 * @property {number} [size] - Bytes
 */

class StorageProvider {
  constructor() {
    /** @type {string} */
    this.name = 'base';
  }

  /**
   * Upload a file. For local + multer-disk, pass { path, storedFilename, mimeType, size }.
   * For remote providers pass { stream, filename, mimeType, size }.
   * @param {import('express').Request} req
   * @param {{ path?: string, storedFilename?: string, stream?: import('stream').Readable, filename: string, mimeType?: string|null, size?: number|null }} input
   * @returns {Promise<UploadResult>}
   */
  async upload(req, input) {
    void req;
    void input;
    throw new Error('StorageProvider.upload not implemented');
  }

  /**
   * @param {import('express').Request} req
   * @param {{ externalFileId: string }} input
   * @returns {Promise<import('stream').Readable>}
   */
  async download(req, input) {
    void req;
    void input;
    throw new Error('StorageProvider.download not implemented');
  }

  /**
   * @param {import('express').Request} req
   * @param {{ externalFileId: string }} input
   * @returns {Promise<void>}
   */
  async delete(req, input) {
    void req;
    void input;
    throw new Error('StorageProvider.delete not implemented');
  }

  /**
   * @param {import('express').Request} req
   * @param {{ folderId?: string }} [input]
   * @returns {Promise<Array<{ externalFileId: string, name: string, size: number|null, mimeType: string|null, url: string|null }>>}
   */
  async list(req, input) {
    void req;
    void input;
    throw new Error('StorageProvider.list not implemented');
  }
}

module.exports = StorageProvider;
