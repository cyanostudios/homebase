// Shared helpers for Facio invoice documents (logo embed + account user label).

const fs = require('fs');
const path = require('path');
const { Logger } = require('@homebase/core');

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Derive a human-readable name from email local-part (users have no display name column).
 * e.g. mario.nasr@homebase.se → "Mario Nasr"
 * @param {string|null|undefined} email
 * @returns {string}
 */
function displayNameFromEmail(email) {
  if (!email || typeof email !== 'string') {
    return '';
  }
  const trimmed = email.trim();
  if (!trimmed) {
    return '';
  }
  const local = trimmed.split('@')[0] || '';
  const name = local
    .replace(/[._+-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return name || trimmed;
}

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

/**
 * Embed organization logo as data URI so PDF (network-blocked) and iframe srcDoc work.
 * @param {string|null|undefined} logoUrl
 * @returns {Promise<string>} data URI or original URL if embed fails / not needed
 */
async function resolveLogoDataUrl(logoUrl) {
  if (!logoUrl || typeof logoUrl !== 'string') {
    return '';
  }
  const url = logoUrl.trim();
  if (!url) {
    return '';
  }
  if (url.startsWith('data:')) {
    return url;
  }

  try {
    const rawMarker = '/api/files/raw/';
    const rawIdx = url.indexOf(rawMarker);
    if (rawIdx !== -1) {
      const encoded = url.slice(rawIdx + rawMarker.length).split(/[?#]/)[0];
      const filename = path.basename(decodeURIComponent(encoded));
      if (!filename || filename === '.' || filename === '..') {
        return url;
      }
      const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
      const abs = path.resolve(uploadRoot, filename);
      if (
        !abs.startsWith(path.resolve(uploadRoot) + path.sep) &&
        abs !== path.resolve(uploadRoot)
      ) {
        return url;
      }
      if (!fs.existsSync(abs)) {
        return url;
      }
      const buf = fs.readFileSync(abs);
      if (buf.length > MAX_LOGO_BYTES) {
        Logger.warn('Invoice logo too large to embed', { size: buf.length });
        return url;
      }
      const mime = mimeFromExt(abs);
      return `data:${mime};base64,${buf.toString('base64')}`;
    }

    if (/^https?:\/\//i.test(url)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          return url;
        }
        const mime = (res.headers.get('content-type') || 'image/png').split(';')[0].trim();
        if (!mime.startsWith('image/')) {
          return url;
        }
        const ab = await res.arrayBuffer();
        if (ab.byteLength > MAX_LOGO_BYTES) {
          Logger.warn('Invoice logo too large to embed', { size: ab.byteLength });
          return url;
        }
        return `data:${mime};base64,${Buffer.from(ab).toString('base64')}`;
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (err) {
    Logger.warn('Failed to embed invoice logo', { message: err?.message });
  }

  return url;
}

module.exports = {
  displayNameFromEmail,
  resolveLogoDataUrl,
};
