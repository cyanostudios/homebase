// plugins/files/filesService.js
// Orchestrates storage abstraction + metadata; no vendor-specific HTTP here.
const fs = require('fs');
const path = require('path');
const { Logger } = require('@homebase/core');
const {
  ensureStorageProvidersRegistered,
} = require('../../server/core/storage/registerDefaultAdapters');
const StorageProviderRegistry = require('../../server/core/storage/StorageProviderRegistry');

class FilesService {
  constructor(model, attachmentModel) {
    this.model = model;
    this.attachmentModel = attachmentModel;
  }

  /**
   * @param {{ url?: string|null, externalFileId?: string|null, storageProvider?: string|null }} row
   */
  resolveExternalId(row) {
    if (row.externalFileId) {
      return String(row.externalFileId);
    }
    if (row.url && row.url.startsWith('/api/files/raw/')) {
      return path.basename(row.url.replace('/api/files/raw/', ''));
    }
    return null;
  }

  /**
   * @param {import('express').Request} req
   * @param {Awaited<ReturnType<import('./model').FilesModel['getById']>>} row
   */
  async deleteStoredBlob(req, row) {
    if (!row) return;
    ensureStorageProvidersRegistered();
    const extId = this.resolveExternalId(row);
    if (!extId) {
      Logger.warn('No external id for delete; skipping blob', { fileId: row.id });
      return;
    }
    const provider = StorageProviderRegistry.resolveForFileRow(row);
    try {
      await provider.delete(req, { externalFileId: extId });
    } catch (err) {
      Logger.warn('Storage delete failed', { fileId: row.id, err: err?.message });
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Multer.File[]} files
   */
  async processUpload(req, files) {
    ensureStorageProvidersRegistered();
    const provider = await StorageProviderRegistry.resolveForUpload(req);
    const created = [];
    for (const f of files) {
      const utf8Name = f.originalname
        ? Buffer.from(f.originalname, 'latin1').toString('utf8')
        : 'file';

      let result;
      if (provider.name === 'googledrive') {
        const stream = fs.createReadStream(f.path);
        try {
          result = await provider.upload(req, {
            stream,
            filename: utf8Name,
            mimeType: f.mimetype ?? null,
            size: f.size ?? null,
          });
        } finally {
          try {
            fs.unlinkSync(f.path);
          } catch (_) {
            /* ignore */
          }
        }
      } else {
        result = await provider.upload(req, {
          path: f.path,
          storedFilename: f.filename,
          filename: utf8Name,
          mimeType: f.mimetype ?? null,
          size: f.size ?? null,
        });
      }

      const item = await this.model.create(req, {
        name: utf8Name,
        size: result.size ?? f.size ?? null,
        mimeType: f.mimetype ?? null,
        url: result.url,
        storageProvider: provider.name,
        externalFileId: result.externalFileId,
      });
      created.push(item);
    }
    return created;
  }

  /**
   * @param {import('express').Request} req
   * @param {{ pluginName: string, entityId: string, fileId: string }} data
   */
  async attachFile(req, data) {
    const { AppError } = require('../../server/core/errors/AppError');
    const pluginName = String(data.pluginName ?? '').trim();
    const entityId = String(data.entityId ?? '').trim();
    const fileId = String(data.fileId ?? '').trim();
    if (!pluginName || !entityId || !fileId) {
      throw new AppError(
        'pluginName, entityId, and fileId are required',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    const file = await this.model.getById(req, fileId);
    if (!file) {
      throw new AppError('File not found', 404, AppError.CODES.NOT_FOUND);
    }
    const created = await this.attachmentModel.create(req, {
      pluginName,
      entityId,
      fileId,
    });
    return {
      attachmentId: created.id,
      fileId: created.fileId,
      pluginName,
      entityId,
      file: {
        id: file.id,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        url: file.url,
        storageProvider: file.storageProvider,
        externalFileId: file.externalFileId,
      },
    };
  }

  /**
   * @param {import('express').Request} req
   * @param {{ pluginName: string, entityId: string }} params
   */
  async getAttachmentsForEntity(req, params) {
    const { AppError } = require('../../server/core/errors/AppError');
    const pluginName = String(params?.pluginName ?? '').trim();
    const entityId = String(params?.entityId ?? '').trim();
    if (!pluginName || !entityId) {
      throw new AppError(
        'pluginName and entityId are required',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    return this.attachmentModel.listForEntity(req, pluginName, entityId);
  }

  /**
   * @param {import('express').Request} req
   * @param {string} attachmentId
   */
  async detachFile(req, attachmentId) {
    const { AppError } = require('../../server/core/errors/AppError');
    const id = String(attachmentId ?? '').trim();
    if (!id) {
      throw new AppError('attachmentId is required', 400, AppError.CODES.VALIDATION_ERROR);
    }
    const att = await this.attachmentModel.getById(req, id);
    if (!att) {
      const { AppError } = require('../../server/core/errors/AppError');
      throw new AppError('Attachment not found', 404, AppError.CODES.NOT_FOUND);
    }
    await this.attachmentModel.delete(req, id);
    return att;
  }
}

module.exports = FilesService;
