// plugins/cups/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const { scrapeUrl, scrapeHtml } = require('./scraper');

class CupsController {
  constructor(model) {
    this.model = model;
  }

  // ─── CUPS ────────────────────────────────────────────────────────────────────

  async getAll(req, res) {
    try {
      const cups = await this.model.getAll(req);
      res.json(cups);
    } catch (error) {
      Logger.error('Get cups failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch cups' });
    }
  }

  async getById(req, res) {
    try {
      const cup = await this.model.getById(req, req.params.id);
      res.json(cup);
    } catch (error) {
      Logger.error('Get cup failed', error, { cupId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch cup' });
    }
  }

  async create(req, res) {
    try {
      const cup = await this.model.create(req, req.body);
      res.json(cup);
    } catch (error) {
      Logger.error('Create cup failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create cup' });
    }
  }

  async update(req, res) {
    try {
      const cup = await this.model.update(req, req.params.id, req.body);
      res.json(cup);
    } catch (error) {
      Logger.error('Update cup failed', error, { cupId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update cup' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Cup deleted successfully' });
    } catch (error) {
      Logger.error('Delete cup failed', error, { cupId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete cup' });
    }
  }

  async bulkDelete(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res
          .status(400)
          .json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }
      const ids = Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)));
      if (!ids.length) return res.json({ ok: true, requested: 0, deleted: 0 });
      if (ids.length > 500) {
        return res
          .status(400)
          .json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }
      const result = await this.model.bulkDelete(req, ids);
      const deleted =
        typeof result?.deletedCount === 'number'
          ? result.deletedCount
          : (result?.deletedIds?.length ?? 0);
      return res.json({
        ok: true,
        requested: ids.length,
        deleted,
        deletedIds: result?.deletedIds || [],
      });
    } catch (error) {
      Logger.error('Bulk delete cups failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Bulk delete failed' });
    }
  }

  // ─── SOURCES ─────────────────────────────────────────────────────────────────

  async getSources(req, res) {
    try {
      const sources = await this.model.getAllSources(req);
      res.json(sources);
    } catch (error) {
      Logger.error('Get cup sources failed', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch sources' });
    }
  }

  async createSource(req, res) {
    try {
      const source = await this.model.createSource(req, req.body);
      res.json(source);
    } catch (error) {
      Logger.error('Create cup source failed', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create source' });
    }
  }

  async updateSource(req, res) {
    try {
      const source = await this.model.updateSource(req, req.params.id, req.body);
      res.json(source);
    } catch (error) {
      Logger.error('Update cup source failed', error, { sourceId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update source' });
    }
  }

  async deleteSource(req, res) {
    try {
      await this.model.deleteSource(req, req.params.id);
      res.json({ message: 'Source deleted successfully' });
    } catch (error) {
      Logger.error('Delete cup source failed', error, { sourceId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete source' });
    }
  }

  // ─── SCRAPE ───────────────────────────────────────────────────────────────────

  async scrapeSource(req, res) {
    const { id } = req.params;
    let source;
    try {
      const sources = await this.model.getAllSources(req);
      source = sources.find((s) => String(s.id) === String(id));
      if (!source) {
        return res.status(404).json({ error: 'Source not found' });
      }
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch source' });
    }

    try {
      let cups = [];
      if (source.type === 'url') {
        if (!source.url) {
          return res.status(400).json({ error: 'Source has no URL configured' });
        }
        cups = await scrapeUrl(source.url);
      } else {
        return res.status(400).json({ error: 'Use the /scrape-file endpoint for file sources' });
      }

      const inserted = await this.model.insertScrapedCups(req, cups, parseInt(id, 10));
      await this.model.updateSource(req, id, {
        last_scraped_at: new Date().toISOString(),
        last_result: `${inserted.length} cups found`,
      });
      return res.json({ ok: true, found: cups.length, inserted: inserted.length });
    } catch (error) {
      Logger.error('Scrape source failed', error, { sourceId: id });
      await this.model
        .updateSource(req, id, {
          last_scraped_at: new Date().toISOString(),
          last_result: `Error: ${error.message}`,
        })
        .catch(() => {});
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Scrape failed', message: error.message });
    }
  }

  async scrapeFile(req, res) {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fs = require('fs');
    const path = require('path');
    const filePath = req.file.path;

    try {
      const html = fs.readFileSync(filePath, 'utf8');
      const cups = scrapeHtml(html, req.file.originalname || path.basename(filePath));
      const inserted = await this.model.insertScrapedCups(req, cups, parseInt(id, 10));
      await this.model.updateSource(req, id, {
        last_scraped_at: new Date().toISOString(),
        last_result: `${inserted.length} cups from file`,
      });
      return res.json({ ok: true, found: cups.length, inserted: inserted.length });
    } catch (error) {
      Logger.error('Scrape file failed', error, { sourceId: id });
      return res.status(500).json({ error: 'File parse failed', message: error.message });
    } finally {
      fs.unlink(filePath, () => {});
    }
  }
}

module.exports = CupsController;
