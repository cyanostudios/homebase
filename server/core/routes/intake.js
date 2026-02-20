// server/core/routes/intake.js
// CF7 webhook intake: inspection request with files.
// POST /api/intake/inspection-request - public endpoint, validated by x-webhook-secret or body.webhook_secret

const express = require('express');
const { Logger } = require('@homebase/core');
const { buildFileUrl } = require('../../../plugins/files/pathUtils');
const {
  buildIntakeReq,
  ensureFolderByName,
  createFileRecord,
  createInspectionProject,
  attachFiles,
  UPLOAD_ROOT,
} = require('../services/intakeInspectionService');
const { fetchFile } = require('../services/wordpressFileFetcher');

const router = express.Router();

// --- Payload contract (CF7 to Webhook JSON) ---
// Required: beteckning (string) - fastighetsbeteckning
// Optional: your-name, your-email, your-company, your-subject, your-message, typ (strings)
// Optional: bilaga-1..bilaga-6, bilaga (file URLs) or files (legacy)
// Auth: x-webhook-secret header

function getFirstString(v) {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (Array.isArray(v) && v.length > 0) {
    const first = v[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
  }
  return null;
}

function safeName(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function addUrl(arr, v) {
  if (v && typeof v === 'string' && v.trim()) arr.push(v.trim());
  if (Array.isArray(v)) v.forEach((u) => addUrl(arr, u));
}

function normalizeFileUrls(body) {
  const urls = [];
  const fileKeys = ['bilaga-1', 'bilaga-2', 'bilaga-3', 'bilaga-4', 'bilaga-5', 'bilaga-6', 'bilaga_1', 'bilaga_2', 'bilaga_3', 'bilaga_4', 'bilaga_5', 'bilaga_6', 'bilaga'];
  for (const k of fileKeys) {
    const v = body?.[k];
    if (v) addUrl(urls, v);
  }
  if (urls.length) return urls;
  const f = body?.files;
  if (!f) return [];
  if (Array.isArray(f)) return f.filter((u) => typeof u === 'string' && u.trim()).map((u) => u.trim());
  if (typeof f === 'string' && f.trim()) return [f.trim()];
  if (typeof f === 'object') return Object.values(f).filter((u) => typeof u === 'string' && u.trim()).map((u) => u.trim());
  return [];
}

function generateTraceId() {
  return `intake-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

router.post('/inspection-request', async (req, res) => {
  const traceId = generateTraceId();
  try {
    const secret = req.header('x-webhook-secret');
    const expected = process.env.CF7_WEBHOOK_SECRET;
    if (!expected || !secret || secret.trim() !== expected) {
      Logger.warn('Intake inspection-request: invalid or missing secret', { traceId });
      return res.status(401).json({ ok: false });
    }

    const fastighetsbeteckningRaw =
      getFirstString(req.body?.beteckning) || getFirstString(req.body?.fastighetsbeteckning);
    if (!fastighetsbeteckningRaw) {
      return res.status(400).json({
        ok: false,
        error: 'beteckning (fastighetsbeteckning) missing',
        traceId,
      });
    }

    const fastighetsbeteckning = safeName(fastighetsbeteckningRaw);
    const folderPath = fastighetsbeteckning || 'Intake';
    const fileUrls = normalizeFileUrls(req.body);

    const reqLike = await buildIntakeReq();
    const folder = ensureFolderByName(folderPath);
    const destFolder = require('path').join(UPLOAD_ROOT, folder.path || '');

    const fileIds = [];
    const skippedFiles = [];

    for (const url of fileUrls) {
      try {
        const downloaded = await fetchFile(url, destFolder);
        const urlPath = buildFileUrl(folder.path, downloaded.filename);
        const item = await createFileRecord(reqLike, {
          name: downloaded.displayName || downloaded.filename,
          size: downloaded.size,
          mimeType: downloaded.mime,
          url: urlPath,
          folderPath: folder.path,
        });
        fileIds.push(String(item.id));
      } catch (err) {
        Logger.warn('Intake: failed to fetch/save file', { traceId, url: url?.slice(0, 80), error: err.message });
        skippedFiles.push({ url: url?.slice(0, 100), error: err.message });
      }
    }

    const namn = getFirstString(req.body?.['your-name']) || getFirstString(req.body?.namn) || '';
    const email = getFirstString(req.body?.['your-email']) || getFirstString(req.body?.email) || '';
    const foretag = getFirstString(req.body?.['your-company']) || '';
    const amne = getFirstString(req.body?.['your-subject']) || '';
    const message = getFirstString(req.body?.['your-message']) || getFirstString(req.body?.message) || '';
    const typRaw = getFirstString(req.body?.typ);
    const typ = Array.isArray(req.body?.typ) ? req.body.typ.join(', ') : typRaw || '';
    const adminParts = [
      namn && `Kontakt: ${namn}`,
      email && `E-post: ${email}`,
      foretag && `Företag: ${foretag}`,
      amne && `Ämne: ${amne}`,
      typ && `Typ: ${typ}`,
      message && `Meddelande:\n${message}`,
    ].filter(Boolean);

    const project = await createInspectionProject(reqLike, {
      name: fastighetsbeteckning || 'Besiktningsförfrågan',
      description: '',
      adminNotes: adminParts.join('\n'),
    });

    if (fileIds.length > 0) {
      await attachFiles(reqLike, project.id, fileIds);
    }

    Logger.info('Intake inspection-request success', {
      traceId,
      projectId: project.id,
      folderPath: folder.path,
      filesImported: fileIds.length,
      skipped: skippedFiles.length,
    });

    return res.json({
      ok: true,
      projectId: project.id,
      folderPath: folder.path,
      filesImported: fileIds.length,
      skippedFiles: skippedFiles.length,
      traceId,
    });
  } catch (err) {
    Logger.error('Intake inspection-request failed', err, { traceId });
    return res.status(500).json({
      ok: false,
      error: err.message || 'Internal error',
      traceId,
    });
  }
});

module.exports = router;
