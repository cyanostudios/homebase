// plugins/site-audits/services/resourceInventory.js
// Aggregate first-/third-party resource signals from per-page htmlAnalyzer.resources.
const HOST_CAP = 25;
const MISSING_DIM_SAMPLE = 5;
const THIRD_PARTY_SCRIPT_HOST_INFO_THRESHOLD = 10;

function hostnameOf(urlString, baseUrl) {
  try {
    return new URL(urlString, baseUrl || undefined).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

/**
 * @param {object|null|undefined} pageResources - analysis.resources from htmlAnalyzer
 * @param {string} pageUrl
 * @param {string} auditHost
 */
function normalizePageResources(pageResources, pageUrl, auditHost) {
  const host = String(auditHost || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const resources = pageResources && typeof pageResources === 'object' ? pageResources : {};
  const scriptSrcs = Array.isArray(resources.scriptSrcs) ? resources.scriptSrcs : [];
  const stylesheetHrefs = Array.isArray(resources.stylesheetHrefs) ? resources.stylesheetHrefs : [];
  const firstPartyHosts = new Set();
  const thirdPartyScriptHosts = new Set();
  const thirdPartyHosts = new Set();

  for (const src of scriptSrcs) {
    const h = hostnameOf(src, pageUrl);
    if (!h) continue;
    if (h === host) firstPartyHosts.add(h);
    else {
      thirdPartyScriptHosts.add(h);
      thirdPartyHosts.add(h);
    }
  }
  for (const href of stylesheetHrefs) {
    const h = hostnameOf(href, pageUrl);
    if (!h) continue;
    if (h === host) firstPartyHosts.add(h);
    else thirdPartyHosts.add(h);
  }

  return {
    scriptCount: Number(resources.scriptCount) || 0,
    stylesheetCount: Number(resources.stylesheetCount) || 0,
    imageCount: Number(resources.imageCount) || 0,
    asyncScripts: Number(resources.asyncScripts) || 0,
    deferScripts: Number(resources.deferScripts) || 0,
    hasManifest: resources.hasManifest === true,
    hasServiceWorkerHint: resources.hasServiceWorkerHint === true,
    missingDimensionSample: Array.isArray(resources.missingDimensionSample)
      ? resources.missingDimensionSample.slice(0, MISSING_DIM_SAMPLE)
      : [],
    firstPartyHosts: Array.from(firstPartyHosts),
    thirdPartyScriptHosts: Array.from(thirdPartyScriptHosts),
    thirdPartyHosts: Array.from(thirdPartyHosts),
  };
}

/**
 * @param {Array} pages - crawler pages with analysis.resources and url/finalUrl
 * @param {string} auditHost
 */
function aggregateResources(pages, auditHost) {
  const list = Array.isArray(pages) ? pages : [];
  const firstPartyHosts = new Set();
  const thirdPartyScriptHosts = new Set();
  const thirdPartyHosts = new Set();
  let scriptCount = 0;
  let stylesheetCount = 0;
  let imageCount = 0;
  let asyncScripts = 0;
  let deferScripts = 0;
  let hasManifest = false;
  let hasServiceWorkerHint = false;
  const missingDimensionSample = [];

  for (const page of list) {
    const pageUrl = page?.finalUrl || page?.url || '';
    const normalized = normalizePageResources(page?.analysis?.resources, pageUrl, auditHost);
    scriptCount += normalized.scriptCount;
    stylesheetCount += normalized.stylesheetCount;
    imageCount += normalized.imageCount;
    asyncScripts += normalized.asyncScripts;
    deferScripts += normalized.deferScripts;
    hasManifest = hasManifest || normalized.hasManifest;
    hasServiceWorkerHint = hasServiceWorkerHint || normalized.hasServiceWorkerHint;
    for (const h of normalized.firstPartyHosts) firstPartyHosts.add(h);
    for (const h of normalized.thirdPartyScriptHosts) thirdPartyScriptHosts.add(h);
    for (const h of normalized.thirdPartyHosts) thirdPartyHosts.add(h);
    for (const sample of normalized.missingDimensionSample) {
      if (missingDimensionSample.length >= MISSING_DIM_SAMPLE) break;
      missingDimensionSample.push(sample);
    }
  }

  return {
    scriptCount,
    stylesheetCount,
    imageCount,
    asyncScripts,
    deferScripts,
    hasManifest,
    hasServiceWorkerHint,
    firstPartyHostCount: firstPartyHosts.size,
    thirdPartyScriptHostCount: thirdPartyScriptHosts.size,
    thirdPartyHostCount: thirdPartyHosts.size,
    thirdPartyScriptHosts: Array.from(thirdPartyScriptHosts).slice(0, HOST_CAP),
    thirdPartyHosts: Array.from(thirdPartyHosts).slice(0, HOST_CAP),
    missingDimensionSample,
  };
}

module.exports = {
  aggregateResources,
  normalizePageResources,
  THIRD_PARTY_SCRIPT_HOST_INFO_THRESHOLD,
  HOST_CAP,
};
