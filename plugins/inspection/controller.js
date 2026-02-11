// plugins/inspection/controller.js
const path = require('path');
const fs = require('fs');
const { Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const model = require('./model');
const ContactsModel = require('../contacts/model');
const FilesModel = require('../files/model');
const { sendWithUserSettings } = require('../mail/sendService');
const mailModel = require('../mail/model');

const contactsModel = new ContactsModel();
const filesModel = new FilesModel();
const UPLOAD_ROOT = path.join(process.cwd(), 'server', 'uploads', 'files');

function isEmail(str) {
  if (typeof str !== 'string' || !str.trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}

async function resolveRecipients(req, recipients) {
  const emails = [];
  for (const r of recipients) {
    const s = String(r).trim();
    if (!s) continue;
    if (isEmail(s)) {
      emails.push(s);
    } else {
      const contact = await contactsModel.getAll(req);
      const c = contact.find((x) => String(x.id) === s);
      if (c?.email) emails.push(c.email);
    }
  }
  return [...new Set(emails)];
}

async function loadFileBuffers(req, fileIds) {
  const buffers = [];
  for (const fileId of fileIds) {
    const file = await filesModel.getById(req, fileId);
    if (!file || !file.url) continue;
    if (file.url.startsWith('/api/files/raw/')) {
      const filename = path.basename(file.url.replace('/api/files/raw/', ''));
      const abs = path.join(UPLOAD_ROOT, filename);
      if (fs.existsSync(abs)) {
        const content = fs.readFileSync(abs);
        buffers.push({ filename: file.name || filename, content });
      }
    }
  }
  return buffers;
}

class InspectionController {
  async getAll(req, res) {
    try {
      const items = await model.getAll(req);
      res.json(items);
    } catch (error) {
      Logger.error('Get inspection projects failed', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch inspection projects' });
    }
  }

  async getById(req, res) {
    try {
      const item = await model.getById(req, req.params.id);
      if (!item) return res.status(404).json({ error: 'Project not found' });
      res.json(item);
    } catch (error) {
      Logger.error('Get inspection project failed', error, { projectId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch inspection project' });
    }
  }

  async create(req, res) {
    try {
      const item = await model.create(req, req.body);
      res.status(201).json(item);
    } catch (error) {
      Logger.error('Create inspection project failed', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to create inspection project' });
    }
  }

  async update(req, res) {
    try {
      const item = await model.update(req, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      Logger.error('Update inspection project failed', error, { projectId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to update inspection project' });
    }
  }

  async delete(req, res) {
    try {
      await model.delete(req, req.params.id);
      res.status(204).send();
    } catch (error) {
      Logger.error('Delete inspection project failed', error, { projectId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to delete inspection project' });
    }
  }

  /** POST /api/inspection/projects/batch-delete – bulk delete inspection projects only. Isolated from orders and other plugins. */
  async bulkDeleteInspectionProjects(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res.status(400).json({ error: 'ids must be an array', code: 'VALIDATION_ERROR' });
      }
      const result = await model.bulkDelete(req, idsRaw);
      return res.json({ ok: true, ...result });
    } catch (error) {
      Logger.error('Bulk delete inspection projects failed', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      return res.status(500).json({ error: 'Failed to delete selected inspection projects' });
    }
  }

  async addFiles(req, res) {
    try {
      const { fileIds } = req.body;
      if (!Array.isArray(fileIds)) {
        return res.status(400).json({ error: 'fileIds array is required' });
      }
      const item = await model.addFiles(req, req.params.id, fileIds);
      res.json(item);
    } catch (error) {
      Logger.error('Add files to project failed', error, { projectId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to add files' });
    }
  }

  async setFiles(req, res) {
    try {
      const { fileIds } = req.body;
      if (!Array.isArray(fileIds)) {
        return res.status(400).json({ error: 'fileIds array is required' });
      }
      const item = await model.setFiles(req, req.params.id, fileIds);
      res.json(item);
    } catch (error) {
      Logger.error('Set files for project failed', error, { projectId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to set files' });
    }
  }

  async removeFile(req, res) {
    try {
      const item = await model.removeFile(req, req.params.id, req.params.fileId);
      res.json(item);
    } catch (error) {
      Logger.error('Remove file from project failed', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to remove file' });
    }
  }

  async addFileList(req, res) {
    try {
      const { listId } = req.body;
      if (!listId) return res.status(400).json({ error: 'listId is required' });
      const item = await model.addFileList(req, req.params.id, String(listId).trim());
      res.status(201).json(item);
    } catch (error) {
      Logger.error('Add file list to project failed', error, { projectId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to add list' });
    }
  }

  async removeFileList(req, res) {
    try {
      const item = await model.removeFileList(req, req.params.id, req.params.fileListId);
      res.json(item);
    } catch (error) {
      Logger.error('Remove file list from project failed', error);
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to remove list' });
    }
  }

  async send(req, res) {
    try {
      const { recipients, includeDescription, includeAdminNotes, fileIds, listIds } = req.body;
      const projectId = req.params.id;

      if (!recipients || (Array.isArray(recipients) && recipients.length === 0)) {
        return res.status(400).json({ error: 'At least one recipient is required' });
      }

      const project = await model.getById(req, projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const emailList = await resolveRecipients(req, Array.isArray(recipients) ? recipients : [recipients]);
      if (emailList.length === 0) {
        return res.status(400).json({ error: 'No valid email addresses found for recipients' });
      }

      const parts = [];
      if (includeDescription !== false && project.description) {
        parts.push(project.description);
      }
      if (includeAdminNotes !== false && project.adminNotes) {
        parts.push('\n--- Admin notes ---\n' + project.adminNotes);
      }
      const bodyText = parts.join('\n\n') || 'No content.';

      let idsToAttach = [];
      if (Array.isArray(fileIds) && fileIds.length > 0) {
        idsToAttach = fileIds.map((id) => String(id));
      }
      if (Array.isArray(listIds) && listIds.length > 0 && project.fileLists) {
        for (const fl of project.fileLists) {
          if (listIds.includes(fl.id) && Array.isArray(fl.fileIds)) {
            idsToAttach.push(...fl.fileIds.map((id) => String(id)));
          }
        }
      }
      if (idsToAttach.length === 0) {
        idsToAttach = (project.files || []).map((f) => f.id);
      } else {
        idsToAttach = [...new Set(idsToAttach)];
      }
      const attachments = await loadFileBuffers(req, idsToAttach);

      const logEntry = await sendWithUserSettings(
        req,
        {
          bcc: emailList,
          subject: `Besiktning: ${project.name}`,
          html: bodyText.replace(/\n/g, '<br>'),
          text: bodyText,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
        {
          pluginSource: 'inspection',
          referenceId: projectId,
          metadata: { fileCount: idsToAttach.length },
        },
      );

      res.json({ ok: true, message: 'Email sent successfully', logEntry });
    } catch (error) {
      Logger.error('Send inspection email failed', error, { projectId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      let msg = 'Kunde inte skicka e-post';
      if (error?.code === 'EAUTH' || /535|Incorrect authentication/i.test(error?.message || '')) {
        msg = 'Felaktiga SMTP-inloggningsuppgifter. Kontrollera Mail-inställningar. För Gmail: använd app-lösenord.';
      } else if (error?.code === 'EENVELOPE' || /530|Authentication Required/i.test(error?.message || '')) {
        msg = 'Gmail kräver inloggning. Konfigurera Resend eller SMTP i Mail-inställningar.';
      } else if (error?.message) {
        msg = error.message;
      }
      res.status(500).json({ error: msg });
    }
  }

  async getSendHistory(req, res) {
    try {
      const projectId = req.params.id;
      const project = await model.getById(req, projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const history = await mailModel.getHistory(req, {
        pluginSource: 'inspection',
        referenceId: projectId,
        limit: 50,
      });
      res.json(history);
    } catch (error) {
      Logger.error('Get inspection send history failed', error, { projectId: req.params.id });
      if (error instanceof AppError) return res.status(error.statusCode).json(error.toJSON());
      res.status(500).json({ error: 'Failed to fetch send history' });
    }
  }
}

module.exports = new InspectionController();
