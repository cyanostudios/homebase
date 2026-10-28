// plugins/site-audits/services/urlGuard.js
// SSRF guard for site-audits. Extends server/core/utils/ssrfUrlGuard (HTTPS-only, hostname-only
// checks used by ingest) because audits must:
//   1. Allow both http and https (an HTTP-only target is itself a finding to report).
//   2. Resolve DNS and reject private/reserved IPv4 *and* IPv6 ranges (ssrfUrlGuard only
//      covers IPv4 literals in the hostname string, not DNS results or IPv6).
// Node's WHATWG URL parser rewrites IPv4-mapped IPv6 to hex form (`[::ffff:7f00:1]` for
// 127.0.0.1). Prefix checks on the dotted form miss that, so range checks go through
// net.BlockList, which treats IPv4-mapped addresses as the embedded IPv4.
const dns = require('dns');
const { BlockList, isIP } = require('net');
const { isBlockedHostname } = require('../../../server/core/utils/ssrfUrlGuard');

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const blockList = new BlockList();

function block4(address, prefix) {
  blockList.addSubnet(address, prefix, 'ipv4');
}

function block6(address, prefix) {
  blockList.addSubnet(address, prefix, 'ipv6');
}

// Private, shared, and reserved IPv4 (RFC1918, loopback, link-local, CGNAT, TEST-NETs,
// benchmarking, multicast, and the class-E range).
block4('0.0.0.0', 8);
block4('10.0.0.0', 8);
block4('100.64.0.0', 10);
block4('127.0.0.0', 8);
block4('169.254.0.0', 16);
block4('172.16.0.0', 12);
block4('192.0.0.0', 24);
block4('192.0.2.0', 24);
block4('192.88.99.0', 24);
block4('192.168.0.0', 16);
block4('198.18.0.0', 15);
block4('198.51.100.0', 24);
block4('203.0.113.0', 24);
block4('224.0.0.0', 4);
block4('240.0.0.0', 4);

// IPv6: unspecified, loopback, discard, Teredo, documentation, ULA, link-local,
// deprecated site-local, multicast. IPv4-mapped (::ffff:0:0/96) is not blocked as a
// whole — BlockList maps those onto the IPv4 rules above so public embeddings stay allowed.
blockList.addAddress('::', 'ipv6');
blockList.addAddress('::1', 'ipv6');
block6('100::', 64);
block6('2001::', 32);
block6('2001:db8::', 32);
block6('fc00::', 7);
block6('fe80::', 10);
block6('fec0::', 10);
block6('ff00::', 8);

function stripIpLiteral(ip) {
  return String(ip || '')
    .trim()
    .replace(/^\[|\]$/g, '');
}

/**
 * Expand an IPv6 address to eight hextets. Used only to inspect transition prefixes
 * (NAT64, 6to4) that embed an IPv4 address BlockList does not see on its own.
 * @param {string} ip
 * @returns {number[]|null}
 */
function expandIpv6(ip) {
  let value = ip.toLowerCase().split('%')[0];
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    const dotted = value.slice(lastColon + 1);
    const octets = dotted.split('.').map((part) => Number.parseInt(part, 10));
    if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return null;
    }
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    value = `${value.slice(0, lastColon)}:${hi}:${lo}`;
  }

  const halves = value.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const missing = 8 - (head.length + tail.length);
  if (missing < 0) return null;
  const parts = halves.length === 1 ? head : [...head, ...Array(missing).fill('0'), ...tail];
  if (parts.length !== 8) return null;
  const nums = parts.map((part) => Number.parseInt(part, 16));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;
  return nums;
}

