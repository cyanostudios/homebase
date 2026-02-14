// plugins/cdon-products/fetchCategories.js
// Shared fetch for CDON categories (used by controller and category-cache job).
// Same exact API call and normalization; no fallbacks (see .cursor/rules/cdon-fyndiq-no-fallbacks.mdc).

const CDON_MERCHANTS_API = 'https://merchants-api.cdon.com/api';

function getFetch() {
  return typeof fetch === 'function'
    ? fetch
    : async (...args) => {
        const mod = await import('node-fetch').catch(() => null);
        if (!mod?.default) throw new Error('fetch is not available (Node <18) and node-fetch is not installed');
        return mod.default(...args);
      };
}

function getCdonAuthHeader(merchantId, apiToken) {
  const id = String(merchantId ?? '').trim();
  const token = String(apiToken ?? '').trim();
  if (!id || !token) return '';
  return `Basic ${Buffer.from(`${id}:${token}`, 'utf8').toString('base64')}`;
}

function normalizeCategoryItems(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((x) => {
    const path = x?.path != null ? String(x.path).trim() : '';
    const name = String(x?.name ?? '').trim();
    return { id: path, name, path };
  });
}

/**
 * Fetch categories from CDON Merchants API. Same request and shape as controller getCategories.
 * @param {string} market - e.g. SE
 * @param {string} language - e.g. sv-SE
 * @param {string} merchantId - API key (Merchant ID)
 * @param {string} apiToken - API secret (token)
 * @returns {Promise<Array<{ id: string, name: string, path: string }>>}
 */
async function fetchCategoriesFromApi(market, language, merchantId, apiToken) {
  const m = String(market || '').trim();
  const lang = String(language || '').trim();
  if (!m || !lang) throw new Error('market and language are required');
  const auth = getCdonAuthHeader(merchantId, apiToken);
  if (!auth) throw new Error('CDON auth: merchantID and API token must both be non-empty');

  const url = `${CDON_MERCHANTS_API}/v1/categories/${encodeURIComponent(m)}/${encodeURIComponent(lang)}/`;
  const fetchFn = getFetch();
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('Authorization', auth);

  let resp = await fetchFn(url, { method: 'GET', headers, redirect: 'manual' });
  let text = await resp.text().catch(() => '');
  if ([301, 302, 307, 308].includes(resp.status)) {
    const location = resp.headers.get('Location');
    if (location) {
      resp = await fetchFn(location, { method: 'GET', headers, redirect: 'manual' });
      text = await resp.text().catch(() => '');
    }
  }

  let json = null;
  if (text) {
    try { json = JSON.parse(text); } catch { json = null; }
  }

  if (!resp.ok) {
    const detail = json?.message ?? json?.error_description ?? json?.error ?? (typeof json === 'object' ? JSON.stringify(json) : null) ?? text ?? resp.statusText;
    const message = (detail != null && String(detail).trim() !== '') ? String(detail) : `HTTP ${resp.status}`;
    throw new Error(message);
  }

  return normalizeCategoryItems(json);
}

module.exports = { fetchCategoriesFromApi };
