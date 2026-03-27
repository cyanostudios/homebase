// plugins/cups/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const { scrapeUrl, scrapeHtml } = require('./scraper');
const fs = require('fs');
const path = require('path');

const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'cups-scrape');

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

class CupsController {
  constructor(model) {
    this.model = model;
  }

  _normalizePdfText(text) {
    return String(text || '')
      .replace(/\r/g, '\n')
      .replace(/-\n(?=\p{L})/gu, '') // repair hyphenated line-break words
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  _sanitizeFilename(name) {
    return String(name || 'source-file')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .slice(-220);
  }

  _resolveStoredFilePath(filename) {
    const safeName = path.basename(String(filename || ''));
    if (!safeName) return null;
    return path.join(uploadRoot, safeName);
  }

  async _scrapeCupsFromFilePath(filePath, displayName) {
    const lowerName = String(displayName || path.basename(filePath)).toLowerCase();
    const isPdf = lowerName.endsWith('.pdf');
    if (isPdf) {
      const pdfParse = require('pdf-parse');
      const fileBuffer = fs.readFileSync(filePath);
      const parsed = await pdfParse(fileBuffer);
      const text = this._normalizePdfText(parsed?.text || '');
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const pseudoHtml = `<main><h1>${displayName || path.basename(filePath)}</h1><article><pre>${escaped}</pre></article></main>`;
      return scrapeHtml(pseudoHtml, displayName || path.basename(filePath));
    }
    const html = fs.readFileSync(filePath, 'utf8');
    return scrapeHtml(html, displayName || path.basename(filePath));
  }

  async _storeSourceFile(req, sourceId, file) {
    const sources = await this.model.getAllSources(req);
    const source = sources.find((s) => String(s.id) === String(sourceId));
    if (!source) {
      throw new AppError('Source not found', 404, AppError.CODES.NOT_FOUND);
    }
    if (source.type !== 'file') {
      throw new AppError('Source is not a file source', 400, AppError.CODES.VALIDATION_ERROR);
    }
    if (source.filename) {
      const previousPath = this._resolveStoredFilePath(source.filename);
      if (previousPath && fs.existsSync(previousPath)) {
        fs.unlink(previousPath, () => {});
      }
    }

    ensureDirSync(uploadRoot);
    const originalBase = path.basename(file.originalname || 'upload-file');
    const storedName = `source-${sourceId}-${Date.now()}-${this._sanitizeFilename(originalBase)}`;
    const storedPath = path.join(uploadRoot, storedName);
    fs.copyFileSync(file.path, storedPath);

    const updated = await this.model.updateSource(req, sourceId, {
      filename: storedName,
      last_result: 'File uploaded',
    });
    return { source: updated, storedPath, displayName: file.originalname || storedName };
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
      const sources = await this.model.getAllSources(req);
      const source = sources.find((s) => String(s.id) === String(req.params.id));
      if (source?.filename) {
        const storedFilePath = this._resolveStoredFilePath(source.filename);
        if (storedFilePath && fs.existsSync(storedFilePath)) {
          fs.unlink(storedFilePath, () => {});
        }
      }
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
        const storedFilePath = this._resolveStoredFilePath(source.filename);
        if (!storedFilePath || !fs.existsSync(storedFilePath)) {
          return res.status(400).json({ error: 'No uploaded file found for this source' });
        }
        cups = await this._scrapeCupsFromFilePath(storedFilePath, source.filename);
      }

      const { inserted, skipped } = await this.model.insertScrapedCups(req, cups, parseInt(id, 10));
      const resultLabel =
        skipped > 0
          ? `${inserted.length} new, ${skipped} already existed`
          : `${inserted.length} cups found`;
      await this.model.updateSource(req, id, {
        last_scraped_at: new Date().toISOString(),
        last_result: resultLabel,
      });
      return res.json({ ok: true, found: cups.length, inserted: inserted.length, skipped });
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
    const filePath = req.file.path;

    try {
      const { source, storedPath, displayName } = await this._storeSourceFile(req, id, req.file);
      const cups = await this._scrapeCupsFromFilePath(storedPath, displayName);
      const { inserted, skipped } = await this.model.insertScrapedCups(req, cups, parseInt(id, 10));
      const resultLabel =
        skipped > 0
          ? `${inserted.length} new, ${skipped} already existed`
          : `${inserted.length} cups from file`;
      await this.model.updateSource(req, id, {
        filename: source.filename,
        last_scraped_at: new Date().toISOString(),
        last_result: resultLabel,
      });
      return res.json({ ok: true, found: cups.length, inserted: inserted.length, skipped });
    } catch (error) {
      Logger.error('Scrape file failed', error, { sourceId: id });
      return res.status(500).json({ error: 'File parse failed', message: error.message });
    } finally {
      fs.unlink(filePath, () => {});
    }
  }

  async uploadSourceFile(req, res) {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
      const { source } = await this._storeSourceFile(req, id, req.file);
      return res.json(source);
    } catch (error) {
      Logger.error('Upload source file failed', error, { sourceId: id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'File upload failed', message: error.message });
    } finally {
      fs.unlink(req.file.path, () => {});
    }
  }
}

module.exports = CupsController;
