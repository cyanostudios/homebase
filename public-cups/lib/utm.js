/**
 * Append utm_source=cupappen on outbound registration URLs.
 * UMD: Jest (CommonJS) + browser global `CupappenUtm`.
 *
 * Decodes HTML entities first so stored `&amp;` does not become `amp;lang=…`
 * (which breaks Procup/Cupmate query strings).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.CupappenUtm = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function decodeUrlEntities(raw) {
    return String(raw || '')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/gi, "'");
  }

  /**
   * @param {string} urlValue
   * @returns {string}
   */
  function withCupappenUtm(urlValue) {
    let raw = decodeUrlEntities(String(urlValue || '').trim());
    if (!raw) return raw;

    let hash = '';
    const hashPos = raw.indexOf('#');
    if (hashPos !== -1) {
      hash = raw.slice(hashPos);
      raw = raw.slice(0, hashPos);
    }

    if (/[?&]utm_source=/i.test(raw)) {
      const out = raw.replace(/([?&])utm_source=[^&]*/i, '$1utm_source=cupappen');
      return out.replace('?&', '?') + hash;
    }

    const sep = raw.includes('?') ? '&' : '?';
    return `${raw}${sep}utm_source=cupappen${hash}`;
  }

  return { decodeUrlEntities, withCupappenUtm };
});
