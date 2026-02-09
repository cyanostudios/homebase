// plugins/files/controller.js
// Files controller - V3 with @homebase/core SDK
const fs = require('fs');
const path = require('path');
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class FilesController {
  constructor(model) {
    this.model = model;
  }

  mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;
    const detail = String(error.detail || '');
    const m = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
    const field = m ? m[1].split(',').map((s) => s.trim())[1] || 'general' : 'general';
    const val = m ? m[2] : undefined;
    return {
      field,
      message: val
        ? `Unique value "${val}" already exists for ${field}`
        : 'Unique constraint violated',
    };
  }

  async getAll(req, res) {
    try {
      const items = await this.model.getAll(req);
      res.json(items);
    } catch (error) {
      Logger.error('Get files failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to fetch files' });
    }
  }

  async create(req, res) {
    try {
      const item = await this.model.create(req, req.body);
      res.json(item);
    } catch (error) {
      Logger.error('Create file metadata failed', error, { userId: Context.getUserId(req) });

      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to create file' });
    }
  }

  async update(req, res) {
    try {
      const item = await this.model.update(req, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      Logger.error('Update file metadata failed', error, {
        fileId: req.params.id,
        userId: Context.getUserId(req),
      });

      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to update file' });
    }
  }

  async delete(req, res) {
    try {
      // Get file metadata first to know filename
      const item = await this.model.getById(req, req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Try to delete physical file if url points to our raw-route
      const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
      try {
        if (item.url && item.url.startsWith('/api/files/raw/')) {
          const filename = path.basename(item.url.replace('/api/files/raw/', ''));
          const abs = path.join(uploadRoot, filename);
          if (fs.existsSync(abs)) {
            fs.unlinkSync(abs);

            Logger.info('Physical file deleted', { filename, fileId: req.params.id });
          }
        }
      } catch (fsErr) {
        Logger.warn('Failed to delete physical file', fsErr, { fileId: req.params.id });
      }

      // Delete metadata in DB
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Item deleted successfully', id: String(req.params.id) });
    } catch (error) {
      Logger.error('Delete file failed', error, {
        fileId: req.params.id,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to delete file' });
    }
  }

  // DELETE /api/files/batch
  // body: { ids: string[] }
  async bulkDelete(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res.status(400).json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const ids = Array.from(
        new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)),
      );

      if (!ids.length) {
        return res.json({ ok: true, requested: 0, deleted: 0 });
      }

      if (ids.length > 500) {
        return res.status(400).json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }

      // Get all files first to delete physical files
      const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
      const itemsToDelete = [];
      for (const id of ids) {
        try {
          const item = await this.model.getById(req, id);
          if (item) itemsToDelete.push(item);
        } catch (e) {
          // Skip if not found
        }
      }

      // Delete physical files
      for (const item of itemsToDelete) {
        try {
          if (item.url && item.url.startsWith('/api/files/raw/')) {
            const filename = path.basename(item.url.replace('/api/files/raw/', ''));
            const abs = path.join(uploadRoot, filename);
            if (fs.existsSync(abs)) {
              fs.unlinkSync(abs);
              Logger.info('Physical file deleted', { filename, fileId: item.id });
            }
          }
        } catch (fsErr) {
          Logger.warn('Failed to delete physical file', fsErr, { fileId: item.id });
        }
      }

      // Delete metadata in DB
      const result = await this.model.bulkDelete(req, ids);

      const deleted =
        typeof result?.deletedCount === 'number'
          ? result.deletedCount
          : Array.isArray(result?.deletedIds)
            ? result.deletedIds.length
            : 0;

      return res.json({
        ok: true,
        requested: ids.length,
        deleted,
        deletedIds: result?.deletedIds || [],
      });
    } catch (error) {
      Logger.error('Bulk delete error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({ error: 'Bulk delete failed' });
    }
  }

  async upload(req, res, { uploadRoot }) {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      if (!files.length) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const created = [];
      for (const f of files) {
        // 🔧 Multer ger originalname i latin1 – konvertera till UTF-8
        const utf8Name = f.originalname
          ? Buffer.from(f.originalname, 'latin1').toString('utf8')
          : 'file';

        const item = await this.model.create(req, {
          name: utf8Name,
          size: f.size ?? null,
          mimeType: f.mimetype ?? null,
          url: `/api/files/raw/${path.basename(f.filename)}`,
        });
        created.push(item);
      }

      res.json(created);
    } catch (error) {
      Logger.error('File upload failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to upload files' });
    }
  }

  // Serve with correct Content-Disposition filename (original name)
  async raw(req, res, { uploadRoot }) {
    try {
      const filename = path.basename(req.params.filename || '');
      if (!filename) return res.status(400).json({ error: 'Missing filename' });

      const abs = path.join(uploadRoot, filename);
      if (!fs.existsSync(abs)) return res.status(404).json({ error: 'File not found' });

      // Look up DB record to suggest original name for download
      let item = null;
      try {
        item = await this.model.getByStoredFilename(req, filename);
      } catch (e) {
        // Soft error – continue without metadata
      }

      if (req.query.download === '1' && item?.name) {
        return res.download(abs, item.name);
      }

      // Serve inline for previews/viewing
      if (item?.mimeType) {
        res.setHeader('Content-Type', item.mimeType);
      }
      return res.sendFile(abs);
    } catch (error) {
      Logger.error('File serve failed', error, { filename: req.params.filename });
      res.status(500).json({ error: 'Failed to serve file' });
    }
  }
}

module.exports = FilesController;
