import { Loader2, RefreshCw, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

import { guidesApi } from '../api/guidesApi';
import {
  isAudioStatus,
  type AudioStatus,
  type GuideAudio,
  type PresentationApprovalStatus,
} from '../types/guides';
import { formatDurationMs } from '../utils/guideAudioFormat';
import { resolveAudioGenerateErrorMessage } from '../utils/resolveAudioGenerateErrorMessage';

const POLL_INTERVAL_MS = 3000;

type RegenerateReason = 'stale' | 'failed' | 'ready';

interface GuideAudioSectionProps {
  placeId: string;
  language: string;
  presentationText: string | null;
  approvalStatus: PresentationApprovalStatus;
  parentBusy?: boolean;
  /** When true, only render a compact status badge (collapsed card header). */
  compact?: boolean;
  /** Bump to reload audio (e.g. after generate from production panel). */
  refreshKey?: string | number;
  onStatusChange?: (status: AudioStatus | null) => void;
  /** Notify parent after generate/delete so place audio cost can refresh. */
  onLedgerChange?: () => void;
}

function resolveAudioStatus(audio: GuideAudio | null): AudioStatus | null {
  if (!audio) return null;
  return isAudioStatus(audio.status) ? audio.status : 'pending';
}

export const GuideAudioSection: React.FC<GuideAudioSectionProps> = ({
  placeId,
  language,
  presentationText,
  approvalStatus,
  parentBusy = false,
  compact = false,
  refreshKey = '',
  onStatusChange,
  onLedgerChange,
}) => {
  const { t } = useTranslation();
  const [audio, setAudio] = useState<GuideAudio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenerateReason, setRegenerateReason] = useState<RegenerateReason | null>(null);

  const hasPresentationText = Boolean(presentationText?.trim());
  const isApproved = approvalStatus === 'approved';
  const canGenerate = hasPresentationText && isApproved;
  const status = resolveAudioStatus(audio);
  const disabled = isBusy || parentBusy;
  const previewCacheKey = audio?.updatedAt || audio?.storageRef || '';
  const previewUrl =
    audio?.storageRef && (status === 'ready' || status === 'stale' || status === 'processing')
      ? `${guidesApi.getAudioPreviewUrl(placeId, language)}?t=${encodeURIComponent(previewCacheKey)}`
      : null;

  const loadAudio = useCallback(async () => {
    setActionError(null);
    try {
      const data = await guidesApi.getAudioOrNull(placeId, language);
      setAudio(data);
      return data;
    } catch {
      setActionError(t('guides.audio.loadFailed'));
      setAudio(null);
      return null;
    }
  }, [placeId, language, t]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void loadAudio().finally(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadAudio, refreshKey]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    if (status !== 'processing') {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    const intervalId = window.setInterval(() => {
      void loadAudio();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      setIsPolling(false);
    };
  }, [status, loadAudio]);

  const handleApiActionError = (err: unknown) => {
    const message = resolveAudioGenerateErrorMessage(err, t);
    setActionError(message);
    setErrorDialogMessage(message);
  };

  const handleGenerate = async () => {
    if (disabled || !canGenerate) return;
    setIsBusy(true);
    setActionError(null);
    // Sync generate waits on TTS — show processing immediately, keep previous blob for preview.
    setAudio((prev) => ({
      id: prev?.id ?? 'pending',
      presentationId: prev?.presentationId ?? '',
      placeId,
      language,
      status: 'processing',
      providerKey: prev?.providerKey ?? 'noop',
      storageRef: prev?.storageRef ?? null,
      durationMs: prev?.durationMs ?? null,
      mimeType: prev?.mimeType ?? null,
      errorMessage: null,
      createdAt: prev?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    try {
      const result = await guidesApi.generateAudio(placeId, language);
      setAudio(result);
      onLedgerChange?.();
    } catch (err) {
      handleApiActionError(err);
      await loadAudio();
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancel = async () => {
    if (disabled || status !== 'processing') return;
    setIsBusy(true);
    setActionError(null);
    try {
      const result = await guidesApi.cancelAudio(placeId, language);
      setAudio(result);
    } catch (err) {
      handleApiActionError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (disabled || !audio) return;
    setIsBusy(true);
    setActionError(null);
    try {
      await guidesApi.deleteAudio(placeId, language);
      setAudio(null);
      setDeleteOpen(false);
      onLedgerChange?.();
    } catch {
      setActionError(t('guides.audio.deleteFailed'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleRegenerateConfirm = async () => {
    setRegenerateReason(null);
    await handleGenerate();
  };

  const openRegenerate = (reason: RegenerateReason) => {
    if (disabled) return;
    setRegenerateReason(reason);
  };

  const renderStatusBadge = () => {
    const baseClass = 'inline-flex items-center gap-1 text-[10px]';

    if (!status || status === 'pending') {
      return (
        <Badge
          variant="outline"
          className={cn(
            baseClass,
            'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-400',
          )}
        >
          <VolumeX className="h-3 w-3" aria-hidden />
          {t('guides.audio.status.none')}
        </Badge>
      );
    }

    const label = t(`guides.audio.status.${status}`);
    const StatusIcon = status === 'processing' ? Loader2 : Volume2;

    switch (status) {
      case 'processing':
        return (
          <Badge
            variant="outline"
            className={cn(baseClass, 'border-blue-500/50 text-blue-700 dark:text-blue-400')}
          >
            <StatusIcon className="h-3 w-3 animate-spin" aria-hidden />
            {label}
          </Badge>
        );
      case 'ready':
        return (
          <Badge
            variant="secondary"
            className={cn(
              baseClass,
              'border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-400',
            )}
          >
            <StatusIcon className="h-3 w-3" aria-hidden />
            {label}
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className={baseClass}>
            <StatusIcon className="h-3 w-3" aria-hidden />
            {label}
          </Badge>
        );
      case 'stale':
        return (
          <Badge
            variant="outline"
            className={cn(baseClass, 'border-amber-500/50 text-amber-700 dark:text-amber-400')}
          >
            <StatusIcon className="h-3 w-3" aria-hidden />
            {label}
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className={cn(
              baseClass,
              'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-400',
            )}
          >
            <VolumeX className="h-3 w-3" aria-hidden />
            {t('guides.audio.status.none')}
          </Badge>
        );
    }
  };

  if (compact) {
    if (isLoading) {
      return null;
    }
    return (
      <span className="shrink-0" role="status" aria-live="polite">
        {renderStatusBadge()}
      </span>
    );
  }

  const renderHint = () => {
    if (!hasPresentationText && status !== 'processing') {
      return (
        <p className="text-xs text-muted-foreground">{t('guides.audio.noPresentationText')}</p>
      );
    }
    if (hasPresentationText && !isApproved && status !== 'processing') {
      return <p className="text-xs text-muted-foreground">{t('guides.audio.requiresApproval')}</p>;
    }
    if (!status) {
      return <p className="text-xs text-muted-foreground">{t('guides.audio.emptyHint')}</p>;
    }
    switch (status) {
      case 'processing':
        return <p className="text-xs text-muted-foreground">{t('guides.audio.processingHint')}</p>;
      case 'stale':
        return <p className="text-xs text-muted-foreground">{t('guides.audio.staleHint')}</p>;
      case 'failed':
        return audio?.errorMessage ? (
          <p className="line-clamp-2 text-xs text-destructive">{audio.errorMessage}</p>
        ) : null;
      default:
        return null;
    }
  };

  const renderPrimaryAction = () => {
    if (isBusy && status === 'processing') {
      return (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={Loader2}
          className="h-8 px-3 text-xs [&_svg]:animate-spin"
          disabled
          aria-label={t('guides.audio.status.processing')}
        >
          {t('guides.audio.status.processing')}
        </Button>
      );
    }

    if (!status || status === 'pending') {
      return (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={Volume2}
          className="h-8 px-3 text-xs"
          disabled={disabled || !canGenerate}
          onClick={() => void handleGenerate()}
          aria-label={t('guides.audio.generate')}
        >
          {t('guides.audio.generate')}
        </Button>
      );
    }

    switch (status) {
      case 'processing':
        return (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={X}
            className="h-8 px-3 text-xs"
            disabled={disabled}
            onClick={() => void handleCancel()}
            aria-label={t('guides.audio.cancel')}
          >
            {t('guides.audio.cancel')}
          </Button>
        );
      case 'ready':
        return (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            className="h-8 px-3 text-xs"
            disabled={disabled || !canGenerate}
            onClick={() => openRegenerate('ready')}
            aria-label={t('guides.audio.regenerate')}
          >
            {t('guides.audio.regenerate')}
          </Button>
        );
      case 'failed':
        return (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            className="h-8 px-3 text-xs"
            disabled={disabled || !canGenerate}
            onClick={() => openRegenerate('failed')}
            aria-label={t('guides.audio.retry')}
          >
            {t('guides.audio.retry')}
          </Button>
        );
      case 'stale':
        return (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            className="h-8 px-3 text-xs"
            disabled={disabled || !canGenerate}
            onClick={() => openRegenerate('stale')}
            aria-label={t('guides.audio.regenerate')}
          >
            {t('guides.audio.regenerate')}
          </Button>
        );
      default:
        return null;
    }
  };

  const showDelete =
    status === 'pending' || status === 'ready' || status === 'failed' || status === 'stale';

  const regenerateMessage = () => {
    if (regenerateReason === 'stale') {
      return t('guides.audio.regenerateDescriptionStale');
    }
    if (regenerateReason === 'failed') {
      return t('guides.audio.regenerateDescriptionFailed');
    }
    return t('guides.audio.regenerateDescriptionReady');
  };

  return (
    <div className="mt-2 border-t border-border/40 pt-2">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t('guides.audio.title')}
      </p>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <div
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          role="status"
          aria-live="polite"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {renderStatusBadge()}
              {audio?.durationMs != null && (status === 'ready' || status === 'stale') && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {formatDurationMs(audio.durationMs)}
                </span>
              )}
              {isPolling && (
                <span className="text-xs text-muted-foreground">{t('guides.audio.polling')}</span>
              )}
            </div>
            {renderHint()}
            {previewUrl && (
              <audio
                key={previewCacheKey}
                controls
                src={previewUrl}
                className="h-8 w-full"
                aria-label={t('guides.audio.previewLabel')}
              />
            )}
            {actionError && (
              <p className="text-xs text-destructive" role="alert">
                {actionError}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {renderPrimaryAction()}
            {showDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={Trash2}
                className="h-8 px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                disabled={disabled}
                onClick={() => setDeleteOpen(true)}
                aria-label={t('common.delete')}
              >
                {t('common.delete')}
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteOpen}
        title={t('guides.audio.deleteTitle')}
        message={t('guides.audio.deleteDescription')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
        confirmDisabled={disabled}
      />

      <ConfirmDialog
        isOpen={regenerateReason !== null}
        title={t('guides.audio.regenerateTitle')}
        message={regenerateMessage()}
        confirmText={t('guides.audio.regenerate')}
        cancelText={t('common.cancel')}
        variant="warning"
        onConfirm={() => void handleRegenerateConfirm()}
        onCancel={() => setRegenerateReason(null)}
        confirmDisabled={disabled}
      />

      <ConfirmDialog
        isOpen={Boolean(errorDialogMessage)}
        title={t('guides.audio.generateFailedTitle')}
        message={errorDialogMessage ?? ''}
        confirmText={t('common.close')}
        variant="danger"
        onConfirm={() => setErrorDialogMessage(null)}
        onCancel={() => setErrorDialogMessage(null)}
      />
    </div>
  );
};
