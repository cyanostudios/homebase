// plugins/site-audits/services/tlsInventory.js
// TLS peek for the audit host using the same public-IP lookup as safeFetch (SSRF-safe).
const tls = require('tls');
const { isIP } = require('net');
const { createSafeLookup, TIMEOUT_MS } = require('./safeFetch');
const { isPrivateIp } = require('./urlGuard');

const ISSUER_CAP = 120;

function truncate(value, cap = ISSUER_CAP) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.length > cap ? `${text.slice(0, cap)}…` : text;
}

function issuerLabel(cert) {
  if (!cert || typeof cert !== 'object') return null;
  const issuer = cert.issuer || {};
  return truncate(issuer.O || issuer.CN || issuer.organizationName || issuer.commonName || '');
}

function certMatchesHostname(cert, hostname) {
  if (!cert || !hostname) return false;
  try {
    // Node 15+: tls.checkServerIdentity
    const err = tls.checkServerIdentity(hostname, cert);
    return !err;
  } catch {
    return false;
  }
}

/**
 * @param {string} hostname
 * @param {{ port?: number }} [options]
 * @returns {Promise<{
 *   ok: boolean,
 *   protocol: string|null,
 *   authorized: boolean|null,
 *   validFrom: string|null,
 *   validTo: string|null,
 *   daysRemaining: number|null,
 *   issuer: string|null,
 *   hostnameMatch: boolean|null,
 *   error: string|null
 * }>}
 */
function inspectTls(hostname, options = {}) {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const port = options.port || 443;

  if (!host) {
    return Promise.resolve({
      ok: false,
      protocol: null,
      authorized: null,
      validFrom: null,
      validTo: null,
      daysRemaining: null,
      issuer: null,
      hostnameMatch: null,
      error: 'Missing hostname',
    });
  }

  if (isIP(host) && isPrivateIp(host)) {
    return Promise.resolve({
      ok: false,
      protocol: null,
      authorized: null,
      validFrom: null,
      validTo: null,
      daysRemaining: null,
      issuer: null,
      hostnameMatch: null,
      error: 'Private/reserved address refused',
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };

    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        lookup: createSafeLookup(),
        rejectUnauthorized: false,
        timeout: TIMEOUT_MS,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const protocol = socket.getProtocol() || null;
        const authorized = socket.authorized === true;
        const validFrom = cert?.valid_from ? new Date(cert.valid_from).toISOString() : null;
        const validTo = cert?.valid_to ? new Date(cert.valid_to).toISOString() : null;
        let daysRemaining = null;
        if (cert?.valid_to) {
          const ms = new Date(cert.valid_to).getTime() - Date.now();
          daysRemaining = Number.isFinite(ms) ? Math.floor(ms / (24 * 60 * 60 * 1000)) : null;
        }
        const hostnameMatch = certMatchesHostname(cert, host);
        socket.end();
        finish({
          ok: true,
          protocol,
          authorized,
          validFrom,
          validTo,
          daysRemaining,
          issuer: issuerLabel(cert),
          hostnameMatch,
          error: null,
        });
      },
    );

    socket.on('error', (err) => {
      finish({
        ok: false,
        protocol: null,
        authorized: null,
        validFrom: null,
        validTo: null,
        daysRemaining: null,
        issuer: null,
        hostnameMatch: null,
        error: err?.message || 'TLS connect failed',
      });
    });

    socket.setTimeout(TIMEOUT_MS, () => {
      socket.destroy(new Error('TLS connect timed out'));
    });
  });
}

module.exports = { inspectTls, ISSUER_CAP };
