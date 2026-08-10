// plugins/pulses/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const model = require('./model');
const providerModel = require('./providerModel');
const { MASKED_SECRET, normalizeProviderKey, GLOBAL_ROUTING_SCOPE } = require('./providerModel');
const { normalizeRoutablePluginKey } = require('./routablePlugins');
const { sendSmsWithUserSettings } = require('./sendService');
const SmsAdapterRegistry = require('./SmsAdapterRegistry');
const { isSmsNotificationCapable } = require('./providerCatalog');

class PulseController {
  async send(req, res) {
    try {
      const { to, body, pluginSource, referenceId } = req.body;
      const recipient = typeof to === 'string' ? to.trim() : '';
      if (!recipient) {
        return res.status(400).json({ error: 'Recipient (to) is required' });
      }
      const logEntry = await sendSmsWithUserSettings(
        req,
        { to: recipient, body: body != null ? String(body) : '' },
        { pluginSource: pluginSource || null, referenceId: referenceId || null },
      );
      res.json({ ok: true, message: 'SMS sent', logEntry });
    } catch (error) {
      Logger.error('Send pulse failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: error?.message || 'Failed to send SMS' });
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
      Logger.error('Get pulse history failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch pulse history' });
    }
  }

  async getCatalog(req, res) {
    try {
      res.json({ providers: providerModel.listCatalog() });
    } catch (error) {
      Logger.error('Get Pulse provider catalog failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch Pulse provider catalog' });
    }
  }

  async getProviderSettings(req, res) {
    try {
      const providers = await providerModel.listConfiguredSettings(req);
      res.json({ providers });
    } catch (error) {
      Logger.error('Get Pulse provider settings failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      const msg = error?.message || '';
      if (msg.includes('relation') && msg.includes('does not exist')) {
        return res.status(500).json({
          error:
            'Pulse provider tables are missing. Run migration 124-pulse-provider-platform.sql on your tenant database.',
        });
      }
      res.status(500).json({ error: 'Failed to fetch Pulse provider settings' });
    }
  }

  async saveProviderSettings(req, res) {
    try {
      const providerKey = normalizeProviderKey(req.params.providerKey);
      const provider = await providerModel.saveSettings(req, providerKey, req.body || {});
      res.json({ provider });
    } catch (error) {
      Logger.error('Save Pulse provider settings failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to save Pulse provider settings' });
    }
  }

  async deleteProviderSettings(req, res) {
    try {
      const providerKey = normalizeProviderKey(req.params.providerKey);
      const result = await providerModel.deleteSettings(req, providerKey);
      res.json(result);
    } catch (error) {
      Logger.error('Delete Pulse provider settings failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to delete Pulse provider settings' });
    }
  }

  async testProviderSettings(req, res) {
    try {
      const providerKey = normalizeProviderKey(req.params.providerKey);
      if (!isSmsNotificationCapable(providerKey)) {
        return res.status(400).json({
          error:
            'Connection test via SMS is only available for SMS notification providers (Twilio, Mock).',
        });
      }
      if (!SmsAdapterRegistry.has(providerKey)) {
        return res.status(400).json({ error: 'SMS adapter not available for this provider' });
      }

      const testTo = String(req.body?.testTo || '').trim();
      if (!testTo) {
        return res.status(400).json({ error: 'A phone number is required to send a test SMS' });
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
      if (req.body?.fromNumber != null) {
        options.fromNumber = String(req.body.fromNumber).trim();
      }
      if (req.body?.fields && typeof req.body.fields === 'object') {
        for (const [key, value] of Object.entries(req.body.fields)) {
          if (key === 'accountSid' && value && !String(value).startsWith(MASKED_SECRET)) {
            secretPrimary = String(value).trim();
          } else if (key === 'authToken' && value && !String(value).startsWith(MASKED_SECRET)) {
            secretSecondary = String(value).trim();
          } else if (value != null && !String(value).startsWith(MASKED_SECRET)) {
            options[key] = String(value).trim();
          }
        }
      }

      if (providerKey !== 'mock' && (!secretPrimary || !secretSecondary || !options.fromNumber)) {
        return res.status(400).json({
          error: 'Account SID, Auth Token and From number are required to send a test SMS',
        });
      }

      const adapter = SmsAdapterRegistry.create(providerKey, {
        secretPrimary,
        secretSecondary,
        options,
      });
      const result = await adapter.send({
        to: testTo,
        body: 'Test SMS from Pulse. If you received this, your settings work.',
      });
      res.json({ ok: true, provider: providerKey, status: result.status || 'sent' });
    } catch (error) {
      Logger.error('Test Pulse provider failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: error?.message || 'Failed to send test SMS' });
    }
  }

  async getRouting(req, res) {
    try {
      const routing = await providerModel.listRouting(req);
      res.json(routing);
    } catch (error) {
      Logger.error('Get Pulse provider routing failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to fetch Pulse provider routing' });
    }
  }

  async saveGlobalRouting(req, res) {
    try {
      const result = await providerModel.saveRouting(req, GLOBAL_ROUTING_SCOPE, req.body || {});
      res.json(result);
    } catch (error) {
      Logger.error('Save global Pulse routing failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to save global Pulse routing' });
    }
  }

  async savePluginRouting(req, res) {
    try {
      const pluginKey = normalizeRoutablePluginKey(req.params.pluginKey);
      const result = await providerModel.saveRouting(req, pluginKey, req.body || {});
      res.json(result);
    } catch (error) {
      Logger.error('Save plugin Pulse routing failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to save plugin Pulse routing' });
    }
  }

  async deletePluginRouting(req, res) {
    try {
      const pluginKey = normalizeRoutablePluginKey(req.params.pluginKey);
      const result = await providerModel.deletePluginRouting(req, pluginKey);
      res.json(result);
    } catch (error) {
      Logger.error('Delete plugin Pulse routing failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to delete plugin Pulse routing' });
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
      Logger.error('Delete pulse history failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to delete pulse history' });
    }
  }
}

module.exports = new PulseController();
