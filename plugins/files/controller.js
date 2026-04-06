// plugins/files/controller.js
// Files controller - V3 with @homebase/core SDK + storage abstraction
const fs = require('fs');
const path = require('path');
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const {
  ensureStorageProvidersRegistered,
} = require('../../server/core/storage/registerDefaultAdapters');
const StorageProviderRegistry = require('../../server/core/storage/StorageProviderRegistry');

/** MIME types (or filename) safe to show in browser without forcing download. */
function wantsInlinePreview(mimeType, filename) {
  if (mimeType && typeof mimeType === 'string') {
    const m = mimeType.toLowerCase();
    if (
      m.startsWith('image/') ||
      m === 'application/pdf' ||
      m.startsWith('text/') ||
      m.startsWith('video/') ||
      m.startsWith('audio/')
    ) {
      return true;
    }
  }
  if (filename && typeof filename === 'string') {
    const ext = path.extname(filename).toLowerCase();
    return [
      '.pdf',
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.webp',
      '.svg',
      '.txt',
      '.mp4',
      '.webm',
    ].includes(ext);
  }
  return false;
}

class FilesController {
  /**
   * @param {import('./model')} model
   * @param {import('./filesService')} filesService
   */
  constructor(model, filesService) {
    this.model = model;
    this.filesService = filesService;
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
      const item = await this.model.getById(req, req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      await this.filesService.deleteStoredBlob(req, item);
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

  async bulkDelete(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res
          .status(400)
          .json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const ids = Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)));

      if (!ids.length) {
        return res.json({ ok: true, requested: 0, deleted: 0 });
      }

      if (ids.length > 500) {
        return res
          .status(400)
          .json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }

      const itemsToDelete = [];
      for (const id of ids) {
        try {
          const item = await this.model.getById(req, id);
          if (item) itemsToDelete.push(item);
        } catch (_e) {
          /* skip */
        }
      }

      for (const item of itemsToDelete) {
        await this.filesService.deleteStoredBlob(req, item);
      }

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

  async upload(req, res, { uploadRoot: _uploadRoot }) {
    void _uploadRoot;
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      if (!files.length) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const created = await this.filesService.processUpload(req, files);
      res.json(created);
    } catch (error) {
      Logger.error('File upload failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: error?.message || 'Failed to upload files' });
    }
  }

  async raw(req, res, { uploadRoot }) {
    try {
      const filename = path.basename(req.params.filename || '');
      if (!filename) return res.status(400).json({ error: 'Missing filename' });

      const item = await this.model.getByStoredFilename(req, filename);
      if (item && item.storageProvider === 'googledrive') {
        return res.status(400).json({
          error: 'Use GET /api/files/:id/download for cloud-hosted files',
        });
      }

      const abs = path.join(uploadRoot, filename);
      if (!fs.existsSync(abs)) return res.status(404).json({ error: 'File not found' });

      let suggested = null;
      try {
        if (item?.name) suggested = item.name;
      } catch (_e) {
        /* ignore */
      }

      const mime = item?.mimeType || 'application/octet-stream';
      if (item?.mimeType) {
        res.setHeader('Content-Type', mime);
      }

      if (suggested) {
        const disp = wantsInlinePreview(item?.mimeType, suggested) ? 'inline' : 'attachment';
        res.setHeader(
          'Content-Disposition',
          `${disp}; filename*=UTF-8''${encodeURIComponent(suggested)}`,
        );
        return res.sendFile(abs);
      }
      return res.sendFile(abs);
    } catch (error) {
      Logger.error('File serve failed', error, { filename: req.params.filename });
      res.status(500).json({ error: 'Failed to serve file' });
    }
  }

  /** Stream file bytes via storage abstraction (local or Google Drive). */
  async downloadById(req, res) {
    try {
      ensureStorageProvidersRegistered();
      const row = await this.model.getById(req, req.params.id);
      if (!row) {
        return res.status(404).json({ error: 'File not found' });
      }

      const extId = this.filesService.resolveExternalId(row);
      if (!extId) {
        return res.status(404).json({ error: 'No file content available' });
      }

      const provider = StorageProviderRegistry.resolveForFileRow(row);
      const stream = await provider.download(req, { externalFileId: extId });

      const inline =
        req.query.inline === '1' ||
        req.query.inline === 'true' ||
        req.query.disposition === 'inline';
      const disposition = inline ? 'inline' : 'attachment';
      const nameEnc = encodeURIComponent(row.name || 'file');

      res.setHeader('Content-Type', row.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${nameEnc}`);

      stream.on('error', (err) => {
        Logger.error('Download stream error', err, { fileId: req.params.id });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        } else {
          res.destroy();
        }
      });
      stream.pipe(res);
    } catch (error) {
      Logger.error('Download by id failed', error, { fileId: req.params.id });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: error?.message || 'Download failed' });
    }
  }

  /**
   * Objects from the active StorageProvider (Google Drive API or empty for local).
   * For verifying list + token refresh without file_attachments.
   */
  async listStorageObjects(req, res) {
    try {
      ensureStorageProvidersRegistered();
      const provider = await StorageProviderRegistry.resolveForUpload(req);
      const raw = Number(req.query.pageSize);
      const pageSize = Math.min(Number.isFinite(raw) && raw > 0 ? raw : 50, 100);
      const items = await provider.list(req, { pageSize });
      res.json({ provider: provider.name, items });
    } catch (error) {
      Logger.error('List storage objects failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: error?.message || 'Failed to list storage objects' });
    }
  }

  /**
   * Forces a minimal Drive API call through the adapter (validates + refreshes token if needed).
   * Returns 400 if local storage is active or Drive is not connected.
   */
  async validateGoogleDriveStorage(req, res) {
    try {
      ensureStorageProvidersRegistered();
      const provider = await StorageProviderRegistry.resolveForUpload(req);
      if (provider.name !== 'googledrive') {
        return res.status(400).json({
          error: 'Google Drive is not the active storage provider',
          activeProvider: provider.name,
        });
      }
      await provider.list(req, { pageSize: 1 });
      res.json({ ok: true, provider: 'googledrive' });
    } catch (error) {
      Logger.error('Google Drive storage validation failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res
        .status(502)
        .json({ ok: false, error: error?.message || 'Google Drive validation failed' });
    }
  }

  async getAttachments(req, res) {
    try {
      const pluginName = req.query.plugin;
      const entityId = req.query.entityId;
      if (!pluginName || !entityId) {
        return res.status(400).json({ error: 'plugin and entityId query params are required' });
      }
      const list = await this.filesService.getAttachmentsForEntity(req, {
        pluginName,
        entityId,
      });
      res.json(list);
    } catch (error) {
      Logger.error('Get attachments failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to list attachments' });
    }
  }

  async createAttachment(req, res) {
    try {
      const { pluginName, entityId, fileId } = req.body;
      const row = await this.filesService.attachFile(req, {
        pluginName,
        entityId,
        fileId: String(fileId),
      });
      res.status(201).json(row);
    } catch (error) {
      Logger.error('Create attachment failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to attach file' });
    }
  }

  async deleteAttachment(req, res) {
    try {
      await this.filesService.detachFile(req, req.params.attachmentId);
      res.json({ ok: true, id: String(req.params.attachmentId) });
    } catch (error) {
      Logger.error('Delete attachment failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to detach file' });
    }
  }
}

module.exports = FilesController;
