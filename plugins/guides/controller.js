// plugins/guides/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class GuidesController {
  /**
   * @param {import('./model')} model
   * @param {import('./ingest/GuideIngestBridgeService')|null} [ingestBridge]
   * @param {import('./production/ProductionOrchestrationService')|null} [productionOrchestration]
   */
  constructor(
    model,
    ingestBridge = null,
    productionOrchestration = null,
    contentSourceSettingsModel = null,
  ) {
    this.model = model;
    this.ingestBridge = ingestBridge;
    this.productionOrchestration = productionOrchestration;
    this.contentSourceSettingsModel = contentSourceSettingsModel;
  }

  async getAll(req, res) {
    try {
      const places = await this.model.getAll(req);
      res.json(places);
    } catch (error) {
      Logger.error('Get guides places failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch places' });
    }
  }

  async getById(req, res) {
    try {
      const place = await this.model.getById(req, req.params.id);
      res.json(place);
    } catch (error) {
      Logger.error('Get guide place failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch place' });
    }
  }

  async create(req, res) {
    try {
      const place = await this.model.create(req, req.body);
      res.json(place);
    } catch (error) {
      Logger.error('Create guide place failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create place' });
    }
  }

  async update(req, res) {
    try {
      const place = await this.model.update(req, req.params.id, req.body);
      res.json(place);
    } catch (error) {
      Logger.error('Update guide place failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update place' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ deleted: true });
    } catch (error) {
      Logger.error('Delete guide place failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete place' });
    }
  }

  async listPresentations(req, res) {
    try {
      const presentations = await this.model.getPresentations(req, req.params.id);
      res.json(presentations);
    } catch (error) {
      Logger.error('Get guide presentations failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch presentations' });
    }
  }

  async getPresentation(req, res) {
    try {
      const presentation = await this.model.getPresentationByLanguage(
        req,
        req.params.id,
        req.params.language,
      );
      res.json(presentation);
    } catch (error) {
      Logger.error('Get guide presentation failed', error, {
        placeId: req.params.id,
        language: req.params.language,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch presentation' });
    }
  }

  async updatePresentation(req, res) {
    try {
      const presentation = await this.model.updatePresentation(
        req,
        req.params.id,
        req.params.language,
        req.body,
      );
      res.json(presentation);
    } catch (error) {
      Logger.error('Update guide presentation failed', error, {
        placeId: req.params.id,
        language: req.params.language,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update presentation' });
    }
  }

  async deletePresentation(req, res) {
    try {
      const result = await this.model.deletePresentation(req, req.params.id, req.params.language);
      res.json(result);
    } catch (error) {
      Logger.error('Delete guide presentation failed', error, {
        placeId: req.params.id,
        language: req.params.language,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete presentation' });
    }
  }

  async createPresentation(req, res) {
    try {
      const presentation = await this.model.ensurePresentationForLanguage(
        req,
        req.params.id,
        req.body.language,
      );
      res.status(201).json(presentation);
    } catch (error) {
      Logger.error('Create guide presentation failed', error, {
        placeId: req.params.id,
        language: req.body?.language,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create presentation' });
    }
  }

  async setIngestSource(req, res) {
    try {
      if (!this.ingestBridge) {
        return res.status(500).json({ error: 'Ingest bridge not configured' });
      }
      const place = await this.ingestBridge.setIngestSource(
        req,
        req.params.id,
        req.body.ingestSourceId ?? null,
      );
      res.json(place);
    } catch (error) {
      Logger.error('Set guide ingest source failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to set ingest source' });
    }
  }

  async getSourceContent(req, res) {
    try {
      if (!this.ingestBridge) {
        return res.status(500).json({ error: 'Ingest bridge not configured' });
      }
      const content = await this.ingestBridge.getSourceContent(req, req.params.id);
      res.json(content);
    } catch (error) {
      Logger.error('Get guide source content failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch source content' });
    }
  }

  async refreshSourceContent(req, res) {
    try {
      if (!this.ingestBridge) {
        return res.status(500).json({ error: 'Ingest bridge not configured' });
      }
      const content = await this.ingestBridge.refreshSourceContent(req, req.params.id);
      res.json(content);
    } catch (error) {
      Logger.error('Refresh guide source content failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to refresh source content' });
    }
  }

  async createProductionJob(req, res) {
    try {
      if (!this.productionOrchestration) {
        return res.status(500).json({ error: 'Production orchestration not configured' });
      }
      const result = await this.productionOrchestration.startJob(req, req.params.id, req.body);
      res.json(result);
    } catch (error) {
      Logger.error('Create production job failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create production job' });
    }
  }

  async listProductionJobs(req, res) {
    try {
      if (!this.productionOrchestration) {
        return res.status(500).json({ error: 'Production orchestration not configured' });
      }
      const jobs = await this.productionOrchestration.listJobs(req, req.params.id);
      res.json(jobs);
    } catch (error) {
      Logger.error('List production jobs failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to list production jobs' });
    }
  }

  async getProductionJob(req, res) {
    try {
      if (!this.productionOrchestration) {
        return res.status(500).json({ error: 'Production orchestration not configured' });
      }
      const result = await this.productionOrchestration.getJob(
        req,
        req.params.id,
        req.params.jobId,
      );
      res.json(result);
    } catch (error) {
      Logger.error('Get production job failed', error, {
        placeId: req.params.id,
        jobId: req.params.jobId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch production job' });
    }
  }

  async approveProductionJobPhase(req, res) {
    try {
      if (!this.productionOrchestration) {
        return res.status(500).json({ error: 'Production orchestration not configured' });
      }
      const result = await this.productionOrchestration.approvePhase(
        req,
        req.params.id,
        req.params.jobId,
        req.body ?? {},
      );
      res.json(result);
    } catch (error) {
      Logger.error('Approve production job phase failed', error, {
        placeId: req.params.id,
        jobId: req.params.jobId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to approve production job phase' });
    }
  }

  async approveProductionJob(req, res) {
    try {
      if (!this.productionOrchestration) {
        return res.status(500).json({ error: 'Production orchestration not configured' });
      }
      const result = await this.productionOrchestration.approveJob(
        req,
        req.params.id,
        req.params.jobId,
      );
      res.json(result);
    } catch (error) {
      Logger.error('Approve production job failed', error, {
        placeId: req.params.id,
        jobId: req.params.jobId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to approve production job' });
    }
  }

  async approveProductionJobItem(req, res) {
    try {
      if (!this.productionOrchestration) {
        return res.status(500).json({ error: 'Production orchestration not configured' });
      }
      const result = await this.productionOrchestration.approveItem(
        req,
        req.params.id,
        req.params.jobId,
        req.params.itemId,
      );
      res.json(result);
    } catch (error) {
      Logger.error('Approve production job item failed', error, {
        placeId: req.params.id,
        jobId: req.params.jobId,
        itemId: req.params.itemId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to approve production job item' });
    }
  }

  async rejectProductionJobItem(req, res) {
    try {
      if (!this.productionOrchestration) {
        return res.status(500).json({ error: 'Production orchestration not configured' });
      }
      const result = await this.productionOrchestration.rejectItem(
        req,
        req.params.id,
        req.params.jobId,
        req.params.itemId,
        req.body ?? {},
      );
      res.json(result);
    } catch (error) {
      Logger.error('Reject production job item failed', error, {
        placeId: req.params.id,
        jobId: req.params.jobId,
        itemId: req.params.itemId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to reject production job item' });
    }
  }

  async regenerateProductionJobItem(req, res) {
    try {
      if (!this.productionOrchestration) {
        return res.status(500).json({ error: 'Production orchestration not configured' });
      }
      const result = await this.productionOrchestration.regenerateItem(
        req,
        req.params.id,
        req.params.jobId,
        req.params.itemId,
      );
      res.json(result);
    } catch (error) {
      Logger.error('Regenerate production job item failed', error, {
        placeId: req.params.id,
        jobId: req.params.jobId,
        itemId: req.params.itemId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to regenerate production job item' });
    }
  }

  async bulkApproveProductionJobItems(req, res) {
    try {
      if (!this.productionOrchestration) {
        return res.status(500).json({ error: 'Production orchestration not configured' });
      }
      const result = await this.productionOrchestration.bulkApproveItemsInPhase(
        req,
        req.params.id,
        req.params.jobId,
      );
      res.json(result);
    } catch (error) {
      Logger.error('Bulk approve production job items failed', error, {
        placeId: req.params.id,
        jobId: req.params.jobId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to bulk approve production job items' });
    }
  }

  async retryProductionJob(req, res) {
    try {
      if (!this.productionOrchestration) {
        return res.status(500).json({ error: 'Production orchestration not configured' });
      }
      const result = await this.productionOrchestration.retryJob(
        req,
        req.params.id,
        req.params.jobId,
      );
      res.json(result);
    } catch (error) {
      Logger.error('Retry production job failed', error, {
        placeId: req.params.id,
        jobId: req.params.jobId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to retry production job' });
    }
  }

  async cancelProductionJob(req, res) {
    try {
      if (!this.productionOrchestration) {
        return res.status(500).json({ error: 'Production orchestration not configured' });
      }
      const result = await this.productionOrchestration.cancelJob(
        req,
        req.params.id,
        req.params.jobId,
      );
      res.json(result);
    } catch (error) {
      Logger.error('Cancel production job failed', error, {
        placeId: req.params.id,
        jobId: req.params.jobId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to cancel production job' });
    }
  }

  async listContentSources(req, res) {
    try {
      if (!this.contentSourceSettingsModel) {
        return res.status(500).json({ error: 'Content source settings not configured' });
      }
      const sources = await this.contentSourceSettingsModel.listEffective(req);
      res.json({ sources });
    } catch (error) {
      Logger.error('List content sources failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to list content sources' });
    }
  }

  async updateContentSource(req, res) {
    try {
      if (!this.contentSourceSettingsModel) {
        return res.status(500).json({ error: 'Content source settings not configured' });
      }
      const source = await this.contentSourceSettingsModel.setEnabled(
        req,
        req.params.sourceKey,
        req.body.enabled,
      );
      res.json(source);
    } catch (error) {
      Logger.error('Update content source failed', error, {
        sourceKey: req.params.sourceKey,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update content source' });
    }
  }
}

module.exports = GuidesController;
