// plugins/site-audits/services/techFingerprint.js
// Match crawl signals already collected by the audit against the local catalog.
// Pure: no I/O and no extra fetches. Inventory only — callers must not turn hits into findings.
const { CATALOG_VERSION, TECH_FINGERPRINT_CATALOG } = require('./techFingerprintCatalog');

const EVIDENCE_VALUE_CAP = 200;
const EVIDENCE_PER_ITEM = 3;
const ITEM_CAP = 40;

function truncateEvidence(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.length <= EVIDENCE_VALUE_CAP) return trimmed;
  // Same 200 + ellipsis hygiene as security header inventory.
  return `${trimmed.slice(0, EVIDENCE_VALUE_CAP)}…`;
}

function collectGenerators(pages) {
  const generators = [];
  const seen = new Set();
  for (const page of pages) {
    const raw = page?.analysis?.techHints?.generator;
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    generators.push(trimmed);
  }
  return generators;
}

function collectPathHits(pages) {
  const hits = [];
  const seen = new Set();
  for (const page of pages) {
    const list = page?.analysis?.techHints?.pathHits;
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) continue;
      seen.add(key);
      hits.push(trimmed);
    }
  }
  return hits;
}

function collectHosts(resources) {
  const hosts = [];
  const seen = new Set();
  const source = resources && typeof resources === 'object' ? resources : {};
  for (const key of ['thirdPartyScriptHosts', 'thirdPartyHosts']) {
    const list = source[key];
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (typeof raw !== 'string') continue;
      const host = raw.trim().toLowerCase().replace(/\.$/, '');
      if (!host || seen.has(host)) continue;
      seen.add(host);
      hosts.push(host);
    }
  }
  return hosts;
}

function headerMap(headers) {
  const map = new Map();
  if (!headers || typeof headers !== 'object') return map;
  for (const [key, raw] of Object.entries(headers)) {
    const name = String(key).toLowerCase();
    const values = (Array.isArray(raw) ? raw : [raw])
      .filter((value) => value != null)
      .map((value) => String(value).trim())
      .filter(Boolean);
    if (!values.length) continue;
    const existing = map.get(name);
    map.set(name, existing ? existing.concat(values) : values);
  }
  return map;
}

function hostMatches(pattern, hostname) {
  if (pattern instanceof RegExp) return pattern.test(hostname);
  const needle = String(pattern || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  if (!needle || !hostname) return false;
  if (hostname === needle) return true;
  // Suffix only for real hostnames, so "stripe.com" does not match "notstripe.com".
  if (!needle.includes('.')) return false;
  return hostname.endsWith(`.${needle}`);
}

function pushEvidence(state, kind, value) {
  if (state.list.length >= EVIDENCE_PER_ITEM) return;
  const truncated = truncateEvidence(value);
  if (!truncated) return;
  const key = `${kind}\0${truncated}`;
  if (state.seen.has(key)) return;
  state.seen.add(key);
  state.list.push({ kind, value: truncated });
}

function matchRule(rule, signals) {
  const match = rule.match || {};
  const state = { list: [], seen: new Set() };

  for (const generator of signals.generators) {
    if (state.list.length >= EVIDENCE_PER_ITEM) break;
    const patterns = Array.isArray(match.generators) ? match.generators : [];
    if (patterns.some((pattern) => pattern instanceof RegExp && pattern.test(generator))) {
      pushEvidence(state, 'generator', generator);
      break;
    }
  }

  const needles = Array.isArray(match.pathIncludes) ? match.pathIncludes : [];
  for (const needle of needles) {
    if (state.list.length >= EVIDENCE_PER_ITEM) break;
    const lowered = String(needle || '').toLowerCase();
    if (!lowered) continue;
    const hit = signals.pathHits.find((pathHit) => pathHit.toLowerCase().includes(lowered));
    if (hit) pushEvidence(state, 'path', hit);
  }

  const hostPatterns = Array.isArray(match.hosts) ? match.hosts : [];
  for (const pattern of hostPatterns) {
    if (state.list.length >= EVIDENCE_PER_ITEM) break;
    const hit = signals.hosts.find((host) => hostMatches(pattern, host));
    if (hit) pushEvidence(state, 'host', hit);
  }

  const headers = Array.isArray(match.headers) ? match.headers : [];
  for (const header of headers) {
    if (state.list.length >= EVIDENCE_PER_ITEM) break;
    const name = String(header?.name || '').toLowerCase();
    if (!name) continue;
    const values = signals.headerMap.get(name);
    if (!values || !values.length) continue;
    if (header.value instanceof RegExp) {
      const matched = values.find((value) => header.value.test(value));
      if (matched) pushEvidence(state, 'header', `${name}: ${matched}`);
    } else {
      pushEvidence(state, 'header', `${name}: ${values[0]}`);
    }
  }

  if (!state.list.length) return null;
  return {
    id: rule.id,
    name: rule.name,
    category: rule.category,
    evidence: state.list,
  };
}

/**
 * @param {{
 *   homepageHeaders?: Object,
 *   pages?: Array,
 *   resources?: { thirdPartyScriptHosts?: string[], thirdPartyHosts?: string[] }|null
 * }} [input]
 * @returns {{ items: Array<{ id: string, name: string, category: string, evidence: Array<{ kind: string, value: string }> }>, catalogVersion: number }}
 */
function detectTechnologies(input) {
  const source = input && typeof input === 'object' ? input : {};
  const pages = Array.isArray(source.pages) ? source.pages : [];
  const signals = {
    generators: collectGenerators(pages),
    pathHits: collectPathHits(pages),
    hosts: collectHosts(source.resources),
    headerMap: headerMap(source.homepageHeaders),
  };

  const items = [];
  const seenIds = new Set();
  for (const entry of TECH_FINGERPRINT_CATALOG) {
    if (items.length >= ITEM_CAP) break;
    if (!entry || seenIds.has(entry.id)) continue;
    const item = matchRule(entry, signals);
    if (!item) continue;
    seenIds.add(entry.id);
    items.push(item);
  }

  return {
    items,
    catalogVersion: CATALOG_VERSION,
  };
}

module.exports = { detectTechnologies };
