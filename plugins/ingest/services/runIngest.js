// plugins/ingest/services/runIngest.js
// Orchestrate one import run (guide §439): create run → fetch → update run → source metadata.
const { AppError } = require('../../../server/core/errors/AppError');
const { fetchSource } = require('./fetchSource');

const ALLOWED_TYPES = new Set(['html', 'pdf', 'json', 'xml', 'other']);

/**
 * @param {import('../model')} model
 * @param {import('express').Request} req
 * @param {string|number} sourceId
 */
async function runIngest(model, req, sourceId) {
  const id = parseInt(String(sourceId), 10);
  if (Number.isNaN(id)) {
    throw new AppError('Invalid source id', 400, AppError.CODES.BAD_REQUEST);
  }

  const source = await model.getSourceById(req, id);
  if (!source) {
    throw new AppError('Source not found', 404, AppError.CODES.NOT_FOUND);
  }
  if (!source.isActive) {
    throw new AppError('Source is inactive', 400, AppError.CODES.BAD_REQUEST);
  }

  const startedAt = new Date();
  const run = await model.createRun(req, {
    sourceId: id,
    status: 'running',
    startedAt,
    completedAt: null,
    httpStatus: null,
    contentType: null,
    contentLength: null,
    rawExcerpt: null,
    errorMessage: null,
  });

  let fetchResult;
  try {
    const st =
      source.sourceType && ALLOWED_TYPES.has(source.sourceType) ? source.sourceType : 'other';
    fetchResult = await fetchSource({
      sourceUrl: source.sourceUrl,
      sourceType: st,
      fetchMethod: source.fetchMethod || 'generic_http',
    });
  } catch (e) {
    fetchResult = {
      ok: false,
      status: null,
      contentType: null,
      contentLength: null,
      bodyText: null,
      excerpt: null,
      finalUrl: null,
      errorMessage: e.message || 'Fetch failed',
    };
  }

  const completedAt = new Date();
  const success = fetchResult.ok;

  const updatedRun = await model.updateRun(req, run.id, {
    status: success ? 'success' : 'failed',
    completed_at: completedAt,
    http_status: fetchResult.status,
    content_type: fetchResult.contentType,
    content_length: fetchResult.contentLength,
    raw_excerpt: fetchResult.excerpt,
    error_message: fetchResult.errorMessage,
  });

  const updatedSource = await model.markSourceFetchResult(req, id, {
    lastFetchedAt: completedAt,
    lastFetchStatus: success ? 'success' : 'failed',
    lastFetchError: success ? null : fetchResult.errorMessage || 'Unknown error',
  });

  return { run: updatedRun, source: updatedSource };
}

module.exports = { runIngest };
