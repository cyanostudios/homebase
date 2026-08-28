import { Copy, Check, ExternalLink, Unlink } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { ShareDialog } from '@/plugins/estimates/components/ShareDialog';

import { noteShareApi } from '../api/notesApi';
import { useNotes } from '../hooks/useNotes';
import type { Note } from '../types/notes';

/** Active link panel + ShareDialog (below attachments in note view); Share / View in Export options. */
export function NoteShareBlock({ note }: { note: Note }) {
  const { t } = useTranslation();
  const {
    noteShareExistingShare,
    noteShareShowDialog,
    setNoteShareShowDialog,
    handleNoteCopyShareUrl,
    handleNoteRevokeShare,
  } = useNotes();

  const [copied, setCopied] = useState(false);

  const shareUrl = noteShareExistingShare
    ? noteShareApi.generateShareUrl(noteShareExistingShare.shareToken)
    : '';
  const isShareExpired = noteShareExistingShare
    ? new Date(noteShareExistingShare.validUntil) <= new Date()
    : false;

  const handleCopy = () => {
    handleNoteCopyShareUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const entityLabel = (note.title || '').trim() || formatDisplayNumber('notes', note.id);

  return (
    <>
      {noteShareExistingShare && (
        <div
          className={`rounded-lg border p-4 ${
            isShareExpired
              ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
              : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
          }`}
        >
          <div
            className={`mb-2 text-sm font-medium ${
              isShareExpired ? 'text-red-900 dark:text-red-400' : 'text-blue-900 dark:text-blue-400'
            }`}
          >
            {isShareExpired
              ? t('notes.shareExpired', { defaultValue: 'Share Link Expired' })
              : t('notes.shareActive', { defaultValue: 'Active Share Link' })}
          </div>

          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 break-all rounded border border-gray-200 bg-white p-2 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
              {shareUrl}
            </div>
            {!isShareExpired && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <RoundIconLabelButton
                  type="button"
                  icon={copied ? Check : Copy}
                  label={copied ? t('common.copied') : t('common.copy')}
                  variant={copied ? 'success' : 'soft'}
                  alwaysExpanded
                  onClick={handleCopy}
                />
                <RoundIconLabelButton
                  type="button"
                  icon={ExternalLink}
                  label={t('common.view')}
                  variant="soft"
                  alwaysExpanded
                  onClick={() => shareUrl && window.open(shareUrl, '_blank', 'noopener,noreferrer')}
                />
              </div>
            )}
          </div>

          <div
            className={`flex flex-wrap items-center gap-3 text-xs ${
              isShareExpired ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'
            }`}
          >
            <div>
              {isShareExpired
                ? t('notes.expiredOn', { defaultValue: 'Expired on' })
                : t('notes.expiresOn', { defaultValue: 'Expires on' })}{' '}
              {new Date(noteShareExistingShare.validUntil).toLocaleDateString()}
              {noteShareExistingShare.accessedCount > 0 && (
                <span className="ml-2">
                  •{' '}
                  {t('notes.accessedCount', {
                    defaultValue: 'Accessed {{count}} times',
                    count: noteShareExistingShare.accessedCount,
                  })}
                </span>
              )}
            </div>
            <RoundIconLabelButton
              type="button"
              icon={Unlink}
              label={t('notes.revokeShare', { defaultValue: 'Revoke' })}
              variant="dangerSoft"
              alwaysExpanded
              onClick={handleNoteRevokeShare}
            />
          </div>
        </div>
      )}

      <ShareDialog
        isOpen={noteShareShowDialog}
        onClose={() => setNoteShareShowDialog(false)}
        shareUrl={shareUrl}
        entityLabel={entityLabel}
        variant="note"
      />
    </>
  );
}
