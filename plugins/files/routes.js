// plugins/files/routes.js
// Files routes with V2 security (CSRF protection and input validation)
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FileType = require('file-type');
const { sanitizeFolderPath } = require('./pathUtils');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');
const { uploadLimiter } = require('../../server/core/middleware/rateLimit');

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createFilesRoutes(controller, context) {
  // V3: Get requirePlugin from context.middleware instead of parameter
  const requirePlugin = context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
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
  const TEXT_LIKE_MIME = new Set(['text/plain', 'text/csv', 'image/svg+xml']);
  const TEXT_LIKE_EXT = new Set(['.txt', '.csv', '.svg']);

  async function detectMimeFromContent(filePath) {
    const fd = await fs.promises.open(filePath, 'r');
    try {
      const sample = Buffer.alloc(8192);
      const { bytesRead } = await fd.read(sample, 0, sample.length, 0);
      if (!bytesRead) return null;
      const buf = sample.subarray(0, bytesRead);
      const detected = await FileType.fromBuffer(buf);
      return detected?.mime || null;
    } finally {
      await fd.close();
    }
  }

  function looksLikeTextBuffer(buf) {
    // Heuristic: allow common whitespace and printable ASCII; reject if many binary control bytes.
    let nonPrintable = 0;
    for (let i = 0; i < buf.length; i += 1) {
      const b = buf[i];
      const isWhitespace = b === 9 || b === 10 || b === 13;
      const isPrintable = b >= 32 && b <= 126;
      if (!isWhitespace && !isPrintable) nonPrintable += 1;
    }
    return nonPrintable / Math.max(buf.length, 1) < 0.05;
  }

  async function validateUploadedFilesByMagicBytes(files) {
    const blocked = [];
    for (const file of files || []) {
      try {
        const detectedMime = await detectMimeFromContent(file.path);
        if (detectedMime) {
          if (!ALLOWED_MIME.has(detectedMime)) {
            blocked.push({
              path: file.path,
              name: file.originalname || file.filename || 'unknown',
              reason: `detected ${detectedMime}`,
            });
          }
          continue;
        }

        const ext = path.extname(file.originalname || file.filename || '').toLowerCase();
        const declaredMime = String(file.mimetype || '').toLowerCase();
        if (!TEXT_LIKE_MIME.has(declaredMime) || !TEXT_LIKE_EXT.has(ext)) {
          blocked.push({
            path: file.path,
            name: file.originalname || file.filename || 'unknown',
            reason: 'undetected file signature',
          });
          continue;
        }

        const textSample = await fs.promises.readFile(file.path, { encoding: null });
        if (!looksLikeTextBuffer(textSample.subarray(0, 8192))) {
          blocked.push({
            path: file.path,
            name: file.originalname || file.filename || 'unknown',
            reason: 'text-like extension but binary content',
          });
        }
      } catch (error) {
        blocked.push({
          path: file.path,
          name: file.originalname || file.filename || 'unknown',
          reason: error?.message || 'content validation failed',
        });
      }
    }
    return blocked;
  }

  const storage = multer.diskStorage({
    destination: function (req, _file, cb) {
      const fp = sanitizeFolderPath(req?.query?.folderPath ?? req?.body?.folderPath);
      const dir = fp ? path.join(uploadRoot, fp) : uploadRoot;
      ensureDirSync(dir);
      cb(null, dir);
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
      validateUploadedFilesByMagicBytes(req.files || [])
        .then(async (blockedByContent) => {
          if (!blockedByContent.length) return next();
          for (const blocked of blockedByContent) {
            try {
              await fs.promises.unlink(blocked.path);
            } catch (_) {}
          }
          const details = blockedByContent.map((f) => `${f.name} (${f.reason})`).join(', ');
          return res.status(400).json({ error: `Blocked file content: ${details}` });
        })
        .catch(() => res.status(500).json({ error: 'Upload validation failed' }));
    });

  // ---- Lists (files namespace) ----
  const { body } = require('express-validator');
  const listsRouter = express.Router();
  listsRouter.get('/', gate, (req, res) => controller.getLists(req, res));
  listsRouter.post('/',
    gate,
    csrfProtection,
    commonRules.string('name', 1, 255),
    validateRequest,
    (req, res) => controller.createList(req, res)
  );
  listsRouter.get('/:id/files', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getListFiles(req, res)
  );
  listsRouter.post('/:id/files',
    gate,
    csrfProtection,
    commonRules.id('id'),
    [body('fileIds').isArray().withMessage('fileIds must be an array')],
    validateRequest,
    (req, res) => controller.addFilesToList(req, res)
  );
  listsRouter.delete('/:id/files/:fileId',
    gate,
    csrfProtection,
    commonRules.id('id'),
    [commonRules.id('fileId')],
    validateRequest,
    (req, res) => controller.removeFileFromList(req, res)
  );
  listsRouter.put('/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.string('name', 1, 255),
    validateRequest,
    (req, res) => controller.renameList(req, res)
  );
  listsRouter.delete('/:id', gate, csrfProtection, commonRules.id('id'), validateRequest, (req, res) =>
    controller.deleteList(req, res)
  );
  router.use('/lists', listsRouter);

  // ---- CRUD (metadata) ----
  router.get('/', gate, (req, res) => controller.getAll(req, res));

  router.post('/',
    gate,
    csrfProtection,
    commonRules.string('name', 1, 255),
    commonRules.optionalString('url', 500),
    validateRequest,
    (req, res) => controller.create(req, res)
  );

  router.put('/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.string('name', 1, 255).optional(),
    commonRules.optionalString('url', 500),
    validateRequest,
    (req, res) => controller.update(req, res)
  );

  // DELETE /api/files/batch - Bulk delete (MUST be before '/:id' route)
  router.delete('/batch',
    gate,
    csrfProtection,
    [
      commonRules.array('ids', 500).optional(),
      commonRules.array('folderPaths', 200).optional(),
    ],
    validateRequest,
    (req, res) => controller.bulkDelete(req, res)
  );

  router.delete('/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res) => controller.delete(req, res)
  );

  // ---- MULTIPART upload: returns array of created FileItems ----
  router.post('/upload',
    gate,
    uploadLimiter,
    csrfProtection,
    runUpload,
    (req, res) => controller.upload(req, res, { uploadRoot })
  );

  // ---- RAW file serving (supports folders: /raw/Mapp A/file.pdf or /raw/file.pdf) ----
  router.get(/^\/raw\/(.+)$/, gate, (req, res) => {
    req.params.path = req.params[0];
    controller.raw(req, res, { uploadRoot });
  });

  // ---- Folders ----
  router.get('/folders', gate, (req, res) => controller.getFolders(req, res));
  router.post('/folders',
    gate,
    csrfProtection,
    [body('path').optional(), body('name').optional()],
    validateRequest,
    (req, res) => controller.createFolder(req, res)
  );

  // ---- Move file to folder ----
  router.post('/:id/move',
    gate,
    csrfProtection,
    commonRules.id('id'),
    [body('folderPath').optional({ values: 'null' })],
    validateRequest,
    (req, res) => controller.move(req, res)
  );

  // ---- Cloud Storage Integration ----
  const CloudStorageModel = require('./cloudStorageModel');
  const CloudStorageController = require('./cloudStorageController');
  const cloudStorageModel = new CloudStorageModel();
  const cloudStorageController = new CloudStorageController(cloudStorageModel);

  // GET /api/files/cloud/:service/settings
  router.get('/cloud/:service/settings', gate, (req, res) =>
    cloudStorageController.getSettings(req, res)
  );

  // GET /api/files/cloud/:service/auth/start - Start OAuth flow
  router.get('/cloud/:service/auth/start', gate, (req, res) =>
    cloudStorageController.startAuth(req, res)
  );

  // GET /api/files/cloud/:service/auth/callback - OAuth callback
  // Note: We check session in controller, but don't use gate here since OAuth provider redirects here
  router.get('/cloud/:service/auth/callback', (req, res) =>
    cloudStorageController.handleCallback(req, res)
  );

  // POST /api/files/cloud/:service/disconnect
  router.post('/cloud/:service/disconnect',
    gate,
    csrfProtection,
    (req, res) => cloudStorageController.disconnect(req, res)
  );

  // POST /api/files/cloud/:service/credentials - Save OAuth app credentials (per-user)
  router.post('/cloud/:service/credentials',
    gate,
    csrfProtection,
    commonRules.string('clientId', 1, 500),
    commonRules.string('clientSecret', 1, 500),
    validateRequest,
    (req, res) => cloudStorageController.saveOAuthCredentials(req, res)
  );
  // GET /api/files/cloud/:service/embed - Get embed URL for file manager
  router.get('/cloud/:service/embed', gate, (req, res) =>
    cloudStorageController.getEmbedUrl(req, res)
  );

  return router;
}

module.exports = createFilesRoutes;
