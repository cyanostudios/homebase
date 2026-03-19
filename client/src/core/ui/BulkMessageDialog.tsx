// client/src/core/ui/BulkMessageDialog.tsx
// Modal to compose and send bulk SMS to a list of recipients (from slots or contacts)

import { ListChecks, XCircle } from 'lucide-react';
import React, { useState, useCallback, useMemo, useLayoutEffect, useRef } from 'react';
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
  /** When true, show checkboxes to choose which recipients with phone receive the SMS */
  showRecipientSelection?: boolean;
}

type SendPhase = 'idle' | 'sending' | 'done';

function hasPhone(r: BulkMessageRecipient): boolean {
  return !!(r.phone && r.phone.trim());
}

export function BulkMessageDialog({
  isOpen,
  onClose,
  recipients,
  pluginSource,
  showRecipientSelection = false,
}: BulkMessageDialogProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [phase, setPhase] = useState<SendPhase>('idle');
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const sendBatchTotalRef = useRef(0);

  const withPhone = useMemo(() => recipients.filter((r) => hasPhone(r)), [recipients]);
  const withoutPhone = recipients.length - withPhone.length;

  useLayoutEffect(() => {
    if (isOpen && showRecipientSelection) {
      setSelectedIds(new Set(withPhone.map((r) => r.id)));
    }
  }, [isOpen, showRecipientSelection, withPhone]);

  const eligibleSelectedCount = useMemo(
    () => withPhone.filter((r) => selectedIds.has(r.id)).length,
    [withPhone, selectedIds],
  );

  const recipientsToSend = useMemo(() => {
    if (!showRecipientSelection) {
      return withPhone;
    }
    return withPhone.filter((r) => selectedIds.has(r.id));
  }, [showRecipientSelection, withPhone, selectedIds]);

  const handleSend = useCallback(async () => {
    const toSend = showRecipientSelection
      ? withPhone.filter((r) => selectedIds.has(r.id))
      : withPhone;
    if (toSend.length === 0) {
      return;
    }
    sendBatchTotalRef.current = toSend.length;
    setPhase('sending');
    setErrorMessage(null);
    let sent = 0;
    let failed = 0;
    let firstError: string | null = null;
    for (const r of toSend) {
      try {
        const res = await pulseApi.send({
          to: r.phone.trim(),
          body,
          pluginSource,
          referenceId: r.id,
        });
        if (res?.logEntry) {
          window.dispatchEvent(new CustomEvent('pulseSent', { detail: res.logEntry }));
        }
        sent += 1;
      } catch (e: any) {
        failed += 1;
        if (!firstError) {
          firstError = e?.message || 'Failed to send message';
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
  }, [body, withPhone, pluginSource, showRecipientSelection, selectedIds]);

  const handleClose = useCallback(() => {
    setBody('');
    setPhase('idle');
    setSentCount(0);
    setFailedCount(0);
    setErrorMessage(null);
    setSelectedIds(new Set());
    onClose();
  }, [onClose]);

  const allEligibleSelected = withPhone.length > 0 && eligibleSelectedCount === withPhone.length;

  const handleToggleSelectAll = useCallback(() => {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(withPhone.map((r) => r.id)));
    }
  }, [allEligibleSelected, withPhone]);

  const toggleRecipient = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (!isOpen) {
    return null;
  }

  const canSend = recipientsToSend.length > 0 && !!body.trim();

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
              {showRecipientSelection ? (
                <>
                  <span>
                    {t('bulk.recipientsSelectedForSms', {
                      selected: eligibleSelectedCount,
                      eligible: withPhone.length,
                    })}
                  </span>
                  <span className="block mt-0.5">
                    {t('bulk.sendMessageRecipients', {
                      total: recipients.length,
                      withPhone: withPhone.length,
                    })}
                  </span>
                </>
              ) : (
                t('bulk.sendMessageRecipients', {
                  total: recipients.length,
                  withPhone: withPhone.length,
                })
              )}
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
                {showRecipientSelection && recipients.length > 0 && (
                  <div className="rounded-md border border-border bg-muted/30 min-h-0 max-h-40 flex flex-col">
                    <div className="px-2 py-1.5 border-b border-border shrink-0">
                      {allEligibleSelected ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={XCircle}
                          type="button"
                          className="h-8 text-xs px-2 -ml-2 text-red-600 underline decoration-red-600/50 hover:text-red-700 hover:decoration-red-700 hover:bg-transparent dark:text-red-400 dark:decoration-red-400/50 dark:hover:text-red-300 dark:hover:bg-transparent"
                          onClick={handleToggleSelectAll}
                        >
                          {t('bulk.deselectAllRecipients')}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={ListChecks}
                          type="button"
                          className="h-8 text-xs px-2 -ml-2 text-primary hover:text-primary hover:bg-primary/5 disabled:opacity-50"
                          onClick={handleToggleSelectAll}
                          disabled={withPhone.length === 0}
                        >
                          {t('bulk.selectAllRecipients')}
                        </Button>
                      )}
                    </div>
                    <ul className="overflow-y-auto text-xs divide-y divide-border">
                      {recipients.map((r) => {
                        const eligible = hasPhone(r);
                        const checked = eligible && selectedIds.has(r.id);
                        return (
                          <li
                            key={r.id}
                            className={
                              eligible
                                ? 'flex items-center gap-2 px-2 py-2.5'
                                : 'flex items-center gap-2 px-2 py-2.5 opacity-50'
                            }
                          >
                            <input
                              type="checkbox"
                              className="rounded border-input shrink-0"
                              checked={checked}
                              disabled={!eligible}
                              onChange={() => eligible && toggleRecipient(r.id)}
                              aria-label={r.name}
                            />
                            <span className="text-xs text-foreground truncate min-w-0">
                              {r.name}
                            </span>
                            <span className="text-muted-foreground truncate ml-auto shrink-0 max-w-[45%]">
                              {eligible ? r.phone.trim() : t('bulk.recipientNoPhone')}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
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
                  total: sendBatchTotalRef.current,
                })}
              </p>
            )}
            {phase === 'done' && (
              <div className="text-sm space-y-1">
                <p className="text-foreground font-medium">{t('bulk.sendMessageDone')}</p>
                <p
                  className={
                    failedCount === 0
                      ? 'font-medium text-green-600 dark:text-green-400'
                      : sentCount === 0
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : 'font-medium text-yellow-600 dark:text-yellow-500'
                  }
                >
                  {t('bulk.sendMessageResult', { sent: sentCount, failed: failedCount })}
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
                <Button size="sm" onClick={handleSend} disabled={phase === 'sending' || !canSend}>
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
