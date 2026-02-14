// plugins/fyndiq-products/fetchCategories.js
// Shared fetch for Fyndiq categories (used by controller and category-cache job).
// Same exact API call and mapping; no fallbacks (see .cursor/rules/cdon-fyndiq-no-fallbacks.mdc).

const FYNDIQ_BASE = 'https://merchants-api.fyndiq.se';

function getFetch() {
  return typeof fetch === 'function'
    ? fetch
    : async (...args) => {
        const mod = await import('node-fetch').catch(() => null);
        if (!mod?.default) throw new Error('fetch is not available (Node <18) and node-fetch is not installed');
        return mod.default(...args);
      };
}

function getBasicAuthHeader(username, password) {
  const u = String(username ?? '').trim();
  const p = String(password ?? '').trim();
  if (!u || !p) return '';
  return `Basic ${Buffer.from(`${u}:${p}`, 'utf8').toString('base64')}`;
}

/**
 * Fetch categories from Fyndiq API. Same request and shape as controller getCategories.
 * @param {string} market - e.g. se
 * @param {string} language - e.g. sv-SE
 * @param {string} username - API key
 * @param {string} password - API secret
 * @returns {Promise<Array<{ id: string, name: string, path?: string }>>}
 */
async function fetchCategoriesFromApi(market, language, username, password) {
  const m = String(market || '').trim().toLowerCase();
  const lang = String(language || '').trim();
  if (!m || !lang) throw new Error('market and language are required');
  const auth = getBasicAuthHeader(username, password);
  if (!auth) throw new Error('Fyndiq auth: username and password must both be non-empty');

  const path = `/api/v1/categories/${encodeURIComponent(m)}/${encodeURIComponent(lang)}/`;
  const url = `${FYNDIQ_BASE}${path}`;
  const fetchFn = getFetch();
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('Authorization', auth);
  headers.set('X-Client-Name', 'homebase');

  let resp = await fetchFn(url, { method: 'GET', headers, redirect: 'manual' });
  let text = await resp.text().catch(() => '');
  const maxRedirects = 5;
  for (let i = 0; i < maxRedirects && [301, 302, 307, 308].includes(resp.status); i++) {
    const location = resp.headers.get('Location');
    if (!location) break;
    resp = await fetchFn(location, { method: 'GET', headers, redirect: 'manual' });
    text = await resp.text().catch(() => '');
  }
  let json = null;
  if (text) {
    try { json = JSON.parse(text); } catch { json = null; }
  }

  if (!resp.ok) {
    const detail = json?.message || json?.error || (typeof json === 'object' ? JSON.stringify(json) : null) || text || resp.statusText || `HTTP ${resp.status}`;
    throw new Error(detail);
  }

  return Array.isArray(json)
    ? json.map((x) => ({
        id: String(x?.id ?? ''),
        name: String(x?.name ?? ''),
        path: x?.path != null ? String(x.path) : undefined,
      }))
    : [];
}

module.exports = { fetchCategoriesFromApi };
