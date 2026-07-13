// plugins/guides/ingest/GuideIngestBridgeService.js
const IngestModel = require('../../ingest/model');
const ingestService = require('../../ingest/services/ingestService');
const { AppError } = require('../../../server/core/errors/AppError');

class GuideIngestBridgeService {
  /**
   * @param {import('../model')} guidesModel
   */
  constructor(guidesModel) {
    this.guidesModel = guidesModel;
    this.ingestModel = new IngestModel();
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string|null|undefined} ingestSourceId
   */
  async setIngestSource(req, placeId, ingestSourceId) {
    const normalized =
      ingestSourceId === null || ingestSourceId === undefined || ingestSourceId === ''
        ? null
        : String(ingestSourceId).trim();

    if (normalized !== null) {
      const source = await this.ingestModel.getSourceById(req, normalized);
      if (!source) {
        throw new AppError('Ingest source not found', 404, AppError.CODES.NOT_FOUND);
      }
    }

    return this.guidesModel.setIngestSource(req, placeId, normalized);
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   */
  async getSourceContent(req, placeId) {
    const place = await this.guidesModel.getById(req, placeId);
    if (!place.ingestSourceId) {
      return null;
    }
    return ingestService.getLatestSourceContent(this.ingestModel, req, place.ingestSourceId);
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   */
  async refreshSourceContent(req, placeId) {
    const place = await this.guidesModel.getById(req, placeId);
    if (!place.ingestSourceId) {
      throw new AppError(
        'No ingest source linked to this place',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }

    const { run } = await ingestService.runSourceById(this.ingestModel, req, place.ingestSourceId);
    if (run?.id) {
      await this.guidesModel.updateIngestRunId(req, placeId, run.id);
    }

    return ingestService.getLatestSourceContent(this.ingestModel, req, place.ingestSourceId);
  }
}

module.exports = GuideIngestBridgeService;
