// server/core/services/wordpressFileFetcher.js
// Fetch files from WordPress: direct URL or token-authenticated endpoint for protected uploads.
// Validates MIME via magic bytes (file-type) to block spoofed files.

const path = require('path');
const FileType = require('file-type');

const FETCH_TIMEOUT_MS = 30000;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/**
 * Normalize filename for safe storage.
 * @param {string} input
 * @returns {string}
 */
function safeFilename(input) {
  if (!input || typeof input !== 'string') return `upload_${Date.now()}`;
  return input
    .trim()
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 120) || `upload_${Date.now()}`;
}

/**
 * Fetch file from URL. Tries direct fetch first; on 401/403, uses token-authenticated endpoint if configured.
 * @param {string} fileUrl - Full URL to the file (e.g. WordPress upload URL)
 * @param {string} destFolder - Absolute path to destination folder
 * @returns {Promise<{ fullPath: string, filename: string, size: number, mime: string }>}
 */
async function fetchFile(fileUrl, destFolder) {
  const fs = require('fs').promises;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let res = await fetch(fileUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Homebase-Intake/1.0' },
    });

    // On 401/403, try token-based fetch if configured
    if ((res.status === 401 || res.status === 403) && process.env.WP_WEBHOOK_TOKEN && process.env.WP_BASE_URL) {
      const wpEndpoint = process.env.WP_FILE_FETCH_ENDPOINT || '/wp-json/homebase-intake/v1/file';
      const fetchUrl = `${process.env.WP_BASE_URL.replace(/\/$/, '')}${wpEndpoint}?url=${encodeURIComponent(fileUrl)}`;
      res = await fetch(fetchUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Homebase-Intake/1.0',
          Authorization: `Bearer ${process.env.WP_WEBHOOK_TOKEN}`,
        },
      });
    }

    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_FILE_SIZE) {
      throw new Error(`File too large (max ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB)`);
    }

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    if (buf.length > MAX_FILE_SIZE) {
      throw new Error(`File too large (max ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB)`);
    }

    const detected = await FileType.fromBuffer(buf);
    if (!detected || !detected.mime) {
      throw new Error('File type could not be detected from content (possible spoof)');
    }
    if (!ALLOWED_MIME.has(detected.mime)) {
      throw new Error(`File type ${detected.mime} is not allowed`);
    }

    let baseName;
    try {
      const urlPath = new URL(fileUrl).pathname;
      baseName = path.basename(decodeURIComponent(urlPath)) || 'file';
    } catch {
      baseName = 'file';
    }
    const ts = Date.now();
    const rnd = Math.random().toString(36).slice(2, 8);
    const storedFilename = `${ts}-${rnd}-${safeFilename(baseName)}`;
    const displayName = safeFilename(baseName) || baseName;

    await fs.mkdir(destFolder, { recursive: true });
    const fullPath = path.join(destFolder, storedFilename);
    await fs.writeFile(fullPath, buf);

    return {
      fullPath,
      filename: storedFilename,
      displayName,
      size: buf.length,
      mime: detected.mime,
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  fetchFile,
  safeFilename,
  ALLOWED_MIME,
  MAX_FILE_SIZE,
};
