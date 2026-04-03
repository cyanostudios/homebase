/**
 * Validate that a URL points to an image (http/https, Content-Type image/*).
 * Uses HEAD first, then GET with Range, then full GET as last resort.
 */

const DEFAULT_TIMEOUT_MS = 12000;

function isImageContentType(ct) {
  const s = String(ct || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  return s.startsWith('image/');
}

/**
 * @param {string} urlString
 * @param {{ timeoutMs?: number, fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ ok: true } | { ok: false; code: string; detail?: string }>}
 */
async function validateImageUrl(urlString, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return { ok: false, code: 'fetch_unavailable', detail: 'global fetch is not available' };
  }

  let u;
  try {
    u = new URL(String(urlString).trim());
  } catch {
    return { ok: false, code: 'invalid_url' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, code: 'invalid_protocol' };
  }

  const runFetch = async (init) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(String(u.href), {
        ...init,
        signal: controller.signal,
        redirect: 'follow',
      });
    } finally {
      clearTimeout(t);
    }
  };

  try {
    let res = await runFetch({ method: 'HEAD' });
    let ct = res.headers.get('content-type');
    if (res.ok && isImageContentType(ct)) {
      return { ok: true };
    }

    res = await runFetch({
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
    });
    ct = res.headers.get('content-type');
    if ((res.ok || res.status === 206) && isImageContentType(ct)) {
      return { ok: true };
    }

    res = await runFetch({ method: 'GET' });
    ct = res.headers.get('content-type');
    if (res.ok && isImageContentType(ct)) {
      return { ok: true };
    }

    return {
      ok: false,
      code: 'not_image',
      detail: ct || `status ${res.status}`,
    };
  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'timeout' : String(e?.message || e);
    return { ok: false, code: 'fetch_error', detail: msg };
  }
}

/**
 * Validate many URLs with limited concurrency.
 * @param {string[]} urls
 * @param {{ timeoutMs?: number; concurrency?: number; fetchImpl?: typeof fetch }} [options]
 */
async function validateImageUrls(urls, options = {}) {
  const list = Array.isArray(urls) ? urls.map((x) => String(x).trim()).filter(Boolean) : [];
  const concurrency = Math.max(1, Math.min(8, Number(options.concurrency) || 4));
  const results = new Array(list.length);
  let i = 0;

  async function worker() {
    while (i < list.length) {
      const idx = i;
      i += 1;
      const url = list[idx];
      results[idx] = await validateImageUrl(url, options);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, list.length) }, () => worker());
  await Promise.all(workers);

  const firstBad = results.findIndex((r) => !r.ok);
  if (firstBad >= 0) {
    return { ok: false, index: firstBad, url: list[firstBad], result: results[firstBad] };
  }
  return { ok: true, results };
}

module.exports = {
  validateImageUrl,
  validateImageUrls,
  isImageContentType,
  DEFAULT_TIMEOUT_MS,
};
