// server/core/storage/adapters/R2StorageAdapter.js
// Cloudflare R2 storage adapter (S3-compatible)
// Required env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const StorageProvider = require('../StorageProvider');

class R2StorageAdapter extends StorageProvider {
  constructor() {
    super();
    this.name = 'r2';
    this._client = null;
    this._bucket = null;
    this._publicUrl = null;
  }

  _init() {
    if (this._client) return;
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this._bucket = process.env.R2_BUCKET_NAME;
    this._publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

    if (!accountId || !accessKeyId || !secretAccessKey || !this._bucket || !this._publicUrl) {
      throw new Error(
        'R2 storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL',
      );
    }

    this._client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  /**
   * @param {import('express').Request} _req
   * @param {{ path: string, storedFilename: string, filename: string, mimeType?: string|null, size?: number|null }} input
   */
  async upload(_req, input) {
    this._init();
    const storedFilename = input.storedFilename || path.basename(input.path);
    const key = `cups/${storedFilename}`;
    const fileBuffer = fs.readFileSync(input.path);

    await this._client.send(
      new PutObjectCommand({
        Bucket: this._bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: input.mimeType || 'application/octet-stream',
      }),
    );

    try {
      fs.unlinkSync(input.path);
    } catch (_) {
      // ignore cleanup errors
    }

    return {
      externalFileId: key,
      url: `${this._publicUrl}/${key}`,
      size: input.size != null ? Number(input.size) : fileBuffer.length,
    };
  }

  /**
   * @param {import('express').Request} _req
   * @param {{ externalFileId: string }} input
   */
  async download(_req, _input) {
    throw new Error('R2 files are served via public URL, download stream not supported');
  }

  /**
   * @param {import('express').Request} _req
   * @param {{ externalFileId: string }} input
   */
  async delete(_req, input) {
    this._init();
    await this._client.send(
      new DeleteObjectCommand({
        Bucket: this._bucket,
        Key: input.externalFileId,
      }),
    );
  }

  /**
   * @param {import('express').Request} _req
   */
  async list(_req) {
    return [];
  }
}

/**
 * Returns true when all required R2 env vars are present.
 */
function isR2Configured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
}

module.exports = { R2StorageAdapter, isR2Configured };
