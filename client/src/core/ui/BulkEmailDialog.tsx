// client/src/core/ui/BulkEmailDialog.tsx
// Modal to compose and send email to a list of recipients

import { ListChecks, XCircle } from 'lucide-react';
import React, { useState, useCallback, useMemo, useLayoutEffect, useRef } from 'react';
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
  /** Optional additional text appended to the email body (plain text) */
  additionalText?: string;
  /** Optional additional HTML appended to the email body */
  additionalHtml?: string;
  /** Optional preview of additional content shown in the dialog */
  additionalPreview?: React.ReactNode;
  /** When true, show checkboxes to choose which recipients with email receive the message */
  showRecipientSelection?: boolean;
}

type SendPhase = 'idle' | 'sending' | 'done';

function hasValidEmail(r: BulkEmailRecipient): boolean {
  return !!(r.email && r.email.trim() && r.email.includes('@'));
}

export function BulkEmailDialog({
  isOpen,
  onClose,
  recipients,
  pluginSource,
  additionalText,
  additionalHtml,
  additionalPreview,
  showRecipientSelection = false,
}: BulkEmailDialogProps) {
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [phase, setPhase] = useState<SendPhase>('idle');
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const sendBatchTotalRef = useRef(0);

  const withEmail = useMemo(() => recipients.filter((r) => hasValidEmail(r)), [recipients]);
  const withoutEmail = recipients.length - withEmail.length;

  useLayoutEffect(() => {
    if (isOpen && showRecipientSelection) {
      setSelectedIds(new Set(withEmail.map((r) => r.id)));
    }
  }, [isOpen, showRecipientSelection, withEmail]);

  const eligibleSelectedCount = useMemo(
    () => withEmail.filter((r) => selectedIds.has(r.id)).length,
    [withEmail, selectedIds],
  );

  const recipientsToSend = useMemo(() => {
    if (!showRecipientSelection) {
      return withEmail;
    }
    return withEmail.filter((r) => selectedIds.has(r.id));
  }, [showRecipientSelection, withEmail, selectedIds]);

  const handleSend = useCallback(async () => {
    const toSend = showRecipientSelection
      ? withEmail.filter((r) => selectedIds.has(r.id))
      : withEmail;
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
        const fullText = additionalText ? `${body}\n\n${additionalText}` : body;
        const fullHtml = additionalHtml
          ? `<p>${body.replace(/\n/g, '<br>')}</p>${additionalHtml}`
          : `<p>${body.replace(/\n/g, '<br>')}</p>`;

        const res = await mailApi.send({
          to: [r.email.trim()],
          subject,
          text: fullText,
          html: fullHtml,
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
  }, [
    subject,
    body,
    withEmail,
    pluginSource,
    additionalText,
    additionalHtml,
    showRecipientSelection,
    selectedIds,
  ]);

  const handleClose = useCallback(() => {
    setSubject('');
    setBody('');
    setPhase('idle');
    setSentCount(0);
    setFailedCount(0);
    setErrorMessage(null);
    setSelectedIds(new Set());
    onClose();
  }, [onClose]);

  const allEligibleSelected = withEmail.length > 0 && eligibleSelectedCount === withEmail.length;

  const handleToggleSelectAll = useCallback(() => {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(withEmail.map((r) => r.id)));
    }
  }, [allEligibleSelected, withEmail]);

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

  const canSend = recipientsToSend.length > 0 && !!subject.trim() && !!body.trim();

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
              {showRecipientSelection ? (
                <>
                  <span>
                    {t('bulk.recipientsSelectedForEmail', {
                      selected: eligibleSelectedCount,
                      eligible: withEmail.length,
                    })}
                  </span>
                  <span className="block mt-0.5">
                    {t('bulk.sendEmailRecipients', {
                      total: recipients.length,
                      withEmail: withEmail.length,
                    })}
                  </span>
                </>
              ) : (
                t('bulk.sendEmailRecipients', {
                  total: recipients.length,
                  withEmail: withEmail.length,
                })
              )}
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
                          disabled={withEmail.length === 0}
                        >
                          {t('bulk.selectAllRecipients')}
                        </Button>
                      )}
                    </div>
                    <ul className="overflow-y-auto text-xs divide-y divide-border">
                      {recipients.map((r) => {
                        const eligible = hasValidEmail(r);
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
                            <span className="text-xs text-muted-foreground truncate ml-auto shrink-0 max-w-[45%]">
                              {eligible ? r.email.trim() : t('bulk.recipientNoEmail')}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
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
                {additionalPreview && (
                  <div className="mt-2 p-3 bg-muted/50 rounded-md border border-border/50">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {t('bulk.sendEmailAttachmentPreview')}
                    </p>
                    {additionalPreview}
                  </div>
                )}
              </>
            )}
            {phase === 'sending' && (
              <p className="text-sm text-muted-foreground">
                {t('bulk.sendEmailSending', {
                  sent: sentCount,
                  total: sendBatchTotalRef.current,
                })}
              </p>
            )}
            {phase === 'done' && (
              <div className="text-sm space-y-1">
                <p className="text-foreground font-medium">{t('bulk.sendEmailDone')}</p>
                <p
                  className={
                    failedCount === 0
                      ? 'font-medium text-green-600 dark:text-green-400'
                      : sentCount === 0
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : 'font-medium text-yellow-600 dark:text-yellow-500'
                  }
                >
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
                <Button size="sm" onClick={handleSend} disabled={phase === 'sending' || !canSend}>
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
