const fs = require('fs');
const os = require('os');
const path = require('path');
const { Logger } = require('@homebase/core');
const {
  ensureStorageProvidersRegistered,
} = require('../../../server/core/storage/registerDefaultAdapters');
const StorageProviderRegistry = require('../../../server/core/storage/StorageProviderRegistry');

/** Object key prefix for guide audio blobs (not cups/). */
const GUIDE_AUDIO_KEY_PREFIX = 'guides/audio';

/**
 * Persist generated audio bytes via the active StorageProvider.
 * @param {import('express').Request} req
 * @param {Buffer} buffer
 * @param {{ filename: string, mimeType: string, presentationId: string|number }} opts
 */
async function uploadAudioBuffer(req, buffer, opts) {
  ensureStorageProvidersRegistered();
  const provider = await StorageProviderRegistry.resolveForUpload(req);
  const filename = opts.filename;
  const mimeType = opts.mimeType || 'application/octet-stream';
  const keyPrefix = GUIDE_AUDIO_KEY_PREFIX;

  if (provider.name === 'local') {
    const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
    const relativeKey = `${keyPrefix}/${filename}`;
    const absPath = path.join(uploadRoot, relativeKey);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, buffer);
    const result = await provider.upload(req, {
      path: absPath,
      storedFilename: filename,
      filename,
      mimeType,
      size: buffer.length,
      keyPrefix,
      objectKey: relativeKey,
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
      keyPrefix,
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

module.exports = { uploadAudioBuffer, GUIDE_AUDIO_KEY_PREFIX };
