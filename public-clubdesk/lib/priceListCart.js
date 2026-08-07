/**
 * Price list cart (mini calculator) — sessionStorage per list slug.
 * UMD: Jest (CommonJS) + browser global `ClubdeskPriceListCart`.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.ClubdeskPriceListCart = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STORAGE_PREFIX = 'clubdesk-cart:';

  function storageKey(slug) {
    return STORAGE_PREFIX + String(slug || '').trim();
  }

  function lineKey(line) {
    return String(line.id || `${line.category || ''}|${line.title || ''}|${line.price}`);
  }

  function normalizeItem(raw) {
    const price = Number(raw.price);
    const qty = Math.max(0, Math.trunc(Number(raw.qty) || 0));
    return {
      id: String(raw.id || lineKey(raw)),
      title: String(raw.title || ''),
      category: String(raw.category || ''),
      price: Number.isFinite(price) ? price : 0,
      qty,
    };
  }

  function getCart(slug, storage) {
    const store = storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    if (!store) return [];
    try {
      const raw = store.getItem(storageKey(slug));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeItem).filter((item) => item.qty > 0);
    } catch {
      return [];
    }
  }

  function setCart(slug, items, storage) {
    const store = storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    const next = (Array.isArray(items) ? items : [])
      .map(normalizeItem)
      .filter((item) => item.qty > 0);
    if (!store) return next;
    try {
      if (next.length === 0) {
        store.removeItem(storageKey(slug));
      } else {
        store.setItem(storageKey(slug), JSON.stringify(next));
      }
    } catch {
      // ignore quota / private mode
    }
    return next;
  }

  function addItem(slug, line, storage) {
    const cart = getCart(slug, storage);
    const id = lineKey(line);
    const existing = cart.find((item) => item.id === id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push(
        normalizeItem({
          ...line,
          id,
          qty: 1,
        }),
      );
    }
    return setCart(slug, cart, storage);
  }

  function decrementItem(slug, lineId, storage) {
    const cart = getCart(slug, storage);
    const next = cart
      .map((item) => {
        if (item.id !== String(lineId)) return item;
        return { ...item, qty: item.qty - 1 };
      })
      .filter((item) => item.qty > 0);
    return setCart(slug, next, storage);
  }

  function total(items) {
    return (Array.isArray(items) ? items : []).reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const qty = Math.max(0, Math.trunc(Number(item.qty) || 0));
      return sum + price * qty;
    }, 0);
  }

  function uniqueCount(items) {
    return (Array.isArray(items) ? items : []).filter((item) => (item.qty || 0) > 0).length;
  }

  /**
   * Group cart lines by category, ordered like the price list (not add order).
   * @param {Array} cart
   * @param {string[]} categoryOrder category titles in list order
   * @param {string[]} [lineOrder] optional line ids in list order (within category)
   * @returns {Array<[string, Array]>}
   */
  function groupCartByCategoryOrder(cart, categoryOrder, lineOrder) {
    const map = new Map();
    (Array.isArray(cart) ? cart : []).forEach((item) => {
      const cat =
        item.category && String(item.category).trim() ? String(item.category).trim() : 'Övrigt';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(item);
    });

    const lineIndex = new Map();
    (Array.isArray(lineOrder) ? lineOrder : []).forEach((id, i) => {
      if (id != null && id !== '' && !lineIndex.has(String(id))) {
        lineIndex.set(String(id), i);
      }
    });

    function sortLines(items) {
      if (lineIndex.size === 0) return items.slice();
      return items.slice().sort((a, b) => {
        const ai = lineIndex.has(String(a.id))
          ? lineIndex.get(String(a.id))
          : Number.MAX_SAFE_INTEGER;
        const bi = lineIndex.has(String(b.id))
          ? lineIndex.get(String(b.id))
          : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return 0;
      });
    }

    const ordered = [];
    const seen = new Set();
    (Array.isArray(categoryOrder) ? categoryOrder : []).forEach((cat) => {
      const key = String(cat || '').trim();
      if (!key || seen.has(key) || !map.has(key)) return;
      ordered.push([key, sortLines(map.get(key))]);
      seen.add(key);
    });
    map.forEach((items, cat) => {
      if (seen.has(cat)) return;
      ordered.push([cat, sortLines(items)]);
    });
    return ordered;
  }

  function formatMoney(amount, currency, locale) {
    const code = (currency || 'SEK').trim() || 'SEK';
    const value = Number.isFinite(amount) ? amount : 0;
    try {
      return new Intl.NumberFormat(locale || 'sv-SE', {
        style: 'currency',
        currency: code,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${code}`;
    }
  }

  return {
    STORAGE_PREFIX,
    storageKey,
    lineKey,
    getCart,
    setCart,
    addItem,
    decrementItem,
    total,
    uniqueCount,
    groupCartByCategoryOrder,
    formatMoney,
  };
});
