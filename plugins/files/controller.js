// plugins/files/controller.js
// Files controller - handles HTTP requests for file metadata CRUD and file upload/download operations
const fs = require('fs');
const path = require('path');

class FilesController {
  constructor(model) {
    this.model = model;
  }

  getUserId(req) {
    return req.session.currentTenantUserId || req.session.user.id;
  }

  mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;
    const detail = String(error.detail || '');
    const m = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
    const field = m ? (m[1].split(',').map(s => s.trim())[1] || 'general') : 'general';
    const val = m ? m[2] : undefined;
    return { field, message: val ? `Unique value "${val}" already exists for ${field}` : 'Unique constraint violated' };
  }

  async getAll(req, res) {
    try {
      const userId = this.getUserId(req);
      const items = await this.model.getAll(req, userId);
      res.json(items);
    } catch (error) {
      console.error('Files:getAll error:', error);
      res.status(500).json({ error: 'Failed to fetch files' });
    }
  }

  async create(req, res) {
    try {
      const userId = this.getUserId(req);
      const item = await this.model.create(req, userId, req.body);
      res.json(item);
    } catch (error) {
      console.error('Files:create error:', error);
      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      res.status(500).json({ error: 'Failed to create file' });
    }
  }

  async update(req, res) {
    try {
      const userId = this.getUserId(req);
      const item = await this.model.update(req, userId, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      console.error('Files:update error:', error);
      if (/not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Item not found' });
      }
      const mapped = this.mapUniqueViolation(error);
      if (mapped) return res.status(409).json({ errors: [mapped] });
      res.status(500).json({ error: 'Failed to update file' });
    }
  }

  async delete(req, res) {
    try {
      const userId = this.getUserId(req);
      
      // Hämta posten först för att veta vilket filnamn som ligger på disk
      const item = await this.model.getById(req, userId, req.params.id);
      if (!item) return res.status(404).json({ error: 'Item not found' });

      // Försök radera den fysiska filen om url pekar på vår raw-route
      const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
      try {
        if (item.url && item.url.startsWith('/api/files/raw/')) {
          const filename = path.basename(item.url.replace('/api/files/raw/', ''));
          const abs = path.join(uploadRoot, filename);
          if (fs.existsSync(abs)) fs.unlinkSync(abs);
        }
      } catch (fsErr) {
        console.warn('Files:delete physical file warning:', fsErr);
      }

      // Radera metadata i DB
      await this.model.delete(req, userId, req.params.id);
      res.json({ message: 'Item deleted successfully', id: String(req.params.id) });
    } catch (error) {
      console.error('Files:delete error:', error);
      if (/not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }

  async upload(req, res, { uploadRoot }) {
    try {
      const userId = this.getUserId(req);
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

        const item = await this.model.create(req, userId, {
          name: utf8Name,
          size: f.size ?? null,
          mimeType: f.mimetype ?? null,
          url: `/api/files/raw/${path.basename(f.filename)}`,
        });
        created.push(item);
      }

      res.json(created);
    } catch (error) {
      console.error('Files:upload error:', error);
      res.status(500).json({ error: 'Failed to upload files' });
    }
  }

  // Serve with correct Content-Disposition filename (original name)
  async raw(req, res, { uploadRoot }) {
    try {
      const userId = this.getUserId(req);
      const filename = path.basename(req.params.filename || '');
      if (!filename) return res.status(400).json({ error: 'Missing filename' });

      const abs = path.join(uploadRoot, filename);
      if (!fs.existsSync(abs)) return res.status(404).json({ error: 'File not found' });

      // Slå upp DB-post för att föreslå originalnamn vid nedladdning
      let suggested = null;
      try {
        const item = await this.model.getByStoredFilename(req, userId, filename);
        if (item?.name) suggested = item.name;
      } catch (e) {
        // mjukt fel – fortsätt utan suggested
      }

      if (suggested) {
        return res.download(abs, suggested);
      }
      return res.sendFile(abs);
    } catch (error) {
      console.error('Files:raw error:', error);
      res.status(500).json({ error: 'Failed to serve file' });
    }
  }
}

module.exports = FilesController;