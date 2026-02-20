// client/src/core/ui/BulkEmailDialog.tsx
// Modal to compose and send email to a list of recipients

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mailApi } from '@/plugins/mail/api/mailApi';

import { Heading } from './Typography';

export interface BulkEmailRecipient {
  id: string;
  name: string;
  email: string;
}

export interface BulkEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: BulkEmailRecipient[];
  pluginSource: string;
}

type SendPhase = 'idle' | 'sending' | 'done';

export function BulkEmailDialog({
  isOpen,
  onClose,
  recipients,
  pluginSource,
}: BulkEmailDialogProps) {
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [phase, setPhase] = useState<SendPhase>('idle');
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const withEmail = recipients.filter((r) => r.email && r.email.trim() && r.email.includes('@'));
  const withoutEmail = recipients.length - withEmail.length;

  const handleSend = useCallback(async () => {
    if (withEmail.length === 0) {
      return;
    }
    setPhase('sending');
    setErrorMessage(null);
    let sent = 0;
    let failed = 0;
    let firstError: string | null = null;

    for (const r of withEmail) {
      try {
        const res = await mailApi.send({
          to: [r.email.trim()],
          subject,
          text: body,
          html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
          pluginSource,
          referenceId: r.id,
        });
        if (res?.logEntry) {
          window.dispatchEvent(new CustomEvent('mailSent', { detail: res.logEntry }));
        }
        sent += 1;
      } catch (e: any) {
        failed += 1;
        if (!firstError) {
          firstError = e?.message || 'Failed to send email';
        }
        const status = e?.status;
        if (status === 400 || status === 401 || status === 403) {
          break;
        }
      }
      setSentCount(sent);
      setFailedCount(failed);
    }
    if (firstError) {
      setErrorMessage(firstError);
    }
    setPhase('done');
  }, [subject, body, withEmail, pluginSource]);

  const handleClose = useCallback(() => {
    setSubject('');
    setBody('');
    setPhase('idle');
    setSentCount(0);
    setFailedCount(0);
    setErrorMessage(null);
    onClose();
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={phase === 'sending' ? undefined : handleClose}
        aria-hidden="true"
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-lg max-h-[90vh] flex flex-col">
        <div className="bg-background rounded-xl shadow-xl border overflow-hidden flex flex-col max-h-full">
          <div className="p-4 border-b shrink-0">
            <Heading level={3} className="mb-0">
              {t('bulk.sendEmailTitle')}
            </Heading>
            <div className="text-xs text-muted-foreground mt-1">
              {t('bulk.sendEmailRecipients', {
                total: recipients.length,
                withEmail: withEmail.length,
              })}
              {withoutEmail > 0 && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400">
                  {t('bulk.sendEmailNoEmail', { count: withoutEmail })}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 flex flex-col gap-3 min-h-0 overflow-auto">
            {phase === 'idle' && (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground">
                    {t('bulk.sendEmailSubjectLabel')}
                  </label>
                  <Input
                    className="mt-1"
                    placeholder={t('bulk.sendEmailSubjectPlaceholder')}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={withEmail.length === 0}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">
                    {t('bulk.sendEmailBodyLabel')}
                  </label>
                  <textarea
                    className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder={t('bulk.sendEmailBodyPlaceholder')}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={withEmail.length === 0}
                  />
                </div>
              </>
            )}
            {phase === 'sending' && (
              <p className="text-sm text-muted-foreground">
                {t('bulk.sendEmailSending', {
                  sent: sentCount,
                  total: withEmail.length,
                })}
              </p>
            )}
            {phase === 'done' && (
              <div className="text-sm space-y-1">
                <p className="text-foreground font-medium">{t('bulk.sendEmailDone')}</p>
                <p className="text-muted-foreground">
                  {t('bulk.sendEmailResult', { sent: sentCount, failed: failedCount })}
                </p>
                {errorMessage && <p className="text-destructive">{errorMessage}</p>}
              </div>
            )}
          </div>

          <div className="p-4 border-t flex items-center justify-end gap-2 shrink-0">
            {phase === 'done' ? (
              <Button variant="secondary" size="sm" onClick={handleClose}>
                {t('common.close')}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  disabled={phase === 'sending'}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={
                    phase === 'sending' || withEmail.length === 0 || !subject.trim() || !body.trim()
                  }
                >
                  {phase === 'sending' ? t('bulk.sendEmailSendingShort') : t('bulk.sendEmailSend')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
