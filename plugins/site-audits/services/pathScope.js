// Path prefix scope for site-audit crawls.
// Start URL `/nordics-baltics/` → only same-host URLs under that path.
// Start URL `/` or empty path → null (whole host).

/**
 * @param {string} urlString
 * @returns {string|null} normalized path prefix without trailing slash, or null for whole-site
 */
function pathScopeFromStartUrl(urlString) {
  try {
    const pathname = new URL(urlString).pathname || '/';
    if (pathname === '/' || pathname === '') return null;
    // Collapse trailing slash so `/foo/` and `/foo` share one scope.
    return pathname.replace(/\/+$/, '') || null;
  } catch {
    return null;
  }
}

/**
 * @param {string} urlString
 * @param {string|null|undefined} scope - from pathScopeFromStartUrl
 * @returns {boolean}
 */
function isInPathScope(urlString, scope) {
  if (!scope) return true;
  try {
    const pathname = new URL(urlString).pathname || '/';
    const normalized = pathname.replace(/\/+$/, '') || '/';
    if (normalized === scope) return true;
    // Prefix match: `/nordics-baltics/foo` under `/nordics-baltics`.
    // Avoid `/nordics-baltics-extra` matching `/nordics-baltics`.
    return normalized.startsWith(`${scope}/`);
  } catch {
    return false;
  }
}

module.exports = {
  pathScopeFromStartUrl,
  isInPathScope,
};
