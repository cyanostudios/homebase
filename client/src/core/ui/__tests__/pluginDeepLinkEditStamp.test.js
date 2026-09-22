const fs = require('fs');
const path = require('path');

/**
 * Soft-preview → Edit must stamp DeepLinkPathSyncedRef before navigateToItem,
 * otherwise URL sync re-opens view (double-click Edit).
 */
describe('Plugin providers: deep-link edit stamp (no view bounce)', () => {
  const pluginsRoot = path.join(__dirname, '../../../plugins');
  const providers = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        /Provider\.tsx$/.test(entry.name) &&
        full.includes(`${path.sep}context${path.sep}`)
      ) {
        providers.push(full);
      }
    }
  }
  walk(pluginsRoot);

  test('discovers plugin providers', () => {
    expect(providers.length).toBeGreaterThan(10);
  });

  test.each([
    ['matches', 'MatchProvider', 'matchesDeepLinkPathSyncedRef', '/matches/'],
    ['slots', 'SlotsProvider', 'slotsDeepLinkPathSyncedRef', '/slots/'],
    ['guides', 'GuidesProvider', 'guidesDeepLinkPathSyncedRef', '/guides/'],
    ['garments', 'GarmentProvider', 'deepLinkSyncedRef', '/garments/'],
    ['instructions', 'InstructionProvider', 'deepLinkPathSyncedRef', '/instructions/'],
    ['cups', 'CupsProvider', 'cupsDeepLinkPathSyncedRef', '/cups/'],
    ['invoices', 'InvoicesProvider', 'invoicesDeepLinkPathSyncedRef', '/invoices/'],
    ['estimates', 'EstimateProvider', 'estimatesDeepLinkPathSyncedRef', '/estimates/'],
  ])('%s open*ForEdit stamps %s before navigate', (_plugin, fileName, refName, pathPrefix) => {
    const file = providers.find((p) => p.endsWith(`${fileName}.tsx`));
    expect(file).toBeTruthy();
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toMatch(new RegExp(refName));
    expect(src).not.toMatch(/didOpenFromUrlRef/);

    const editMatch = src.match(/const open\w+ForEdit\s*=/);
    expect(editMatch).toBeTruthy();
    const editIdx = editMatch.index;
    const stampRe = new RegExp(
      `${refName}\\.current\\s*=\\s*\`\\${pathPrefix.replace('/', '\\/')}\\$\\{slug\\}\``,
    );
    // Allow both `/plugin/${slug}` and template with buildSlug inline
    const stampIdx = src.indexOf(`${refName}.current = \`${pathPrefix}\${slug}\``, editIdx);
    const stampIdxAlt = src.search(
      new RegExp(`${refName}\\.current = \`\\${pathPrefix.slice(0, -1)}\\/\\$\\{[^}]+\\}\``),
    );
    const navigateAfter = src.indexOf('navigateToItem', stampIdx >= 0 ? stampIdx : editIdx);
    expect(stampIdx).toBeGreaterThan(editIdx);
    expect(navigateAfter).toBeGreaterThan(stampIdx);
  });
});
