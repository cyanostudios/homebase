import { History, RotateCcw } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { activityLogApi, ActivityLogEntry } from '@/core/api/activityLogApi';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  update: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  delete: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  export: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  settings: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300',
  mail_sent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
};

interface DetailActivityLogProps {
  entityType: string;
  entityId: string | number;
  limit?: number;
  /** Section title in the detail sidebar */
  title?: string;
  className?: string;
  /** Show a reset button that deletes all activity log entries (with confirmation). */
  showClearButton?: boolean;
  /** When this value changes, the log is refetched (e.g. slot.updated_at after save). */
  refreshKey?: string | number | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function DetailActivityLog({
  entityType,
  entityId,
  limit = 30,
  title,
  className,
  showClearButton = false,
  refreshKey,
}: DetailActivityLogProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    activityLogApi
      .getActivityLogs({ entityType, entityId, limit })
      .then((res) => setLogs(res.logs))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [entityType, entityId, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshKey]);

  const handleConfirmClear = useCallback(async () => {
    setResetting(true);
    try {
      await activityLogApi.deleteActivityLogs();
      setLogs([]);
      setShowResetConfirm(false);
    } catch {
      // Keep dialog open or toast on error
    } finally {
      setResetting(false);
    }
  }, []);

  const actionLabel = (action: string) => {
    const key = `activityLog.action.${action}`;
    const translated = t(key);
    return translated !== key ? translated : action.replace(/_/g, ' ');
  };

  return (
    <>
      <Card
        padding="none"
        className={cn('overflow-hidden border border-border/70 bg-card shadow-sm', className)}
      >
        <DetailSection
          title={title ?? t('activityLog.title', 'Activity')}
          icon={History}
          className="p-4"
          action={
            showClearButton ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowResetConfirm(true)}
                disabled={loading || logs.length === 0}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                {t('activityLog.reset', 'Reset')}
              </Button>
            ) : undefined
          }
        >
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('activityLog.noActivity', 'No activity yet')}
            </p>
          ) : (
            <ul className="space-y-3 text-xs">
              {logs.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        'inline-flex px-1.5 py-0.5 rounded font-medium capitalize',
                        ACTION_COLORS[entry.action] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {actionLabel(entry.action)}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                  {entry.action === 'update' && entry.metadata?.changeSummary && (
                    <span className="text-muted-foreground block">
                      {entry.metadata.changeSummary}
                    </span>
                  )}
                  {entry.entityName && (
                    <span className="text-muted-foreground truncate block">{entry.entityName}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DetailSection>
      </Card>
      <ConfirmDialog
        isOpen={showResetConfirm}
        title={t('activityLog.resetConfirmTitle', 'Clear activity log?')}
        message={t(
          'activityLog.resetConfirmMessage',
          'This will permanently delete all activity log entries. This cannot be undone. Are you sure?',
        )}
        confirmText={t('activityLog.resetConfirmButton', 'Clear all')}
        cancelText={t('common.cancel', 'Cancel')}
        onConfirm={handleConfirmClear}
        onCancel={() => setShowResetConfirm(false)}
        variant="danger"
        confirmDisabled={resetting}
      />
    </>
  );
}
