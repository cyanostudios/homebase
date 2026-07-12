// plugins/guides/audio/uploadAudioBuffer.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Logger } = require('@homebase/core');
const {
  ensureStorageProvidersRegistered,
} = require('../../../server/core/storage/registerDefaultAdapters');
const StorageProviderRegistry = require('../../../server/core/storage/StorageProviderRegistry');

/**
 * Persist generated audio bytes via the active StorageProvider.
 * @param {import('express').Request} req
 * @param {Buffer} buffer
 * @param {{ filename: string, mimeType: string, variantId: string|number }} opts
 */
async function uploadAudioBuffer(req, buffer, opts) {
  ensureStorageProvidersRegistered();
  const provider = await StorageProviderRegistry.resolveForUpload(req);
  const filename = opts.filename;
  const mimeType = opts.mimeType || 'application/octet-stream';

  if (provider.name === 'local') {
    const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
    fs.mkdirSync(uploadRoot, { recursive: true });
    const storedFilename = filename;
    const absPath = path.join(uploadRoot, storedFilename);
    fs.writeFileSync(absPath, buffer);
    const result = await provider.upload(req, {
      path: absPath,
      storedFilename,
      filename,
      mimeType,
      size: buffer.length,
    });
    return { providerKey: provider.name, externalFileId: result.externalFileId };
  }

  const tmpDir = path.join(os.tmpdir(), 'homebase-guide-audio');
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `${Date.now()}-${path.basename(filename)}`);
  fs.writeFileSync(tmpPath, buffer);

  try {
    if (provider.name === 'googledrive') {
      const result = await provider.upload(req, {
        stream: fs.createReadStream(tmpPath),
        filename,
        mimeType,
        size: buffer.length,
      });
      return { providerKey: provider.name, externalFileId: result.externalFileId };
    }

    const result = await provider.upload(req, {
      path: tmpPath,
      storedFilename: filename,
      filename,
      mimeType,
      size: buffer.length,
    });
    return { providerKey: provider.name, externalFileId: result.externalFileId };
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch (err) {
      Logger.warn('Failed to remove temp audio upload file', { err: err?.message });
    }
  }
}

module.exports = { uploadAudioBuffer };
