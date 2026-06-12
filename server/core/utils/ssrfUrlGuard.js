// Block server-side fetches to private networks and non-HTTPS targets (ingest SSRF guard).

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal',
  'metadata.google',
]);

function parseIpv4(host) {
  const parts = host.split('.');
  if (parts.length !== 4) {
    return null;
  }
  const octets = parts.map((p) => Number.parseInt(p, 10));
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }
  return octets;
}

function isPrivateOrReservedIpv4(octets) {
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isBlockedHostname(hostname) {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (!host) {
    return true;
  }
  if (BLOCKED_HOSTNAMES.has(host)) {
    return true;
  }
  if (host.endsWith('.localhost') || host.endsWith('.local')) {
    return true;
  }
  const ipv4 = parseIpv4(host);
  if (ipv4 && isPrivateOrReservedIpv4(ipv4)) {
    return true;
  }
  return false;
}

/**
 * @param {string} urlString
 * @returns {{ ok: true, url: URL } | { ok: false, error: string }}
 */
function validatePublicHttpsUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(String(urlString).trim());
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only HTTPS URLs are allowed' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URL credentials are not allowed' };
  }
  if (isBlockedHostname(parsed.hostname)) {
    return { ok: false, error: 'URL host is not allowed' };
  }

  return { ok: true, url: parsed };
}

module.exports = {
  validatePublicHttpsUrl,
  isBlockedHostname,
};
