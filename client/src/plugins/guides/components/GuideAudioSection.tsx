import { Loader2, RefreshCw, Trash2, Volume2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

import { guidesApi } from '../api/guidesApi';
import { isAudioStatus, type AudioStatus, type GuideAudio } from '../types/guides';
import { formatDurationMs } from '../utils/guideAudioFormat';

const POLL_INTERVAL_MS = 3000;

type RegenerateReason = 'stale' | 'failed' | 'ready';

interface GuideAudioSectionProps {
  placeId: string;
  stopId: string;
  variantId: string;
  presentationText: string | null;
  parentBusy?: boolean;
}

function resolveAudioStatus(audio: GuideAudio | null): AudioStatus | null {
  if (!audio) return null;
  return isAudioStatus(audio.status) ? audio.status : 'pending';
}

export const GuideAudioSection: React.FC<GuideAudioSectionProps> = ({
  placeId,
  stopId,
  variantId,
  presentationText,
  parentBusy = false,
}) => {
  const { t } = useTranslation();
  const [audio, setAudio] = useState<GuideAudio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenerateReason, setRegenerateReason] = useState<RegenerateReason | null>(null);

  const hasPresentationText = Boolean(presentationText?.trim());
  const status = resolveAudioStatus(audio);
  const disabled = isBusy || parentBusy;
  const previewUrl =
    audio?.storageRef && (status === 'ready' || status === 'stale')
      ? guidesApi.getAudioPreviewUrl(placeId, stopId, variantId)
      : null;

  const loadAudio = useCallback(async () => {
    setActionError(null);
    try {
      const data = await guidesApi.getAudioOrNull(placeId, stopId, variantId);
      setAudio(data);
      return data;
    } catch {
      setActionError(t('guides.audio.loadFailed'));
      setAudio(null);
      return null;
    }
  }, [placeId, stopId, variantId, t]);

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
  }, [loadAudio]);

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
    const error = err as { status?: number; message?: string };
    if (error.status === 409) {
      setActionError(t('guides.audio.alreadyProcessing'));
    } else if (error.status === 400) {
      setActionError(t('guides.audio.noPresentationText'));
    } else {
      setActionError(t('guides.audio.actionFailed'));
    }
  };

  const handleGenerate = async () => {
    if (disabled || !hasPresentationText) return;
    setIsBusy(true);
    setActionError(null);
    try {
      const result = await guidesApi.generateAudio(placeId, stopId, variantId);
      setAudio(result);
    } catch (err) {
      handleApiActionError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancel = async () => {
    if (disabled || status !== 'processing') return;
    setIsBusy(true);
    setActionError(null);
    try {
      const result = await guidesApi.cancelAudio(placeId, stopId, variantId);
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
      await guidesApi.deleteAudio(placeId, stopId, variantId);
      setAudio(null);
      setDeleteOpen(false);
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
    if (!status) return null;

    const label = t(`guides.audio.status.${status}`);
    const baseClass = 'text-[10px]';

    switch (status) {
      case 'processing':
        return (
          <Badge
            variant="outline"
            className={cn(baseClass, 'border-blue-500/50 text-blue-700 dark:text-blue-400')}
          >
            <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />
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
            {label}
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className={baseClass}>
            {label}
          </Badge>
        );
      case 'stale':
        return (
          <Badge
            variant="outline"
            className={cn(baseClass, 'border-amber-500/50 text-amber-700 dark:text-amber-400')}
          >
            {label}
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge variant="outline" className={cn(baseClass, 'text-muted-foreground')}>
            {label}
          </Badge>
        );
    }
  };

  const renderHint = () => {
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
    if (!status) {
      return (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={Volume2}
          className="h-8 px-3 text-xs"
          disabled={disabled || !hasPresentationText}
          onClick={() => void handleGenerate()}
          aria-label={t('guides.audio.generate')}
        >
          {t('guides.audio.generate')}
        </Button>
      );
    }

    switch (status) {
      case 'pending':
        return (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={Volume2}
            className="h-8 px-3 text-xs"
            disabled={disabled || !hasPresentationText}
            onClick={() => void handleGenerate()}
            aria-label={t('guides.audio.generate')}
          >
            {t('guides.audio.generate')}
          </Button>
        );
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
            disabled={disabled || !hasPresentationText}
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
            disabled={disabled || !hasPresentationText}
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
            disabled={disabled || !hasPresentationText}
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                controls
                src={previewUrl}
                className="h-8 w-full"
                aria-label={t('guides.audio.previewLabel')}
              />
            )}
            {actionError && <p className="text-xs text-destructive">{actionError}</p>}
            {!hasPresentationText && status !== 'processing' && (
              <p className="text-xs text-muted-foreground">
                {t('guides.audio.noPresentationText')}
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
    </div>
  );
};