function ipv4FromHextets(hi, lo) {
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

/**
 * NAT64 well-known prefix (64:ff9b::/96) and 6to4 (2002::/16) carry an IPv4 address in
 * the payload. Reject the address when that embedded IPv4 is private or reserved.
 * @param {string} ip
 * @returns {boolean}
 */
function embeddedIpv4IsPrivate(ip) {
  const hextets = expandIpv6(ip);
  if (!hextets) return true;

  const nat64 =
    hextets[0] === 0x64 &&
    hextets[1] === 0xff9b &&
    hextets[2] === 0 &&
    hextets[3] === 0 &&
    hextets[4] === 0 &&
    hextets[5] === 0;
  if (nat64) {
    return blockList.check(ipv4FromHextets(hextets[6], hextets[7]), 'ipv4');
  }

  if (hextets[0] === 0x2002) {
    return blockList.check(ipv4FromHextets(hextets[1], hextets[2]), 'ipv4');
  }

  return false;
}

/**
 * @param {string} ip - IPv4 or IPv6 address string (brackets optional)
 * @returns {boolean} true if the address is private/reserved/loopback/link-local, or not an IP
 */
function isPrivateIp(ip) {
  const value = stripIpLiteral(ip);
  if (!value) return true;
  const kind = isIP(value);
  if (kind === 4) return blockList.check(value, 'ipv4');
  if (kind === 6) {
    if (blockList.check(value, 'ipv6')) return true;
    return embeddedIpv4IsPrivate(value);
  }
  // Unparseable "IP" — fail closed. Callers that have a hostname must not use this
  // result as a hostname block (see validateAuditUrl).
  return true;
}

/**
 * Validate a user-supplied audit target URL: scheme (http/https only), no embedded
 * credentials, and hostname not a known-blocked literal (localhost/loopback/metadata/etc).
 * Does NOT perform DNS resolution — use resolveAndAssertPublic() for that.
 * @param {string} urlString
 * @returns {{ ok: true, url: URL } | { ok: false, error: string }}
 */
function validateAuditUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(String(urlString ?? '').trim());
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, error: 'Only http and https URLs are allowed' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URL credentials are not allowed' };
  }
  if (isBlockedHostname(parsed.hostname)) {
    return { ok: false, error: 'URL host is not allowed' };
  }

  // WHATWG hostnames for IPv6 include brackets (`[::ffff:7f00:1]`). Strip them before
  // the IP check. Hostnames that are not IP literals are left to DNS resolution.
  const bareHost = stripIpLiteral(parsed.hostname);
  if (isIP(bareHost) && isPrivateIp(bareHost)) {
    return { ok: false, error: 'URL host is not allowed' };
  }

  return { ok: true, url: parsed };
}

/**
 * Resolve a hostname and assert every returned address is public. This is a defense-in-depth
 * pre-check (run once before crawling); safeFetch.js performs the authoritative, per-connection
 * check at actual connect time (protects against DNS rebinding between this check and the fetch).
 * @param {string} hostname
 * @returns {Promise<{ ok: true, addresses: string[] } | { ok: false, error: string }>}
 */
async function resolveAndAssertPublic(hostname) {
  const bareHost = stripIpLiteral(hostname);
  if (isIP(bareHost)) {
    if (isPrivateIp(bareHost)) {
      return { ok: false, error: `${bareHost} is a private/reserved address` };
    }
    return { ok: true, addresses: [bareHost] };
  }

  let records;
  try {
    records = await dns.promises.lookup(bareHost, { all: true, verbatim: true });
  } catch (err) {
    return { ok: false, error: `DNS lookup failed for ${bareHost}: ${err.message || err}` };
  }
  const list = Array.isArray(records) ? records : [records].filter(Boolean);
  if (!list.length) {
    return { ok: false, error: `DNS lookup for ${bareHost} returned no addresses` };
  }
  const privateHit = list.find((record) => isPrivateIp(record.address));
  if (privateHit) {
    return {
      ok: false,
      error: `${bareHost} resolves to a private/reserved address (${privateHit.address})`,
    };
  }
  return { ok: true, addresses: list.map((record) => record.address) };
}

module.exports = {
  validateAuditUrl,
  isPrivateIp,
  resolveAndAssertPublic,
};
