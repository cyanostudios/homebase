// plugins/woocommerce-products/fetchCategories.js
// Shared fetch for WooCommerce categories (used by controller and category-cache job).
// Same request and shape as controller getCategories.

function normalizeBaseUrl(url) {
  let trimmed = String(url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

function getFetch() {
  return typeof fetch === 'function'
    ? fetch
    : async (...args) => {
        const mod = await import('node-fetch').catch(() => null);
        if (!mod?.default) throw new Error('fetch is not available (Node <18) and node-fetch is not installed');
        return mod.default(...args);
      };
}

async function fetchWithWooAuth(url, init, settings) {
  const { consumerKey, consumerSecret, useQueryAuth } = settings;
  let finalUrl = url;
  const headers = { ...(init?.headers || {}) };

  if (useQueryAuth) {
    const u = new URL(finalUrl);
    u.searchParams.set('consumer_key', consumerKey);
    u.searchParams.set('consumer_secret', consumerSecret);
    finalUrl = u.toString();
  } else {
    const token = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${token}`;
  }

  const fetchFn = getFetch();
  return fetchFn(finalUrl, { ...init, headers });
}

/**
 * Fetch all category pages from WooCommerce. Same request and shape as controller getCategories.
 * @param {object} credentials - { storeUrl, consumerKey, consumerSecret, useQueryAuth? }
 * @param {number} [perPage=100] - per page (1–100)
 * @returns {Promise<Array<{ id: string, name: string, parent?: number }>>}
 */
async function fetchCategoriesFromApi(credentials, perPage = 100) {
  const base = normalizeBaseUrl(credentials?.storeUrl);
  if (!base) throw new Error('storeUrl is required');
  if (!credentials?.consumerKey || !credentials?.consumerSecret) {
    throw new Error('consumerKey and consumerSecret are required');
  }
  const per = Number.isFinite(perPage) ? Math.min(Math.max(Math.trunc(perPage), 1), 100) : 100;
  const allItems = [];
  let page = 1;

  for (;;) {
    const url = new URL(`${base}/wp-json/wc/v3/products/categories`);
    url.searchParams.set('per_page', String(per));
    url.searchParams.set('page', String(page));

    const resp = await fetchWithWooAuth(url.toString(), { method: 'GET' }, credentials);
    const text = await resp.text().catch(() => '');
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }

    if (!resp.ok) {
      throw new Error(json?.message || json?.code || text || resp.statusText || `HTTP ${resp.status}`);
    }

    const items = Array.isArray(json) ? json : [];
    allItems.push(...items);

    if (items.length < per) break;
    page += 1;
  }

  return allItems.map((x) => ({
    id: String(x?.id ?? ''),
    name: String(x?.name ?? ''),
    parent: x?.parent != null ? Number(x.parent) : 0,
  }));
}

module.exports = { fetchCategoriesFromApi };
