// plugins/pulses/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const model = require('./model');
const { sendSmsWithUserSettings, getSmsAdapterForUser } = require('./sendService');

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

  async getSettings(req, res) {
    try {
      const settings = await model.getSettings(req);
      if (settings) {
        const twilioConfigured = !!(
          settings.hasTwilioAccountSid &&
          settings.hasTwilioAuthToken &&
          (settings.twilioFromNumber || '').trim()
        );
        return res.json({
          activeProvider: settings.activeProvider,
          configured: { twilio: twilioConfigured, mock: true },
          twilio: {
            hasAccountSid: settings.hasTwilioAccountSid,
            hasAuthToken: settings.hasTwilioAuthToken,
            fromNumber: settings.twilioFromNumber || '',
          },
        });
      }
      res.json({
        activeProvider: 'mock',
        configured: { twilio: false, mock: true },
        twilio: { hasAccountSid: false, hasAuthToken: false, fromNumber: '' },
      });
    } catch (error) {
      Logger.error('Get pulse settings failed', error);
      res.status(500).json({ error: 'Failed to get pulse settings' });
    }
  }

  async testSettings(req, res) {
    try {
      const {
        testTo,
        useSaved,
        activeProvider,
        twilioAccountSid,
        twilioAuthToken,
        twilioFromNumber,
      } = req.body;
      const to = testTo ? String(testTo).trim() : '';
      if (!to) {
        return res.status(400).json({ error: 'A phone number is required to send a test SMS' });
      }
      let adapter;
      let provider;
      const useTwilioFromBody =
        activeProvider !== 'mock' &&
        twilioAccountSid &&
        String(twilioAccountSid).trim() &&
        !String(twilioAccountSid).trim().startsWith('••••') &&
        twilioAuthToken &&
        String(twilioAuthToken).trim() &&
        twilioFromNumber &&
        String(twilioFromNumber).trim();

      if (useSaved || !useTwilioFromBody) {
        const pair = await getSmsAdapterForUser(req);
        adapter = pair.adapter;
        provider = pair.provider;
        if (activeProvider === 'twilio' && provider === 'mock') {
          return res.status(400).json({
            error:
              'Saved Twilio settings are incomplete. Enter Account SID, Auth Token and From number and save, then try again.',
          });
        }
      }
      if (!adapter) {
        const prov = activeProvider === 'mock' ? 'mock' : 'twilio';
        if (prov === 'mock') {
          const MockAdapter = require('./adapters/MockAdapter');
          adapter = new MockAdapter();
          provider = 'mock';
        } else {
          const sid = twilioAccountSid ? String(twilioAccountSid).trim() : '';
          const token = twilioAuthToken ? String(twilioAuthToken).trim() : '';
          const from = twilioFromNumber ? String(twilioFromNumber).trim() : '';
          if (!sid || !token || !from) {
            return res
              .status(400)
              .json({
                error: 'Account SID, Auth Token and From number are required to test Twilio',
              });
          }
          const TwilioAdapter = require('./adapters/TwilioAdapter');
          adapter = new TwilioAdapter({ accountSid: sid, authToken: token, fromNumber: from });
          provider = 'twilio';
        }
      }
      const result = await adapter.send({
        to,
        body: 'Test SMS from Pulse. If you received this, your settings work.',
      });
      res.json({ ok: true, message: 'Test SMS sent', status: result.status });
    } catch (error) {
      Logger.error('Test pulse failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: error?.message || 'Failed to send test SMS' });
    }
  }

  async saveSettings(req, res) {
    try {
      const { activeProvider, twilioAccountSid, twilioAuthToken, twilioFromNumber } = req.body;
      await model.saveSettings(req, {
        activeProvider: activeProvider === 'mock' ? 'mock' : 'twilio',
        twilioAccountSid: twilioAccountSid ?? '',
        twilioAuthToken: twilioAuthToken ?? '',
        twilioFromNumber: twilioFromNumber ?? '',
      });
      res.json({ ok: true });
    } catch (error) {
      Logger.error('Save pulse settings failed', error);
      if (error instanceof AppError) {
        const json = error.toJSON();
        if (error.details?.originalError) {
          json.details = { ...json.details, originalError: error.details.originalError };
        }
        return res.status(error.statusCode).json(json);
      }
      const msg = error?.message || '';
      if (msg.includes('relation') && msg.includes('does not exist')) {
        return res.status(500).json({
          error:
            'Pulse database tables are missing. Run migration 033-pulses-plugin.sql on your tenant database.',
        });
      }
      if (
        msg.includes('User context required') ||
        msg.includes('Unauthorized') ||
        msg.includes('Tenant pool not found')
      ) {
        return res.status(401).json({
          error: 'Session may have expired. Log out and log in again, then try saving.',
        });
      }
      res.status(500).json({ error: msg || 'Failed to save pulse settings' });
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
