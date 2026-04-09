// plugins/ingest/services/ingestService.js
// Shared entrypoints for other plugins (guide §451). Same module as UI uses via controller.
const {
  fetchSource,
  fetchSourceFromUrl,
  cookieHeaderForInternalFileUrl,
} = require('./fetchSource');
const { runIngest } = require('./runIngest');

/**
 * Run a full import for a source (same as POST /api/ingest/:id/run).
 * @param {import('../model')} model
 * @param {import('express').Request} req
 * @param {string|number} sourceId
 */
async function runSourceById(model, req, sourceId) {
  return runIngest(model, req, sourceId);
}

/**
 * Fetch URL content from a source row (DB or API-shaped object) without persisting a run.
 * @param {import('express').Request} req
 * @param {Record<string, unknown>} record — e.g. model row with sourceUrl / source_url
 */
async function fetchSourceFromRecord(req, record) {
  const sourceUrl = record.sourceUrl ?? record.source_url;
  if (!sourceUrl) {
    return {
      ok: false,
      status: null,
      contentType: null,
      contentLength: null,
      bodyText: null,
      excerpt: null,
      finalUrl: null,
      errorMessage: 'Missing source URL',
    };
  }
  const urlStr = String(sourceUrl);
  const cookieHeader = cookieHeaderForInternalFileUrl(req, urlStr);
  return fetchSource({
    sourceUrl: urlStr,
    sourceType: String(record.sourceType ?? record.source_type ?? 'other'),
    fetchMethod: String(record.fetchMethod ?? record.fetch_method ?? 'generic_http'),
    ...(cookieHeader ? { cookieHeader } : {}),
  });
}

/**
 * Latest completed run excerpt + source snapshot (for downstream normalization).
 * @param {import('../model')} model
 * @param {import('express').Request} req
 * @param {string|number} sourceId
 */
async function getLatestSourceContent(model, req, sourceId) {
  const runs = await model.getRunsForSource(req, sourceId, 20);
  const latest = runs.find((r) => r.status === 'success' || r.status === 'failed') || null;
  if (!latest) {
    return null;
  }
  const src = await model.getSourceById(req, sourceId);
  return {
    source: src,
    run: latest,
    rawExcerpt: latest.rawExcerpt,
    httpStatus: latest.httpStatus,
    contentType: latest.contentType,
  };
}

module.exports = {
  runSourceById,
  fetchSourceFromRecord,
  getLatestSourceContent,
  fetchSource,
  fetchSourceFromUrl,
  runIngest,
};
