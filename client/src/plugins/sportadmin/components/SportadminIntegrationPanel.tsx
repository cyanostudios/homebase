// client/src/plugins/sportadmin/components/SportadminIntegrationPanel.tsx
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  CloudDownload,
  ListTree,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Switch } from '@/components/ui/switch';
import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { DETAIL_EMPTY_STATE_CLASS, DETAIL_FIELD_LABEL_CLASS } from '@/core/ui/detailViewCardStyles';
import { FORM_INPUT_CLASS } from '@/core/ui/formFieldStyles';
import { ListFilterStatCard, LIST_FILTER_STAT_ROW_CLASS } from '@/core/ui/ListFilterStatCard';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import { cn } from '@/lib/utils';

import { sportadminApi } from '../api/sportadminApi';
import type {
  SportadminConnectionStatus,
  SportadminStatus,
  SportadminSyncError,
} from '../types/sportadmin';
import { formatSportadminDateTime } from '../utils/formatSportadminDate';
import { formatSportadminApiError } from '../utils/formatSportadminApiError';

import { SportadminSectionCard } from './SportadminSectionCard';
import { SportadminStaleBanner } from './SportadminStaleBanner';
import { SportadminSyncProgressDialog } from './SportadminSyncProgressDialog';

function statusBadgeProps(status: SportadminConnectionStatus): {
  icon: typeof CheckCircle2;
  className: string;
  labelKey: string;
} {
  switch (status) {
    case 'connected':
      return {
        icon: CheckCircle2,
        className: QC_STATUS_BADGE_COLORS.success,
        labelKey: 'sportadmin.status.connected',
      };
    case 'partial':
      return {
        icon: TriangleAlert,
        className: QC_STATUS_BADGE_COLORS.warning,
        labelKey: 'sportadmin.status.partial',
      };
    case 'error':
      return {
        icon: AlertCircle,
        className: QC_STATUS_BADGE_COLORS.danger,
        labelKey: 'sportadmin.status.error',
      };
    case 'syncing':
      return {
        icon: CloudDownload,
        className: QC_STATUS_BADGE_COLORS.info,
        labelKey: 'sportadmin.status.syncing',
      };
    case 'not_configured':
    default:
      return {
        icon: Circle,
        className: QC_STATUS_BADGE_COLORS.muted,
        labelKey: 'sportadmin.status.notConfigured',
      };
  }
}

