// plugins/files/pathUtils.js
// Path helpers for folder_path validation (prevent path traversal)
const path = require('path');

const MAX_FOLDER_PATH_LENGTH = 500;

/**
 * Sanitize folder path: remove .., leading/trailing slashes, limit length.
 * Returns null or empty string for root; otherwise normalized path like "Mapp A" or "Mapp A/Undermapp".
 * @param {string} raw - Raw folder path from user
 * @returns {string|null} Sanitized path or null for root
 */
function sanitizeFolderPath(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/[/\\]+/).filter(Boolean);
  const safe = [];
  for (const p of parts) {
    if (p === '.' || p === '..') continue;
    if (p.length > 255) continue; // single segment limit
    safe.push(p);
  }
  if (safe.length === 0) return null;
  const result = safe.join('/');
  if (result.length > MAX_FOLDER_PATH_LENGTH) return result.slice(0, MAX_FOLDER_PATH_LENGTH);
  return result;
}

/**
 * Resolve physical path for a file from url (e.g. /api/files/raw/Mapp A/file.pdf).
 * Must be under uploadRoot. Returns null if invalid.
 * @param {string} uploadRoot - Absolute path to uploads root
 * @param {string} url - File url
 * @returns {string|null} Absolute path or null
 */
function resolvePhysicalPath(uploadRoot, url) {
  if (!url || !url.startsWith('/api/files/raw/')) return null;
  const suffix = url.replace(/^\/api\/files\/raw\/?/, '').trim();
  if (!suffix) return null;
  const decoded = decodeURIComponent(suffix);
  if (decoded.includes('..') || path.isAbsolute(decoded)) return null;
  const resolved = path.resolve(uploadRoot, decoded);
  const rootResolved = path.resolve(uploadRoot);
  if (!resolved.startsWith(rootResolved) || resolved === rootResolved) return null;
  return resolved;
}

/**
 * Build url for a stored file (folder_path + stored filename).
 * @param {string|null} folderPath - Folder path or null for root
 * @param {string} storedFilename - Stored filename (e.g. 123-abc-file.pdf)
 * @returns {string} URL like /api/files/raw/file.pdf or /api/files/raw/Mapp/file.pdf
 */
function buildFileUrl(folderPath, storedFilename) {
  const base = '/api/files/raw/';
  if (!folderPath || !folderPath.trim()) {
    return base + encodeURIComponent(storedFilename);
  }
  const safePath = sanitizeFolderPath(folderPath) || '';
  if (!safePath) return base + encodeURIComponent(storedFilename);
  return base + encodeURIComponent(safePath) + '/' + encodeURIComponent(storedFilename);
}

module.exports = { sanitizeFolderPath, resolvePhysicalPath, buildFileUrl };
