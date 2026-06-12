// Magic-byte validation for uploaded files (server-side, not client MIME).

const fs = require('fs');
const FileType = require('file-type');
const { AppError } = require('../errors/AppError');

const TEXT_FALLBACK_MIMES = new Set(['text/plain', 'text/csv']);

/**
 * @param {string} filePath
 * @param {string|null|undefined} declaredMime
 * @param {Set<string>} allowedMime
 */
async function assertUploadMimeAllowed(filePath, declaredMime, allowedMime) {
  const detected = await FileType.fromFile(filePath);
  if (detected?.mime) {
    if (!allowedMime.has(detected.mime)) {
      throw new AppError(
        `File content type not allowed (${detected.mime})`,
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    return detected.mime;
  }

  const declared = typeof declaredMime === 'string' ? declaredMime.trim().toLowerCase() : '';
  if (declared && TEXT_FALLBACK_MIMES.has(declared) && allowedMime.has(declared)) {
    return declared;
  }

  throw new AppError(
    'Could not verify file type from content',
    400,
    AppError.CODES.VALIDATION_ERROR,
  );
}

/**
 * @param {import('express').Multer.File} file
 * @param {Set<string>} allowedMime
 */
async function validateUploadedFileMime(file, allowedMime) {
  if (!file?.path || !fs.existsSync(file.path)) {
    throw new AppError('Upload file missing on disk', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return assertUploadMimeAllowed(file.path, file.mimetype, allowedMime);
}

module.exports = {
  assertUploadMimeAllowed,
  validateUploadedFileMime,
};
