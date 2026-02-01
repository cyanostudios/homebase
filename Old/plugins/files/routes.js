// server/plugins/files/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createFilesRoutes(controller, requirePlugin) {
  const gate = requirePlugin(config.name); // auth/enablement guard

  // Where files are stored on disk
  const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'files');
  ensureDirSync(uploadRoot);

  // ---- Security: size limit & MIME allow-list ----
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file
  const MAX_FILES = 20;

  // Common safe document/image types
  const ALLOWED_MIME = new Set([
    // images
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
    // docs
    'application/pdf',
    'text/plain', 'text/csv',
    'application/zip',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
  ]);

  const storage = multer.diskStorage({
    destination: function (_req, _file, cb) {
      cb(null, uploadRoot);
    },
    filename: function (_req, file, cb) {
      // ✅ Store ASCII-safe filenames only (robust URLs/FS), preserve original for download suggestion
      const base = path.basename(file.originalname || 'file');
      // keep only ascii letters/numbers/._- ; replace everything else (including åäö) to underscore
      const asciiSafe = base.replace(/[^A-Za-z0-9._ -]+/g, '_').replace(/[ ]+/g, ' ');
      const ts = Date.now();
      const rnd = Math.random().toString(36).slice(2);
      cb(null, `${ts}-${rnd}-${asciiSafe}`);
    },
  });

  // Collect blocked files so we can return precise messages
  const fileFilter = (req, file, cb) => {
    if (!req.rejectedUploads) req.rejectedUploads = [];
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      req.rejectedUploads.push({
        name: file.originalname || 'unknown',
        type: file.mimetype || 'unknown',
      });
      cb(null, false); // skip saving just this file
    }
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  });

  const runUpload = (req, res, next) =>
    upload.array('files', MAX_FILES)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          const msg =
            err.code === 'LIMIT_FILE_SIZE'
              ? `File too large (max ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB)`
              : err.code === 'LIMIT_FILE_COUNT'
                ? `Too many files (max ${MAX_FILES})`
                : 'Upload rejected';
          return res.status(400).json({ error: msg });
        }
        return res.status(500).json({ error: 'Upload failed' });
      }
      if (Array.isArray(req.rejectedUploads) && req.rejectedUploads.length > 0) {
        const details = req.rejectedUploads.map((f) => `${f.name} (${f.type})`).join(', ');
        return res.status(400).json({ error: `Blocked file types: ${details}` });
      }
      next();
    });

  // ---- CRUD (metadata) ----
  router.get('/', gate, (req, res) => controller.getAll(req, res));
  router.post('/', gate, (req, res) => controller.create(req, res));
  router.put('/:id', gate, (req, res) => controller.update(req, res));
  router.delete('/:id', gate, (req, res) => controller.delete(req, res));

  // ---- MULTIPART upload: returns array of created FileItems ----
  router.post('/upload', gate, runUpload, (req, res) =>
    controller.upload(req, res, { uploadRoot })
  );

  // ---- RAW file serving by stored filename (behind auth gate) ----
  router.get('/raw/:filename', gate, (req, res) =>
    controller.raw(req, res, { uploadRoot })
  );

  return router;
}

module.exports = createFilesRoutes;
