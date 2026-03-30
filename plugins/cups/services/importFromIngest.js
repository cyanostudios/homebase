const IngestModel = require('../../ingest/model');
const ingestService = require('../../ingest/services/ingestService');
const { AppError } = require('../../../server/core/errors/AppError');
const { parseCupSource } = require('./parseCupSource');

/**
 * Import cups from one ingest source id.
 * @param {{ model: any, req: import('express').Request, sourceId: string|number }} params
 */
async function importFromIngest({ model, req, sourceId }) {
  const parsedSourceId = parseInt(String(sourceId), 10);
  if (Number.isNaN(parsedSourceId)) {
    throw new AppError('Invalid ingest source id', 400, AppError.CODES.BAD_REQUEST);
  }

  const ingestModel = new IngestModel();
  const source = await ingestModel.getSourceById(req, parsedSourceId);
  if (!source) {
    throw new AppError('Ingest source not found', 404, AppError.CODES.NOT_FOUND);
  }

  const fetchResult = await ingestService.fetchSourceFromRecord(req, source);
  if (!fetchResult?.ok || !fetchResult?.bodyText) {
    return {
      sourceId: String(parsedSourceId),
      fetched: false,
      parsed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [fetchResult?.errorMessage || 'Failed to fetch source'],
    };
  }

  const parsedItems = parseCupSource({
    html: fetchResult.bodyText,
    sourceUrl: source.sourceUrl,
    sourceType: source.sourceType,
  });

  const saveResult = await model.createManyFromImport(req, parsedItems, {
    sourceUrl: source.sourceUrl,
    sourceType: source.sourceType,
    ingestSourceId: source.id,
  });

  return {
    sourceId: String(parsedSourceId),
    fetched: true,
    parsed: parsedItems.length,
    created: saveResult.created,
    updated: saveResult.updated,
    skipped: saveResult.skipped,
    errors: saveResult.errors,
    diagnostics: {
      status: fetchResult.status ?? null,
      finalUrl: fetchResult.finalUrl ?? null,
      contentType: fetchResult.contentType ?? null,
    },
  };
}

module.exports = { importFromIngest };
