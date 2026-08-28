import { Copy, Check, ExternalLink, Unlink } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { ShareDialog } from '@/plugins/estimates/components/ShareDialog';

import { taskShareApi } from '../api/tasksApi';
import { useTasks } from '../hooks/useTasks';
import type { Task } from '../types/tasks';

export function TaskShareBlock({ task }: { task: Task }) {
  const { t } = useTranslation();
  const {
    taskShareExistingShare,
    taskShareShowDialog,
    setTaskShareShowDialog,
    handleTaskCopyShareUrl,
    handleTaskRevokeShare,
  } = useTasks();

  const [copied, setCopied] = useState(false);

  const shareUrl = taskShareExistingShare
    ? taskShareApi.generateShareUrl(taskShareExistingShare.shareToken)
    : '';
  const isShareExpired = taskShareExistingShare
    ? new Date(taskShareExistingShare.validUntil) <= new Date()
    : false;

  const handleCopy = () => {
    handleTaskCopyShareUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const entityLabel = (task.title || '').trim() || formatDisplayNumber('tasks', task.id);

  return (
    <>
      {taskShareExistingShare && (
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
            {isShareExpired ? t('tasks.shareLinkExpired') : t('tasks.activeShareLink')}
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
              {isShareExpired ? t('tasks.expiredOn') : t('tasks.expiresOn')}{' '}
              {new Date(taskShareExistingShare.validUntil).toLocaleDateString()}
              {taskShareExistingShare.accessedCount > 0 && (
                <span className="ml-2">
                  • {t('tasks.accessedCount', { count: taskShareExistingShare.accessedCount })}
                </span>
              )}
            </div>
            <RoundIconLabelButton
              type="button"
              icon={Unlink}
              label={t('tasks.revokeShare')}
              variant="dangerSoft"
              alwaysExpanded
              onClick={handleTaskRevokeShare}
            />
          </div>
        </div>
      )}

      <ShareDialog
        isOpen={taskShareShowDialog}
        onClose={() => setTaskShareShowDialog(false)}
        shareUrl={shareUrl}
        entityLabel={entityLabel}
        variant="task"
      />
    </>
  );
}
