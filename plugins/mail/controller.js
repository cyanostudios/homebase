// plugins/mail/controller.js
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const model = require('./model');
const { getEmailServiceForUser } = require('./sendService');
const SmtpAdapter = require('../../server/core/services/email/adapters/SmtpAdapter');
const ResendAdapter = require('../../server/core/services/email/adapters/ResendAdapter');

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

      const emailService = await getEmailServiceForUser(req);
      await emailService.send({
        to: normalizedRecipients,
        subject: String(subject).trim(),
        html: html ? String(html) : undefined,
        text: text ? String(text) : undefined,
        attachments: attachmentBuffers.length > 0 ? attachmentBuffers : undefined,
      });

      const logEntry = await model.logSent(req, {
        to: normalizedRecipients,
        subject: String(subject).trim(),
        pluginSource: pluginSource || null,
        referenceId: referenceId || null,
      });

      res.json({ ok: true, message: 'Email sent successfully', logEntry });
    } catch (error) {
      Logger.error('Send mail failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      let msg = 'Failed to send email';
      if (error?.code === 'EAUTH' || /535|Incorrect authentication/i.test(error?.message || '')) {
        msg =
          'Felaktiga SMTP-inloggningsuppgifter. Kontrollera användarnamn och lösenord i Mail-inställningar. För Gmail: använd app-lösenord.';
      } else if (
        error?.code === 'EENVELOPE' ||
        /530|Authentication Required/i.test(error?.message || '')
      ) {
        msg =
          'Gmail kräver inloggning. Fyll i användarnamn och app-lösenord i Mail-inställningar, eller byt till Resend.';
      } else if (error?.message) {
        msg = error.message;
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

  async getSettings(req, res) {
    try {
      const settings = await model.getSettings(req);
      if (settings) {
        const smtpConfigured = !!(settings.host && (settings.authUser || settings.hasPassword));
        const resendConfigured = !!settings.hasResendApiKey;
        return res.json({
          provider: settings.provider,
          configured: {
            smtp: smtpConfigured,
            resend: resendConfigured,
          },
          smtp: {
            host: settings.host,
            port: settings.port,
            secure: settings.secure,
            authUser: settings.authUser,
            fromAddress: settings.fromAddress,
            hasPassword: settings.hasPassword,
          },
          resend: {
            hasApiKey: settings.hasResendApiKey,
            fromAddress: settings.resendFromAddress || '',
          },
        });
      }
      res.json({
        provider: 'smtp',
        configured: { smtp: false, resend: false },
        smtp: null,
        resend: null,
      });
    } catch (error) {
      Logger.error('Get mail settings failed', error);
      res.status(500).json({ error: 'Failed to get mail settings' });
    }
  }

  async testSettings(req, res) {
    try {
      const {
        testTo,
        provider,
        host,
        port,
        secure,
        authUser,
        authPass,
        fromAddress,
        resendApiKey,
        resendFromAddress,
        useSaved,
      } = req.body;

      const to = testTo ? String(testTo).trim() : '';
      if (!to || !to.includes('@')) {
        return res
          .status(400)
          .json({ error: 'Ange en giltig e-postadress att skicka testmail till' });
      }

      const requestedProvider = (provider || 'smtp') === 'resend' ? 'resend' : 'smtp';
      let emailService;
      if (useSaved) {
        const userSettings = await model.getSettings(req, { needsPassword: true });
        if (!userSettings) {
          return res
            .status(400)
            .json({ error: 'Inga sparade inställningar. Spara först eller fyll i formuläret.' });
        }
        // Only use saved when it matches the tab (requestedProvider) – avoids SMTP when user is on Resend tab
        if (
          userSettings.provider === 'resend' &&
          userSettings.resendApiKeyRaw &&
          requestedProvider === 'resend'
        ) {
          emailService = new ResendAdapter({
            resend: {
              apiKey: userSettings.resendApiKeyRaw,
              from: userSettings.resendFromAddress || 'onboarding@resend.dev',
            },
          });
        } else if (
          userSettings.provider === 'smtp' &&
          userSettings.host &&
          requestedProvider === 'smtp'
        ) {
          emailService = new SmtpAdapter({
            smtp: {
              host: userSettings.host,
              port: userSettings.port,
              secure: userSettings.secure,
              from: userSettings.fromAddress,
              auth:
                userSettings.authUser && userSettings.authPass
                  ? { user: userSettings.authUser, pass: userSettings.authPass }
                  : undefined,
            },
          });
        } else {
          return res.status(400).json({ error: 'Inga sparade inställningar. Spara först.' });
        }
      } else if ((provider || 'smtp') === 'resend') {
        const key = resendApiKey ? String(resendApiKey).trim() : '';
        if (!key || key.startsWith('••••')) {
          return res.status(400).json({ error: 'Ange Resend API-nyckel för att testa.' });
        }
        emailService = new ResendAdapter({
          resend: {
            apiKey: key,
            from:
              (resendFromAddress && String(resendFromAddress).trim()) || 'onboarding@resend.dev',
          },
        });
      }
      if (!emailService && requestedProvider === 'smtp') {
        const h = host ? String(host).trim() : 'smtp.gmail.com';
        const p = parseInt(String(port || '587'), 10) || 587;
        const sec = !!secure;
        const user = authUser ? String(authUser).trim() : '';
        const pass = authPass ? String(authPass).trim() : '';
        const from = fromAddress ? String(fromAddress).trim() : 'noreply@homebase.se';
        emailService = new SmtpAdapter({
          smtp: {
            host: h,
            port: p,
            secure: sec,
            from,
            auth: user && pass ? { user, pass } : undefined,
          },
        });
      }

      if (!emailService && requestedProvider === 'resend') {
        return res.status(400).json({
          error:
            'Ange Resend API-nyckel (re_...) i fältet ovan. Kontrollera att du är på Resend-fliken.',
        });
      }

      await emailService.send({
        to: [to],
        subject: 'Testmail från Homebase',
        text: 'Detta är ett testmail. Om du fick detta fungerar SMTP-inställningarna.',
        html: '<p>Detta är ett testmail. Om du fick detta fungerar SMTP-inställningarna.</p>',
      });

      res.json({ ok: true, message: 'Testmail skickat' });
    } catch (error) {
      Logger.error('Test mail failed', error, { userId: Context.getUserId(req) });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      let msg = 'Kunde inte skicka testmail';
      if (error?.code === 'EAUTH' || /535|Incorrect authentication/i.test(error?.message || '')) {
        msg =
          'Felaktiga inloggningsuppgifter. För Gmail: använd ett app-lösenord (myaccount.google.com/apppasswords) om du har tvåstegsverifiering.';
      } else if (
        error?.code === 'EENVELOPE' ||
        /530|Authentication Required/i.test(error?.message || '')
      ) {
        msg =
          'Gmail kräver inloggning. Fyll i användarnamn och app-lösenord, eller byt till Resend för enklare konfiguration.';
      } else if (error?.message) {
        msg = error.message;
      }
      res.status(500).json({ error: msg });
    }
  }

  async saveSettings(req, res) {
    try {
      const {
        provider,
        host,
        port,
        secure,
        authUser,
        authPass,
        fromAddress,
        resendApiKey,
        resendFromAddress,
      } = req.body;
      await model.saveSettings(req, {
        provider: provider ?? 'smtp',
        host: host ?? 'smtp.gmail.com',
        port: port ?? 587,
        secure: !!secure,
        authUser: authUser ?? '',
        authPass: authPass ?? '',
        fromAddress: fromAddress ?? 'noreply@homebase.se',
        resendApiKey: resendApiKey ?? '',
        resendFromAddress: resendFromAddress ?? '',
      });
      res.json({ ok: true });
    } catch (error) {
      Logger.error('Save mail settings failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to save mail settings' });
    }
  }
}

module.exports = new MailController();
