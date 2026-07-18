// plugins/guides/sources/SourcePackService.js
const ContentSourceRegistry = require('./ContentSourceRegistry');
const { DEFAULT_CONTENT_SOURCES, getContentSourceCatalogEntry } = require('./contentSourceCatalog');
const { ensureContentSourcesRegistered } = require('./registerDefaultSources');

/**
 * Fetches excerpts from all enabled content sources for a place query.
 * Guides orchestration consumes the pack — never source-specific APIs.
 */
class SourcePackService {
  /**
   * @param {{ registry?: typeof ContentSourceRegistry, sourceKeys?: string[] }} [options]
   */
  constructor(options = {}) {
    this.registry = options.registry ?? ContentSourceRegistry;
    this.sourceKeys = options.sourceKeys ?? [...DEFAULT_CONTENT_SOURCES];
  }

  /**
   * @param {import('./ContentSource').PlaceQuery} place
   * @param {{ sourceKeys?: string[] }} [options]
   * @returns {Promise<{
   *   fetchedAt: string,
   *   placeDisplayName: string|null,
   *   sources: import('./ContentSource').SourceFetchResult[],
   *   excerpts: import('./ContentSource').SourceExcerpt[],
   *   combinedText: string,
   * }>}
   */
  async buildPack(place, options = {}) {
    ensureContentSourcesRegistered();
    const keys = (options.sourceKeys ?? this.sourceKeys)
      .map((k) => String(k).toLowerCase())
      .filter((k) => getContentSourceCatalogEntry(k) && this.registry.has(k));

    const sources = [];
    for (const key of keys) {
      const adapter = this.registry.create(key);
      const result = await adapter.fetch(place);
      sources.push(result);
    }

    const excerpts = sources.flatMap((s) => (Array.isArray(s.excerpts) ? s.excerpts : []));
    const combinedText = formatCombinedText(excerpts);

    return {
      fetchedAt: new Date().toISOString(),
      placeDisplayName: place?.displayName ?? null,
      sources,
      excerpts,
      combinedText,
    };
  }
}

function formatCombinedText(excerpts) {
  if (!excerpts.length) return '';
  return excerpts
    .map((e, i) => `[Source ${i + 1}: ${e.sourceKey}] ${e.title}\nURL: ${e.url}\n${e.excerpt}`)
    .join('\n\n---\n\n');
}

module.exports = SourcePackService;
module.exports.formatCombinedText = formatCombinedText;
