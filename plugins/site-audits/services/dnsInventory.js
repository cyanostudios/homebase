// plugins/site-audits/services/dnsInventory.js
// Local DNS inventory for the audit hostname (no third-party APIs). SPF + DMARC presence only.
const dns = require('dns').promises;

const LIST_CAP = 10;

function flattenTxt(records) {
  if (!Array.isArray(records)) return [];
  return records.map((entry) => (Array.isArray(entry) ? entry.join('') : String(entry || '')));
}

function hasSpf(txtRecords) {
  return txtRecords.some((text) => /^\s*v=spf1\b/i.test(text));
}

function hasDmarc(txtRecords) {
  return txtRecords.some((text) => /^\s*v=dmarc1\b/i.test(text));
}

/**
 * @param {string} hostname
 * @returns {Promise<{
 *   ok: boolean,
 *   aCount: number,
 *   aaaaCount: number,
 *   ns: string[],
 *   caa: string[],
 *   spfPresent: boolean,
 *   dmarcPresent: boolean,
 *   error: string|null
 * }>}
 */
async function inspectDns(hostname) {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');

  if (!host) {
    return {
      ok: false,
      aCount: 0,
      aaaaCount: 0,
      ns: [],
      caa: [],
      spfPresent: false,
      dmarcPresent: false,
      error: 'Missing hostname',
    };
  }

  const emptyFail = (error) => ({
    ok: false,
    aCount: 0,
    aaaaCount: 0,
    ns: [],
    caa: [],
    spfPresent: false,
    dmarcPresent: false,
    error,
  });

  try {
    const [aResult, aaaaResult, nsResult, caaResult, txtResult, dmarcResult] = await Promise.all([
      dns.resolve4(host).catch(() => []),
      dns.resolve6(host).catch(() => []),
      dns.resolveNs(host).catch(() => []),
      dns.resolveCaa(host).catch(() => []),
      dns.resolveTxt(host).catch(() => []),
      dns.resolveTxt(`_dmarc.${host}`).catch(() => []),
    ]);

    const ns = (Array.isArray(nsResult) ? nsResult : []).map(String).slice(0, LIST_CAP);
    const caa = (Array.isArray(caaResult) ? caaResult : [])
      .map((entry) => {
        if (entry && typeof entry === 'object') {
          return String(entry.value || entry.issue || '').slice(0, 80);
        }
        return String(entry || '').slice(0, 80);
      })
      .filter(Boolean)
      .slice(0, LIST_CAP);

    return {
      ok: true,
      aCount: Array.isArray(aResult) ? aResult.length : 0,
      aaaaCount: Array.isArray(aaaaResult) ? aaaaResult.length : 0,
      ns,
      caa,
      spfPresent: hasSpf(flattenTxt(txtResult)),
      dmarcPresent: hasDmarc(flattenTxt(dmarcResult)),
      error: null,
    };
  } catch (err) {
    return emptyFail(err?.message || 'DNS lookup failed');
  }
}

module.exports = { inspectDns, hasSpf, hasDmarc, LIST_CAP };
