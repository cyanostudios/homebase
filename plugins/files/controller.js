// plugins/files/controller.js
// Files controller - V3 with @homebase/core SDK
const fs = require('fs');
const path = require('path');
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const { sanitizeFolderPath, resolvePhysicalPath, buildFileUrl } = require('./pathUtils');

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
      const folderPath = req.query.folderPath;
      const items = await this.model.getAll(req, { folderPath: folderPath === '' ? null : folderPath });
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

      const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
      try {
        const abs = resolvePhysicalPath(uploadRoot, item.url);
        if (abs && fs.existsSync(abs)) {
          fs.unlinkSync(abs);
          Logger.info('Physical file deleted', { fileId: req.params.id });
        }
      } catch (fsErr) {
        Logger.warn('Failed to delete physical file', fsErr, { fileId: req.params.id });
      }

      // Delete metadata in DB
      await this.model.delete(req, req.params.id);

      // Remove folder if now empty
      await this._removeEmptyFolders(req, uploadRoot, [item]);

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
  // body: { ids?: string[], folderPaths?: string[] }
  async bulkDelete(req, res) {
    try {
      const idsRaw = req.body?.ids ?? [];
      const folderPathsRaw = req.body?.folderPaths ?? [];

      let ids = Array.isArray(idsRaw)
        ? Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)))
        : [];
      const folderPaths = Array.isArray(folderPathsRaw)
        ? folderPathsRaw.map((p) => sanitizeFolderPath(p)).filter(Boolean)
        : [];

      // Expand folderPaths to file IDs
      for (const fp of folderPaths) {
        const folderIds = await this.model.getFileIdsInFolder(req, fp);
        ids = [...new Set([...ids, ...folderIds])];
      }

      if (!ids.length && !folderPaths.length) {
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

      for (const item of itemsToDelete) {
        try {
          const abs = resolvePhysicalPath(uploadRoot, item.url);
          if (abs && fs.existsSync(abs)) {
            fs.unlinkSync(abs);
            Logger.info('Physical file deleted', { fileId: item.id });
          }
        } catch (fsErr) {
          Logger.warn('Failed to delete physical file', fsErr, { fileId: item.id });
        }
      }

      // Delete metadata in DB
      const result = await this.model.bulkDelete(req, ids);

      // When only files deleted: remove now-empty folders
      if (folderPaths.length === 0 && itemsToDelete.length > 0) {
        await this._removeEmptyFolders(req, uploadRoot, itemsToDelete);
      }

      // When folders explicitly selected: remove their directories (deepest first for nested)
      if (folderPaths.length > 0) {
        const sorted = [...folderPaths].sort((a, b) => b.length - a.length);
        for (const fp of sorted) {
          const absDir = path.join(uploadRoot, fp);
          if (fs.existsSync(absDir) && fs.statSync(absDir).isDirectory()) {
            try {
              this._removeDirRecursive(absDir);
              Logger.info('Folder removed', { folderPath: fp });
            } catch (rmErr) {
              Logger.warn('Failed to remove folder', rmErr, { folderPath: fp });
            }
          }
        }
      }

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

      const folderPath = sanitizeFolderPath(req.query?.folderPath ?? req.body?.folderPath);
      const created = [];
      for (const f of files) {
        const utf8Name = f.originalname
          ? Buffer.from(f.originalname, 'latin1').toString('utf8')
          : 'file';

        const url = buildFileUrl(folderPath, path.basename(f.filename));
        const item = await this.model.create(req, {
          name: utf8Name,
          size: f.size ?? null,
          mimeType: f.mimetype ?? null,
          url,
          folderPath: folderPath || null,
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

  async getLists(req, res) {
    try {
      const listsModel = require('../../server/core/lists/listsModel');
      const data = await listsModel.getLists(req, 'files');
      res.json(data);
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch lists' });
    }
  }

  async createList(req, res) {
    try {
      const listsModel = require('../../server/core/lists/listsModel');
      const name = req.body?.name ?? '';
      const data = await listsModel.createList(req, 'files', name);
      res.status(201).json(data);
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create list' });
    }
  }

  async getListFiles(req, res) {
    try {
      const data = await this.model.getListFiles(req, req.params.id);
      res.json(data);
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch list files' });
    }
  }

  async renameList(req, res) {
    try {
      const listsModel = require('../../server/core/lists/listsModel');
      const name = req.body?.name ?? '';
      const data = await listsModel.renameList(req, 'files', req.params.id, name);
      res.json(data);
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to rename list' });
    }
  }

  async deleteList(req, res) {
    try {
      const listsModel = require('../../server/core/lists/listsModel');
      await listsModel.deleteList(req, 'files', req.params.id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete list' });
    }
  }

  async addFilesToList(req, res) {
    try {
      const fileIds = req.body?.fileIds;
      if (!Array.isArray(fileIds)) return res.status(400).json({ error: 'fileIds array required' });
      const result = await this.model.addFilesToList(req, req.params.id, fileIds);
      res.json(result);
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to add files to list' });
    }
  }

  async removeFileFromList(req, res) {
    try {
      await this.model.removeFileFromList(req, req.params.id, req.params.fileId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to remove file from list' });
    }
  }

  // Serve file by path (req.params.path = full path after /raw/, e.g. "Mapp A/file.pdf" or "file.pdf")
  async raw(req, res, { uploadRoot }) {
    try {
      const pathParam = req.params.path || req.params[0] || '';
      if (!pathParam) return res.status(400).json({ error: 'Missing path' });

      const decoded = decodeURIComponent(pathParam);
      if (decoded.includes('..') || path.isAbsolute(decoded)) {
        return res.status(400).json({ error: 'Invalid path' });
      }

      const abs = path.resolve(uploadRoot, decoded);
      const rootResolved = path.resolve(uploadRoot);
      if (!abs.startsWith(rootResolved) || abs === rootResolved) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        return res.status(404).json({ error: 'File not found' });
      }

      const fullUrl = '/api/files/raw/' + pathParam;
      let item = null;
      try {
        item = await this.model.getByUrl(req, fullUrl) ?? await this.model.getByStoredFilename(req, path.basename(decoded));
      } catch (e) {
        // Soft error – continue without metadata
      }

      if (req.query.download === '1' && item?.name) {
        return res.download(abs, item.name);
      }

      if (item?.mimeType) {
        res.setHeader('Content-Type', item.mimeType);
      }
      return res.sendFile(abs);
    } catch (error) {
      Logger.error('File serve failed', error, { path: req.params.path ?? req.params[0] });
      res.status(500).json({ error: 'Failed to serve file' });
    }
  }

  // POST /api/files/:id/move  body: { folderPath: string | null }
  async move(req, res) {
    try {
      const fileId = req.params.id;
      const targetPath = req.body?.folderPath;
      const folderPath = targetPath === '' || targetPath == null ? null : sanitizeFolderPath(targetPath);

      const item = await this.model.getById(req, fileId);
      if (!item) return res.status(404).json({ error: 'File not found' });

      if (!item.url || !item.url.startsWith('/api/files/raw/')) {
        return res.status(400).json({ error: 'File cannot be moved (not a local file)' });
      }

      const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
      const currentAbs = resolvePhysicalPath(uploadRoot, item.url);
      if (!currentAbs || !fs.existsSync(currentAbs)) {
        return res.status(404).json({ error: 'Physical file not found' });
      }

      const storedFilename = path.basename(currentAbs);
      const targetDir = folderPath ? path.join(uploadRoot, folderPath) : uploadRoot;
      const targetAbs = path.join(targetDir, storedFilename);

      if (currentAbs !== targetAbs) {
        if (!fs.existsSync(path.dirname(targetAbs))) {
          fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
        }
        fs.renameSync(currentAbs, targetAbs);
      }

      const newUrl = buildFileUrl(folderPath, storedFilename);
      const updated = await this.model.update(req, fileId, {
        url: newUrl,
        folderPath: folderPath || null,
        updatedAt: item.updatedAt, // preserve original – moving is not an edit
      });
      res.json(updated);
    } catch (error) {
      Logger.error('Move file failed', error, { fileId: req.params.id, userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to move file' });
    }
  }

  async getFolders(req, res) {
    try {
      const dbPaths = await this.model.getFolderPaths(req);
      const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
      const diskPaths = this._listFolderPathsOnDisk(uploadRoot);
      const merged = [...new Set([...dbPaths, ...diskPaths])].sort();
      res.json(merged);
    } catch (error) {
      Logger.error('Get folders failed', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch folders' });
    }
  }

  _getFolderPathsToCheck(items) {
    const paths = new Set();
    for (const item of items) {
      const fp = item.folderPath;
      if (!fp || typeof fp !== 'string' || !fp.trim()) continue;
      const parts = fp.split('/').filter(Boolean);
      let acc = '';
      for (const p of parts) {
        acc = acc ? `${acc}/${p}` : p;
        paths.add(acc);
      }
    }
    return [...paths].sort((a, b) => b.length - a.length); // deepest first
  }

  async _removeEmptyFolders(req, uploadRoot, deletedItems) {
    const foldersToCheck = this._getFolderPathsToCheck(deletedItems);
    if (foldersToCheck.length === 0) return;
    const remainingPaths = await this.model.getFolderPaths(req);
    const remainingSet = new Set(remainingPaths || []);
    for (const fp of foldersToCheck) {
      const hasFiles = remainingSet.has(fp) || [...remainingSet].some((r) => r.startsWith(fp + '/'));
      if (!hasFiles) {
        const absDir = path.join(uploadRoot, fp);
        if (fs.existsSync(absDir) && fs.statSync(absDir).isDirectory()) {
          try {
            fs.rmdirSync(absDir);
            Logger.info('Empty folder removed', { folderPath: fp });
          } catch (rmErr) {
            Logger.warn('Failed to remove empty folder', rmErr, { folderPath: fp });
          }
        }
      }
    }
  }

  _removeDirRecursive(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dirPath, ent.name);
      if (ent.isDirectory()) {
        this._removeDirRecursive(full);
      } else {
        fs.unlinkSync(full);
      }
    }
    fs.rmdirSync(dirPath);
  }

  _listFolderPathsOnDisk(uploadRoot) {
    const result = [];
    const rootResolved = path.resolve(uploadRoot);
    if (!fs.existsSync(rootResolved)) return result;
    const walk = (dir, prefix = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
        result.push(rel);
        walk(path.join(dir, ent.name), rel);
      }
    };
    walk(rootResolved);
    return result;
  }

  async createFolder(req, res) {
    try {
      const rawPath = req.body?.path ?? req.body?.name ?? '';
      const folderPath = sanitizeFolderPath(rawPath);
      if (!folderPath) {
        return res.status(400).json({ error: 'Folder name is required', code: 'VALIDATION_ERROR' });
      }
      const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
      const absPath = path.join(uploadRoot, folderPath);
      const rootResolved = path.resolve(uploadRoot);
      const absResolved = path.resolve(absPath);
      if (!absResolved.startsWith(rootResolved) || absResolved === rootResolved) {
        return res.status(400).json({ error: 'Invalid folder path', code: 'VALIDATION_ERROR' });
      }
      if (fs.existsSync(absResolved)) {
        if (fs.statSync(absResolved).isDirectory()) {
          return res.status(200).json({ path: folderPath, created: false });
        }
        return res.status(400).json({ error: 'Path already exists as file', code: 'VALIDATION_ERROR' });
      }
      fs.mkdirSync(absResolved, { recursive: true });
      Logger.info('Folder created', { folderPath, userId: Context.getUserId(req) });
      return res.status(201).json({ path: folderPath, created: true });
    } catch (error) {
      Logger.error('Create folder failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create folder' });
    }
  }
}

module.exports = FilesController;
