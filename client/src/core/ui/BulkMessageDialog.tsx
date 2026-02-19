// client/src/core/ui/BulkMessageDialog.tsx
// Modal to compose and send bulk SMS to a list of recipients (from slots or contacts)

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { pulseApi } from '@/plugins/pulses/api/pulseApi';

import { Heading } from './Typography';

export interface BulkMessageRecipient {
  id: string;
  name: string;
  phone: string;
}

export interface BulkMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: BulkMessageRecipient[];
  pluginSource: string;
}

type SendPhase = 'idle' | 'sending' | 'done';

export function BulkMessageDialog({
  isOpen,
  onClose,
  recipients,
  pluginSource,
}: BulkMessageDialogProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [phase, setPhase] = useState<SendPhase>('idle');
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const withPhone = recipients.filter((r) => r.phone && r.phone.trim());
  const withoutPhone = recipients.length - withPhone.length;

  const handleSend = useCallback(async () => {
    if (withPhone.length === 0) return;
    setPhase('sending');
    let sent = 0;
    let failed = 0;
    for (const r of withPhone) {
      try {
        await pulseApi.send({
          to: r.phone.trim(),
          body,
          pluginSource,
          referenceId: r.id,
        });
        sent += 1;
      } catch {
        failed += 1;
      }
      setSentCount(sent);
      setFailedCount(failed);
    }
    setPhase('done');
  }, [body, withPhone, pluginSource]);

  const handleClose = useCallback(() => {
    setBody('');
    setPhase('idle');
    setSentCount(0);
    setFailedCount(0);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

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
              {t('bulk.sendMessageTitle')}
            </Heading>
            <div className="text-xs text-muted-foreground mt-1">
              {t('bulk.sendMessageRecipients', {
                total: recipients.length,
                withPhone: withPhone.length,
              })}
              {withoutPhone > 0 && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400">
                  {t('bulk.sendMessageNoPhone', { count: withoutPhone })}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 flex flex-col gap-3 min-h-0 overflow-auto">
            {phase === 'idle' && (
              <>
                <label className="text-sm font-medium text-foreground">
                  {t('bulk.sendMessageBodyLabel')}
                </label>
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder={t('bulk.sendMessageBodyPlaceholder')}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={withPhone.length === 0}
                />
              </>
            )}
            {phase === 'sending' && (
              <p className="text-sm text-muted-foreground">
                {t('bulk.sendMessageSending', {
                  sent: sentCount,
                  total: withPhone.length,
                })}
              </p>
            )}
            {phase === 'done' && (
              <div className="text-sm space-y-1">
                <p className="text-foreground font-medium">{t('bulk.sendMessageDone')}</p>
                <p className="text-muted-foreground">
                  {t('bulk.sendMessageResult', { sent: sentCount, failed: failedCount })}
                </p>
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
                <Button variant="outline" size="sm" onClick={handleClose} disabled={phase === 'sending'}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={phase === 'sending' || withPhone.length === 0 || !body.trim()}
                >
                  {phase === 'sending'
                    ? t('bulk.sendMessageSendingShort')
                    : t('bulk.sendMessageSend')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
