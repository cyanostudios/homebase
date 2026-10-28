// plugins/site-audits/services/securityHeadersInventory.js
// Normalize homepage response headers into a fixed securityheaders-style presence matrix.
const VALUE_CAP = 200;

function headerMap(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [key, value] of Object.entries(headers)) {
    out[String(key).toLowerCase()] = value;
  }
  return out;
}

function firstHeaderValue(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.length ? String(raw[0]) : null;
  return String(raw);
}

function truncateValue(raw) {
  const value = firstHeaderValue(raw);
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > VALUE_CAP ? `${trimmed.slice(0, VALUE_CAP)}…` : trimmed;
}

function headerPresent(map, name) {
  const value = truncateValue(map[name]);
  return value != null;
}

function cspHasFrameAncestors(cspValue) {
  if (!cspValue) return false;
  return /(?:^|;)\s*frame-ancestors\b/i.test(cspValue);
}

/**
 * @param {Object} homepageHeaders - lower-cased or raw Node response headers
 * @returns {{
 *   hsts: { present: boolean, value: string|null },
 *   csp: { present: boolean, value: string|null },
 *   xcto: { present: boolean, value: string|null },
 *   referrerPolicy: { present: boolean, value: string|null },
 *   permissionsPolicy: { present: boolean, value: string|null },
 *   frameProtection: { present: boolean, value: string|null, via: 'xfo'|'csp'|null }
 * }}
 */
function buildSecurityHeadersInventory(homepageHeaders) {
  const map = headerMap(homepageHeaders);
  const hstsValue = truncateValue(map['strict-transport-security']);
  const cspValue = truncateValue(map['content-security-policy']);
  const xctoValue = truncateValue(map['x-content-type-options']);
  const referrerValue = truncateValue(map['referrer-policy']);
  const permissionsValue =
    truncateValue(map['permissions-policy']) || truncateValue(map['feature-policy']);
  const xfoValue = truncateValue(map['x-frame-options']);
  const frameViaCsp = cspHasFrameAncestors(cspValue);
  const framePresent = Boolean(xfoValue) || frameViaCsp;

  return {
    hsts: { present: headerPresent(map, 'strict-transport-security'), value: hstsValue },
    csp: { present: headerPresent(map, 'content-security-policy'), value: cspValue },
    xcto: { present: headerPresent(map, 'x-content-type-options'), value: xctoValue },
    referrerPolicy: { present: Boolean(referrerValue), value: referrerValue },
    permissionsPolicy: { present: Boolean(permissionsValue), value: permissionsValue },
    frameProtection: {
      present: framePresent,
      value: xfoValue || (frameViaCsp ? 'frame-ancestors (CSP)' : null),
      via: xfoValue ? 'xfo' : frameViaCsp ? 'csp' : null,
    },
  };
}

module.exports = {
  buildSecurityHeadersInventory,
  cspHasFrameAncestors,
  VALUE_CAP,
};
