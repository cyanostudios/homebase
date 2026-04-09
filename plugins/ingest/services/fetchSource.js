// plugins/ingest/services/fetchSource.js
// Fetch strategies for ingest: generic_http (axios) and browser_fetch (separate module). No site-specific parsing.
const axios = require('axios');
const { fetchSourceBrowserFetch } = require('./fetchSourceBrowserFetch');
const { bufferLooksLikePdf, isPdfContentType, pdfTextFromBuffer } = require('./pdfTextFromBuffer');

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_EXCERPT = 8000;

/**
 * Server-side fetch (axios) has no browser cookies. For ingest sources pointing at our own
 * authenticated file download URLs, forward the incoming session cookie so PDF/HTML can be read.
 * @param {import('express').Request|null|undefined} req
 * @param {string} sourceUrl
 * @returns {string|undefined}
 */
function cookieHeaderForInternalFileUrl(req, sourceUrl) {
  if (!req?.headers?.cookie || !sourceUrl || typeof sourceUrl !== 'string') {
    return undefined;
  }
  try {
    const u = new URL(sourceUrl);
    if (!u.pathname.includes('/api/files/')) {
      return undefined;
    }
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') {
      return req.headers.cookie;
    }
    const reqHost = typeof req.get === 'function' ? req.get('host') : null;
    if (reqHost && u.host === reqHost) {
      return req.headers.cookie;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * @typedef {Object} FetchSourceInput
 * @property {string} sourceUrl
 * @property {string} [sourceType]
 * @property {string} [fetchMethod]
 */

/**
 * Generic HTTP fetch (axios). Binary types stay as placeholders except PDF, which is decoded via pdf-parse.
 * @param {string} sourceUrl
 * @param {{ sourceType?: string }} [options]
 */
async function fetchSourceGenericHttp(sourceUrl, options = {}) {
  const sourceTypeHint =
    typeof options.sourceType === 'string' ? options.sourceType.trim().toLowerCase() : '';
  const cookieHeader =
    typeof options.cookieHeader === 'string' && options.cookieHeader.trim()
      ? options.cookieHeader.trim()
      : undefined;
  try {
    const res = await axios.get(sourceUrl, {
      timeout: 30000,
      maxContentLength: MAX_BYTES,
      maxBodyLength: MAX_BYTES,
      validateStatus: () => true,
      responseType: 'arraybuffer',
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    });

    const status = res.status;
    const rawCt = res.headers['content-type'];
    const contentType = typeof rawCt === 'string' ? rawCt.split(';')[0].trim() || null : null;
    const buf = Buffer.from(res.data);
    const contentLength = buf.length;

    const responseUrl = res.request?.res?.responseUrl || res.request?.responseURL || sourceUrl;
    const finalUrl = typeof responseUrl === 'string' ? responseUrl : sourceUrl;

    const looksBinary =
      !contentType || /^(image|audio|video|application\/octet-stream)/i.test(contentType);

    const ok = status >= 200 && status < 300;
    const tryAsPdf =
      ok &&
      buf.length > 0 &&
      (isPdfContentType(contentType) || bufferLooksLikePdf(buf) || sourceTypeHint === 'pdf');

    let bodyText;
    let excerpt;
    if (tryAsPdf) {
      try {
        const text = await pdfTextFromBuffer(buf);
        bodyText = text;
        excerpt = text.slice(0, MAX_EXCERPT);
        if (text.length > MAX_EXCERPT) {
          excerpt += '\n…';
        }
      } catch (e) {
        const msg = e && e.message ? String(e.message) : 'parse error';
        const asUtf8 = buf.toString('utf8');
        if (/^\s*</.test(asUtf8.slice(0, 64))) {
          bodyText = asUtf8;
          excerpt = asUtf8.slice(0, MAX_EXCERPT);
          if (asUtf8.length > MAX_EXCERPT) {
            excerpt += '\n…';
          }
        } else {
          const placeholder = `[PDF text extraction failed: ${msg}; ${contentType || 'unknown'}; ${contentLength} bytes]`;
          bodyText = placeholder;
          excerpt = placeholder;
        }
      }
    } else if (looksBinary && !/^text\//i.test(contentType || '')) {
      const placeholder = `[Non-text response; ${contentType || 'unknown'}; ${contentLength} bytes]`;
      bodyText = placeholder;
      excerpt = placeholder;
    } else {
      const text = buf.toString('utf8');
      // Full document for downstream parsers (e.g. cups accordion scrape). Download is already capped by MAX_BYTES.
      bodyText = text;
      excerpt = text.slice(0, MAX_EXCERPT);
      if (text.length > MAX_EXCERPT) {
        excerpt += '\n…';
      }
    }
    return {
      ok,
      status,
      contentType,
      contentLength,
      bodyText,
      excerpt,
      finalUrl,
      errorMessage: ok ? null : `HTTP ${status}`,
    };
  } catch (err) {
    const status = err.response?.status ?? null;
    const msg =
      status !== undefined && status !== null
        ? `HTTP ${status}`
        : err.code === 'ECONNABORTED'
          ? 'Request timed out'
          : err.message || 'Fetch failed';
    return {
      ok: false,
      status,
      contentType: null,
      contentLength: null,
      bodyText: null,
      excerpt: null,
      finalUrl: null,
      errorMessage: msg,
    };
  }
}

/**
 * Normalized result (guide output shape).
 * For fetchMethod browser_fetch only, excerpt may start with an HTML comment containing JSON diagnostics;
 * generic_http is unchanged.
 * @returns {Promise<{
 *   ok: boolean,
 *   status: number|null,
 *   contentType: string|null,
 *   contentLength: number|null,
 *   bodyText: string|null,
 *   excerpt: string|null,
 *   finalUrl: string|null,
 *   errorMessage: string|null
 * }>}
 */
async function fetchSource(input) {
  const sourceUrl = typeof input === 'string' ? input : input?.sourceUrl;
  if (!sourceUrl || typeof sourceUrl !== 'string') {
    return {
      ok: false,
      status: null,
      contentType: null,
      contentLength: null,
      bodyText: null,
      excerpt: null,
      finalUrl: null,
      errorMessage: 'Missing source URL',
    };
  }

  try {
    // eslint-disable-next-line no-new
    new URL(sourceUrl);
  } catch {
    return {
      ok: false,
      status: null,
      contentType: null,
      contentLength: null,
      bodyText: null,
      excerpt: null,
      finalUrl: null,
      errorMessage: 'Invalid URL',
    };
  }

  const fetchMethodRaw =
    typeof input === 'object' && input && typeof input.fetchMethod === 'string'
      ? input.fetchMethod.trim()
      : 'generic_http';

  const sourceTypeOpt =
    typeof input === 'object' && input && typeof input.sourceType === 'string'
      ? input.sourceType
      : '';

  const cookieHeaderOverride =
    typeof input === 'object' &&
    input &&
    typeof input.cookieHeader === 'string' &&
    input.cookieHeader.trim()
      ? input.cookieHeader.trim()
      : undefined;

  if (fetchMethodRaw === 'browser_fetch') {
    return fetchSourceBrowserFetch(sourceUrl, { sourceType: sourceTypeOpt });
  }

  return fetchSourceGenericHttp(sourceUrl, {
    sourceType: sourceTypeOpt,
    cookieHeader: cookieHeaderOverride,
  });
}

/** @param {string} url */
async function fetchSourceFromUrl(url) {
  return fetchSource({ sourceUrl: url, sourceType: 'other', fetchMethod: 'generic_http' });
}

module.exports = {
  fetchSource,
  fetchSourceFromUrl,
  cookieHeaderForInternalFileUrl,
  MAX_EXCERPT,
  MAX_BYTES,
};
