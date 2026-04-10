import { Copy, Check, ExternalLink } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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
          className={`p-4 rounded-lg border ${
            isShareExpired
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
              : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
          }`}
        >
          <div
            className={`text-sm font-medium mb-2 ${
              isShareExpired ? 'text-red-900 dark:text-red-400' : 'text-blue-900 dark:text-blue-400'
            }`}
          >
            {isShareExpired ? t('tasks.shareLinkExpired') : t('tasks.activeShareLink')}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-sm font-mono break-all text-gray-900 dark:text-gray-100">
              {shareUrl}
            </div>
            {!isShareExpired && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={copied ? Check : Copy}
                  onClick={handleCopy}
                  className={`h-9 text-xs px-3 ${
                    copied
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                      : ''
                  }`}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ExternalLink}
                  onClick={() => shareUrl && window.open(shareUrl, '_blank', 'noopener,noreferrer')}
                  className="h-9 text-xs px-3"
                >
                  View
                </Button>
              </div>
            )}
          </div>

          <div
            className={`text-xs ${isShareExpired ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}
          >
            <div className="flex items-center justify-left">
              <div>
                {isShareExpired ? t('tasks.expiredOn') : t('tasks.expiresOn')}{' '}
                {new Date(taskShareExistingShare.validUntil).toLocaleDateString()}
                {taskShareExistingShare.accessedCount > 0 && (
                  <span className="ml-2">
                    • {t('tasks.accessedCount', { count: taskShareExistingShare.accessedCount })}
                  </span>
                )}
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={handleTaskRevokeShare}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 h-auto p-0 underline decoration-red-600/30 font-normal ml-4"
              >
                {t('tasks.revokeShare')}
              </Button>
            </div>
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