export function SportadminIntegrationPanel({
  status,
  siteUrl,
  onSiteUrlChange,
  onStatusChange,
  syncMessage,
  syncError,
  onSyncMessage,
  onSyncError,
}: {
  status: SportadminStatus | null;
  siteUrl: string;
  onSiteUrlChange: (value: string) => void;
  onStatusChange: (next: SportadminStatus) => void;
  syncMessage: string | null;
  syncError: string | null;
  onSyncMessage: (value: string | null) => void;
  onSyncError: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingCron, setIsSavingCron] = useState(false);
  const [cronError, setCronError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [errors, setErrors] = useState<SportadminSyncError[] | null>(null);
  const [errorsLoading, setErrorsLoading] = useState(false);

  const connectionStatus = status?.status ?? 'not_configured';
  const badge = statusBadgeProps(isSyncing ? 'syncing' : connectionStatus);
  const cronEnabled = Boolean(status?.cronEnabled);
  const counts = status?.counts ?? {
    pages: 0,
    teams: 0,
    news: 0,
    matches: 0,
    events: 0,
    links: 0,
  };
  const canSync = connectionStatus !== 'not_configured' && Boolean(siteUrl.trim()) && !isSyncing;

  const handleSync = useCallback(async () => {
    onSyncMessage(null);
    onSyncError(null);
    setIsSyncing(true);
    try {
      const next = await sportadminApi.syncNow();
      onStatusChange(next);
      onSyncMessage(t('sportadmin.syncSuccess'));
    } catch (err) {
      const message = formatSportadminApiError(err, t('sportadmin.syncFailed'));
      onSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  }, [onStatusChange, onSyncError, onSyncMessage, t]);

  const handleCronToggle = useCallback(
    async (checked: boolean) => {
      setCronError(null);
      setIsSavingCron(true);
      try {
        const next = await sportadminApi.setCronEnabled(checked);
        onStatusChange(next);
      } catch (err) {
        setCronError(formatSportadminApiError(err, t('sportadmin.cronSaveFailed')));
      } finally {
        setIsSavingCron(false);
      }
    },
    [onStatusChange, t],
  );
  const handleToggleErrors = useCallback(async () => {
    if (showErrors) {
      setShowErrors(false);
      return;
    }
    setShowErrors(true);
    setErrorsLoading(true);
    try {
      const list = await sportadminApi.getErrors();
      setErrors(Array.isArray(list) ? list : []);
    } catch {
      setErrors([]);
    } finally {
      setErrorsLoading(false);
    }
  }, [showErrors]);

  return (
    <div className="space-y-4">
      <SportadminSyncProgressDialog isOpen={isSyncing} />

      <SportadminStaleBanner
        lastSuccessfulSync={status?.lastSuccessfulSync ?? null}
        lastError={status?.lastError ?? null}
      />

      {isSyncing ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100"
        >
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" aria-hidden />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold">{t('sportadmin.syncingTitle')}</p>
            <p className="text-xs text-sky-800/80 dark:text-sky-200/80">
              {t('sportadmin.syncingBody')}
            </p>
          </div>
        </div>
      ) : null}

      <SportadminSectionCard title={t('sportadmin.sections.connection')} icon={ListTree}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sportadmin-url" className={DETAIL_FIELD_LABEL_CLASS}>
              {t('sportadmin.urlLabel')}
            </Label>
            <Input
              id="sportadmin-url"
              className={FORM_INPUT_CLASS}
              value={siteUrl}
              onChange={(event) => onSiteUrlChange(event.target.value)}
              placeholder="https://example.web.sportadmin.se/"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">{t('sportadmin.urlHelp')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">{t('sportadmin.statusLabel')}</span>
            <StatusOutlineBadge icon={badge.icon} className={badge.className}>
              {t(badge.labelKey)}
            </StatusOutlineBadge>
          </div>

          {connectionStatus === 'not_configured' ? (
            <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.notConfiguredHint')}</p>
          ) : null}

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t('sportadmin.lastSync')}</dt>
              <dd className="font-medium">
                {formatSportadminDateTime(status?.lastSuccessfulSync ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('sportadmin.nextSync')}</dt>
              <dd className="font-medium">
                {cronEnabled
                  ? formatSportadminDateTime(status?.nextSync ?? null)
                  : t('sportadmin.cronOffNextSync')}
              </dd>
            </div>
          </dl>

          <div
            className={cn(
              'flex items-start justify-between gap-3 rounded-lg border p-3',
              cronEnabled ? 'border-primary/40 bg-primary/5' : 'border-border/60',
            )}
          >
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor="sportadmin-cron"
                className="flex items-center gap-1.5 text-sm font-medium text-foreground"
              >
                <RefreshCw className="size-3.5 shrink-0" aria-hidden />
                {t('sportadmin.cronLabel')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('sportadmin.cronHelp')}</p>
              {cronError ? <p className="text-xs text-destructive">{cronError}</p> : null}
            </div>
            <Switch
              id="sportadmin-cron"
              checked={cronEnabled}
              disabled={isSavingCron || connectionStatus === 'not_configured'}
              onCheckedChange={(checked) => void handleCronToggle(checked)}
              aria-label={t('sportadmin.cronLabel')}
            />
          </div>
        </div>
      </SportadminSectionCard>

      <SportadminSectionCard title={t('sportadmin.sections.connectionTest')} icon={CheckCircle2}>
        {status?.connectionTest && status.connectionTest.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {status.connectionTest.map((item) => {
              const isWarn = Boolean(item.warning) || (!item.ok && item.key !== 'reachable');
              const icon = item.ok ? '✓' : isWarn ? '⚠' : '✕';
              const tone = item.ok
                ? QC_STATUS_BADGE_COLORS.success
                : isWarn
                  ? QC_STATUS_BADGE_COLORS.warning
                  : QC_STATUS_BADGE_COLORS.danger;
              return (
                <li key={item.key} className={cn('flex gap-2', tone)}>
                  <span aria-hidden className="font-extrabold">
                    {icon}
                  </span>
                  <span>
                    {item.label}
                    {item.detail ? (
                      <span className="text-muted-foreground"> — {item.detail}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.connectionTestEmpty')}</p>
        )}
      </SportadminSectionCard>

      <SportadminSectionCard
        title={t('sportadmin.sections.imported')}
        icon={CloudDownload}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <RoundIconLabelButton
              type="button"
              icon={isSyncing ? Loader2 : RefreshCw}
              label={isSyncing ? t('sportadmin.syncing') : t('sportadmin.syncNow')}
              variant="primary"
              size="xs"
              alwaysExpanded
              disabled={!canSync}
              onClick={() => void handleSync()}
              aria-busy={isSyncing}
              className={isSyncing ? '[&_svg]:animate-spin' : undefined}
            />
            <RoundIconLabelButton
              type="button"
              icon={AlertCircle}
              label={showErrors ? t('sportadmin.hideErrors') : t('sportadmin.viewErrors')}
              variant="secondary"
              size="xs"
              alwaysExpanded
              onClick={() => void handleToggleErrors()}
            />
          </div>
        }
      >
        <div className={cn(LIST_FILTER_STAT_ROW_CLASS, 'lg:grid-cols-6')}>
          <ListFilterStatCard
            label={t('sportadmin.counts.pages')}
            value={counts.pages}
            dotClassName="bg-cyan-500"
          />
          <ListFilterStatCard
            label={t('sportadmin.counts.teams')}
            value={counts.teams}
            dotClassName="bg-emerald-500"
          />
          <ListFilterStatCard
            label={t('sportadmin.counts.news')}
            value={counts.news}
            dotClassName="bg-blue-500"
          />
          <ListFilterStatCard
            label={t('sportadmin.counts.matches')}
            value={counts.matches}
            dotClassName="bg-violet-500"
          />
          <ListFilterStatCard
            label={t('sportadmin.counts.events')}
            value={counts.events}
            dotClassName="bg-amber-500"
          />
          <ListFilterStatCard
            label={t('sportadmin.counts.links')}
            value={counts.links}
            dotClassName="bg-slate-400"
          />
        </div>

        {syncMessage ? (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{syncMessage}</p>
        ) : null}
        {syncError ? <p className="mt-3 text-sm text-destructive">{syncError}</p> : null}
      </SportadminSectionCard>

      {showErrors ? (
        <SportadminSectionCard title={t('sportadmin.sections.errors')} icon={AlertCircle}>
          {errorsLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : errors && errors.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {errors.map((err) => (
                <li
                  key={`${err.at}:${err.resource}:${err.message}`}
                  className="rounded-md bg-muted/40 px-3 py-2"
                >
                  <div className="text-xs text-muted-foreground">
                    {formatSportadminDateTime(err.at)}
                    {err.status !== null && err.status !== undefined ? ` · HTTP ${err.status}` : ''}
                  </div>
                  <div className="font-medium break-all">{err.resource}</div>
                  <div className="text-muted-foreground break-words">{err.message}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.errorsEmpty')}</p>
          )}
        </SportadminSectionCard>
      ) : null}
    </div>
  );
}
