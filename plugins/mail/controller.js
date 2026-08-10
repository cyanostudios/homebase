// plugins/mail/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const model = require('./model');
const providerModel = require('./providerModel');
const { MASKED_SECRET, normalizeProviderKey, GLOBAL_ROUTING_SCOPE } = require('./providerModel');
const { normalizeRoutablePluginKey } = require('./routablePlugins');
const { sendWithUserSettings } = require('./sendService');
const EmailAdapterRegistry = require('./EmailAdapterRegistry');
const { isEmailCapable, getProviderCatalogEntry } = require('./providerCatalog');

class MailController {
  async send(req, res) {
    try {
      const { to, subject, html, text, attachments, pluginSource, referenceId } = req.body;

      if (
        !to ||
        (Array.isArray(to) && to.length === 0) ||
        (!Array.isArray(to) && !String(to).trim())
      ) {
        return res.status(400).json({ error: 'At least one recipient (to) is required' });
      }
      if (!subject || !String(subject).trim()) {
        return res.status(400).json({ error: 'Subject is required' });
      }

      const recipients = Array.isArray(to) ? to : [String(to).trim()];
      const normalizedRecipients = recipients.map((r) => String(r).trim()).filter(Boolean);
      if (normalizedRecipients.length === 0) {
        return res.status(400).json({ error: 'At least one valid recipient is required' });
      }

      let attachmentBuffers = [];
      if (Array.isArray(attachments) && attachments.length > 0) {
        for (const a of attachments) {
          if (a.filename && a.content) {
            const buffer = Buffer.isBuffer(a.content)
              ? a.content
              : Buffer.from(String(a.content), 'base64');
            attachmentBuffers.push({ filename: a.filename, content: buffer });
          }
        }
      }

      const logEntry = await sendWithUserSettings(
        req,
        {
          to: normalizedRecipients,
          subject: String(subject).trim(),
          html: html ? String(html) : undefined,
          text: text ? String(text) : undefined,
          attachments: attachmentBuffers.length > 0 ? attachmentBuffers : undefined,
        },
        { pluginSource: pluginSource || null, referenceId: referenceId || null },
      );

      res.json({ ok: true, message: 'Email sent successfully', logEntry });
    } catch (error) {
      Logger.error('Send mail failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      let msg = 'Failed to send email';
      if (error?.code === 'EAUTH' || /535|Incorrect authentication/i.test(error?.message || '')) {
        msg =
          'Invalid SMTP credentials. Check username and password in Mail providers. For Gmail, use an app password.';
      } else if (
        error?.code === 'EENVELOPE' ||
        /530|Authentication Required/i.test(error?.message || '')
      ) {
        msg =
          'SMTP authentication required. Enter username and app password in Mail providers, or switch to Resend.';
      }
      res.status(500).json({ error: msg });
    }
  }

  async getHistory(req, res) {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;
      const pluginSource = req.query.pluginSource || undefined;

      const [items, total] = await Promise.all([
        model.getHistory(req, { limit, offset, pluginSource }),
        model.getHistoryCount(req, { pluginSource }),
      ]);

      res.json({ items, total });
    } catch (error) {
      Logger.error('Get mail history failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch mail history' });
    }
  }

  async getCatalog(req, res) {
    try {
      res.json({ providers: providerModel.listCatalog() });
    } catch (error) {
      Logger.error('Get Mail provider catalog failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch Mail provider catalog' });
    }
  }

  async getProviderSettings(req, res) {
    try {
      const providers = await providerModel.listConfiguredSettings(req);
      res.json({ providers });
    } catch (error) {
      Logger.error('Get Mail provider settings failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      const msg = error?.message || '';
      if (msg.includes('relation') && msg.includes('does not exist')) {
        return res.status(500).json({
          error:
            'Mail provider tables are missing. Run migration 125-mail-provider-platform.sql on your tenant database.',
        });
      }
      res.status(500).json({ error: 'Failed to fetch Mail provider settings' });
    }
  }

  async saveProviderSettings(req, res) {
    try {
      const providerKey = normalizeProviderKey(req.params.providerKey);
      const provider = await providerModel.saveSettings(req, providerKey, req.body || {});
      res.json({ provider });
    } catch (error) {
      Logger.error('Save Mail provider settings failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to save Mail provider settings' });
    }
  }

  async deleteProviderSettings(req, res) {
    try {
      const providerKey = normalizeProviderKey(req.params.providerKey);
      const result = await providerModel.deleteSettings(req, providerKey);
      res.json(result);
    } catch (error) {
      Logger.error('Delete Mail provider settings failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to delete Mail provider settings' });
    }
  }

  async testProviderSettings(req, res) {
    try {
      const providerKey = normalizeProviderKey(req.params.providerKey);
      if (!isEmailCapable(providerKey)) {
        return res.status(400).json({
          error: 'Connection test is only available for email-capable providers (SMTP, Resend).',
        });
      }
      if (!EmailAdapterRegistry.has(providerKey)) {
        return res.status(400).json({ error: 'Email adapter not available for this provider' });
      }

      const testTo = String(req.body?.testTo || '').trim();
      if (!testTo || !testTo.includes('@')) {
        return res.status(400).json({ error: 'A valid email address is required to send a test' });
      }

      const useSaved = Boolean(req.body?.useSaved);
      const saved =
        useSaved ||
        String(req.body?.secretPrimary ?? '').startsWith(MASKED_SECRET) ||
        String(req.body?.secretSecondary ?? '').startsWith(MASKED_SECRET)
          ? await providerModel.getSettings(req, providerKey, { includeSecret: true })
          : null;

      let secretPrimary = '';
      let secretSecondary = '';
      let options = { ...(saved?.options || {}) };

      if (
        req.body?.secretPrimary != null &&
        !String(req.body.secretPrimary).startsWith(MASKED_SECRET)
      ) {
        secretPrimary = String(req.body.secretPrimary).trim();
      } else {
        secretPrimary = saved?.secretPrimaryRaw || '';
      }
      if (
        req.body?.secretSecondary != null &&
        !String(req.body.secretSecondary).startsWith(MASKED_SECRET)
      ) {
        secretSecondary = String(req.body.secretSecondary).trim();
      } else {
        secretSecondary = saved?.secretSecondaryRaw || '';
      }
      if (req.body?.options && typeof req.body.options === 'object') {
        options = { ...options, ...req.body.options };
      }
      if (req.body?.fields && typeof req.body.fields === 'object') {
        const entry = getProviderCatalogEntry(providerKey);
        for (const [key, value] of Object.entries(req.body.fields)) {
          if (value == null || String(value).startsWith(MASKED_SECRET)) continue;
          const field = (entry?.fields || []).find((f) => f.key === key);
          if (field?.storage === 'secret_primary') {
            secretPrimary = String(value).trim();
          } else if (field?.storage === 'secret_secondary') {
            secretSecondary = String(value).trim();
          } else {
            options[key] = String(value).trim();
          }
        }
      }

      if (providerKey === 'resend' && (!secretPrimary || !options.fromAddress)) {
        return res.status(400).json({
          error: 'Resend API key and From address are required to send a test email',
        });
      }
      if (providerKey === 'smtp' && (!options.host || !options.fromAddress)) {
        return res.status(400).json({
          error: 'SMTP host and From address are required to send a test email',
        });
      }

      const adapter = EmailAdapterRegistry.create(providerKey, {
        secretPrimary,
        secretSecondary,
        options,
      });
      await adapter.send({
        to: [testTo],
        subject: 'Test email from Homebase',
        text: 'This is a test email. If you received it, your mail settings work.',
        html: '<p>This is a test email. If you received it, your mail settings work.</p>',
      });
      res.json({ ok: true, provider: providerKey, status: 'sent' });
    } catch (error) {
      Logger.error('Test Mail provider failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      let msg = error?.message || 'Failed to send test email';
      if (error?.code === 'EAUTH' || /535|Incorrect authentication/i.test(error?.message || '')) {
        msg =
          'Invalid credentials. For Gmail, use an app password (myaccount.google.com/apppasswords) if you have 2FA enabled.';
      }
      res.status(500).json({ error: msg });
    }
  }

  async getRouting(req, res) {
    try {
      const routing = await providerModel.listRouting(req);
      res.json(routing);
    } catch (error) {
      Logger.error('Get Mail provider routing failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch Mail provider routing' });
    }
  }

  async saveGlobalRouting(req, res) {
    try {
      const result = await providerModel.saveRouting(req, GLOBAL_ROUTING_SCOPE, req.body || {});
      res.json(result);
    } catch (error) {
      Logger.error('Save global Mail routing failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to save global Mail routing' });
    }
  }

  async savePluginRouting(req, res) {
    try {
      const pluginKey = normalizeRoutablePluginKey(req.params.pluginKey);
      const result = await providerModel.saveRouting(req, pluginKey, req.body || {});
      res.json(result);
    } catch (error) {
      Logger.error('Save plugin Mail routing failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to save plugin Mail routing' });
    }
  }

  async deletePluginRouting(req, res) {
    try {
      const pluginKey = normalizeRoutablePluginKey(req.params.pluginKey);
      const result = await providerModel.deletePluginRouting(req, pluginKey);
      res.json(result);
    } catch (error) {
      Logger.error('Delete plugin Mail routing failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to delete plugin Mail routing' });
    }
  }

  async deleteHistory(req, res) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No IDs provided' });
      }
      const result = await model.deleteHistory(req, ids);
      res.json({ ok: true, deleted: result.deleted });
    } catch (error) {
      Logger.error('Delete mail history failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to delete mail history' });
    }
  }
}

module.exports = new MailController();
