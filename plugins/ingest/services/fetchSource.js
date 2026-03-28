// plugins/ingest/services/fetchSource.js
// Generic HTTP fetch for ingest (guide §9). No site-specific parsing.
const axios = require('axios');

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_EXCERPT = 8000;

/**
 * @typedef {Object} FetchSourceInput
 * @property {string} sourceUrl
 * @property {string} [sourceType]
 * @property {string} [fetchMethod]
 */

/**
 * Normalized result (guide output shape).
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

  try {
    const res = await axios.get(sourceUrl, {
      timeout: 30000,
      maxContentLength: MAX_BYTES,
      maxBodyLength: MAX_BYTES,
      validateStatus: () => true,
      responseType: 'arraybuffer',
    });

    const status = res.status;
    const rawCt = res.headers['content-type'];
    const contentType = typeof rawCt === 'string' ? rawCt.split(';')[0].trim() || null : null;
    const buf = Buffer.from(res.data);
    const contentLength = buf.length;

    const responseUrl = res.request?.res?.responseUrl || res.request?.responseURL || sourceUrl;
    const finalUrl = typeof responseUrl === 'string' ? responseUrl : sourceUrl;

    const looksBinary =
      !contentType ||
      /^(image|audio|video|application\/pdf|application\/octet-stream)/i.test(contentType);

    let bodyText;
    let excerpt;
    if (looksBinary && !/^text\//i.test(contentType || '')) {
      const placeholder = `[Non-text response; ${contentType || 'unknown'}; ${contentLength} bytes]`;
      bodyText = placeholder;
      excerpt = placeholder;
    } else {
      const text = buf.toString('utf8');
      bodyText = text.slice(0, MAX_EXCERPT);
      excerpt = text.slice(0, MAX_EXCERPT);
      if (text.length > MAX_EXCERPT) {
        bodyText += '\n…';
        excerpt += '\n…';
      }
    }

    const ok = status >= 200 && status < 300;
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

/** @param {string} url */
async function fetchSourceFromUrl(url) {
  return fetchSource({ sourceUrl: url, sourceType: 'other', fetchMethod: 'generic_http' });
}

module.exports = {
  fetchSource,
  fetchSourceFromUrl,
  MAX_EXCERPT,
  MAX_BYTES,
};
