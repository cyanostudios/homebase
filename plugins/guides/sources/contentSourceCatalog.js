/**
 * Catalog of guide content sources (research). Extensible: add adapters without
 * changing Guides orchestration — only register + catalog entry.
 *
 * v1: wikipedia, unesco
 */
function freeze(entry) {
  return Object.freeze({ ...entry });
}

const CONTENT_SOURCE_CATALOG = Object.freeze({
  wikipedia: freeze({
    key: 'wikipedia',
    label: 'Wikipedia',
    enabledByDefault: true,
    attribution: 'Text excerpts © respective Wikipedia contributors (CC BY-SA)',
  }),
  unesco: freeze({
    key: 'unesco',
    label: 'UNESCO World Heritage',
    enabledByDefault: true,
    attribution: 'UNESCO World Heritage Centre',
  }),
});

const DEFAULT_CONTENT_SOURCES = Object.freeze(
  Object.values(CONTENT_SOURCE_CATALOG)
    .filter((e) => e.enabledByDefault)
    .map((e) => e.key),
);

function getContentSourceCatalogEntry(sourceKey) {
  const normalized = String(sourceKey ?? '')
    .trim()
    .toLowerCase();
  return CONTENT_SOURCE_CATALOG[normalized] ?? null;
}

function listContentSourceCatalog() {
  return Object.values(CONTENT_SOURCE_CATALOG).map((e) => ({
    key: e.key,
    label: e.label,
    enabledByDefault: e.enabledByDefault,
    attribution: e.attribution,
  }));
}

module.exports = {
  CONTENT_SOURCE_CATALOG,
  DEFAULT_CONTENT_SOURCES,
  getContentSourceCatalogEntry,
  listContentSourceCatalog,
};
