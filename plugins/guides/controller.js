// plugins/guides/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class GuidesController {
  /**
   * @param {import('./model')} model
   * @param {import('./audio/AudioOrchestrationService')|null} [audioOrchestration]
   * @param {import('./ingest/GuideIngestBridgeService')|null} [ingestBridge]
   * @param {import('./production/ProductionOrchestrationService')|null} [productionOrchestration]
   */
  constructor(
    model,
    audioOrchestration = null,
    ingestBridge = null,
    productionOrchestration = null,
  ) {
    this.model = model;
    this.audioOrchestration = audioOrchestration;
    this.ingestBridge = ingestBridge;
    this.productionOrchestration = productionOrchestration;
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

  async getStops(req, res) {
    try {
      const stops = await this.model.getStops(req, req.params.id);
      res.json(stops);
    } catch (error) {
      Logger.error('Get guide stops failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch stops' });
    }
  }

  async getStopById(req, res) {
    try {
      const stop = await this.model.getStopById(req, req.params.id, req.params.stopId);
      res.json(stop);
    } catch (error) {
      Logger.error('Get guide stop failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch stop' });
    }
  }

  async createStop(req, res) {
    try {
      const stop = await this.model.createStop(req, req.params.id, req.body);
      res.json(stop);
    } catch (error) {
      Logger.error('Create guide stop failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create stop' });
    }
  }

  async updateStop(req, res) {
    try {
      const stop = await this.model.updateStop(req, req.params.id, req.params.stopId, req.body);
      res.json(stop);
    } catch (error) {
      Logger.error('Update guide stop failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update stop' });
    }
  }

  async deleteStop(req, res) {
    try {
      await this.model.deleteStop(req, req.params.id, req.params.stopId);
      res.json({ deleted: true });
    } catch (error) {
      Logger.error('Delete guide stop failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete stop' });
    }
  }

  async reorderStops(req, res) {
    try {
      const stops = await this.model.reorderStops(req, req.params.id, req.body.stopIds);
      res.json(stops);
    } catch (error) {
      Logger.error('Reorder guide stops failed', error, {
        placeId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to reorder stops' });
    }
  }

  async getVariants(req, res) {
    try {
      const variants = await this.model.getVariants(req, req.params.id, req.params.stopId);
      res.json(variants);
    } catch (error) {
      Logger.error('Get guide variants failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch variants' });
    }
  }

  async getVariantById(req, res) {
    try {
      const variant = await this.model.getVariantById(
        req,
        req.params.id,
        req.params.stopId,
        req.params.variantId,
      );
      res.json(variant);
    } catch (error) {
      Logger.error('Get guide variant failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch variant' });
    }
  }

  async createVariant(req, res) {
    try {
      const variant = await this.model.createVariant(
        req,
        req.params.id,
        req.params.stopId,
        req.body,
      );
      res.json(variant);
    } catch (error) {
      Logger.error('Create guide variant failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create variant' });
    }
  }

  async updateVariant(req, res) {
    try {
      const variant = await this.model.updateVariant(
        req,
        req.params.id,
        req.params.stopId,
        req.params.variantId,
        req.body,
      );
      res.json(variant);
    } catch (error) {
      Logger.error('Update guide variant failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update variant' });
    }
  }

  async deleteVariant(req, res) {
    try {
      await this.model.deleteVariant(req, req.params.id, req.params.stopId, req.params.variantId);
      res.json({ deleted: true });
    } catch (error) {
      Logger.error('Delete guide variant failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete variant' });
    }
  }

  async getAudio(req, res) {
    try {
      const audio = await this.model.getAudio(
        req,
        req.params.id,
        req.params.stopId,
        req.params.variantId,
      );
      res.json(audio);
    } catch (error) {
      Logger.error('Get guide audio failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch audio' });
    }
  }

  async createAudio(req, res) {
    try {
      const audio = await this.model.createAudio(
        req,
        req.params.id,
        req.params.stopId,
        req.params.variantId,
        req.body,
      );
      res.json(audio);
    } catch (error) {
      Logger.error('Create guide audio failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create audio' });
    }
  }

  async updateAudio(req, res) {
    try {
      const audio = await this.model.updateAudio(
        req,
        req.params.id,
        req.params.stopId,
        req.params.variantId,
        req.body,
      );
      res.json(audio);
    } catch (error) {
      Logger.error('Update guide audio failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update audio' });
    }
  }

  async deleteAudio(req, res) {
    try {
      if (this.audioOrchestration) {
        await this.audioOrchestration.deleteWithBlob(
          req,
          req.params.id,
          req.params.stopId,
          req.params.variantId,
        );
      } else {
        await this.model.deleteAudio(req, req.params.id, req.params.stopId, req.params.variantId);
      }
      res.json({ deleted: true });
    } catch (error) {
      Logger.error('Delete guide audio failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete audio' });
    }
  }

  async generateAudio(req, res) {
    try {
      if (!this.audioOrchestration) {
        return res.status(500).json({ error: 'Audio orchestration not configured' });
      }
      const audio = await this.audioOrchestration.generate(
        req,
        req.params.id,
        req.params.stopId,
        req.params.variantId,
      );
      res.json(audio);
    } catch (error) {
      Logger.error('Generate guide audio failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to generate audio' });
    }
  }

  async cancelAudio(req, res) {
    try {
      if (!this.audioOrchestration) {
        return res.status(500).json({ error: 'Audio orchestration not configured' });
      }
      const audio = await this.audioOrchestration.cancel(
        req,
        req.params.id,
        req.params.stopId,
        req.params.variantId,
      );
      res.json(audio);
    } catch (error) {
      Logger.error('Cancel guide audio failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to cancel audio' });
    }
  }

  async previewAudio(req, res) {
    try {
      if (!this.audioOrchestration) {
        return res.status(500).json({ error: 'Audio orchestration not configured' });
      }
      const { stream, mimeType } = await this.audioOrchestration.preview(
        req,
        req.params.id,
        req.params.stopId,
        req.params.variantId,
      );

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      stream.on('error', (err) => {
        Logger.error('Guide audio preview stream error', err, {
          placeId: req.params.id,
          stopId: req.params.stopId,
          variantId: req.params.variantId,
        });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Preview failed' });
        } else {
          res.destroy();
        }
      });
      stream.pipe(res);
    } catch (error) {
      Logger.error('Preview guide audio failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to preview audio' });
    }
  }

  async approveStopNarrative(req, res) {
    try {
      const stop = await this.model.approveStopNarrative(req, req.params.id, req.params.stopId);
      res.json(stop);
    } catch (error) {
      Logger.error('Approve guide stop narrative failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to approve stop narrative' });
    }
  }

  async approveVariantContent(req, res) {
    try {
      const variant = await this.model.approveVariantContent(
        req,
        req.params.id,
        req.params.stopId,
        req.params.variantId,
      );
      res.json(variant);
    } catch (error) {
      Logger.error('Approve guide variant content failed', error, {
        placeId: req.params.id,
        stopId: req.params.stopId,
        variantId: req.params.variantId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to approve variant content' });
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
}

module.exports = GuidesController;
