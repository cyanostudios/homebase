import { AlertCircle, CheckCircle2, Clock, Loader2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ProductionJob, ProductionJobItem } from '../types/guides';
import {
  countPendingReviewItems,
  getCurrentPhaseStep,
  getProductionJobFailureSummary,
  getTextPipelineStage,
  isProductionJobActive,
  isProductionJobStalled,
  resolveSourceSummary,
  summarizePhaseProgress,
} from '../utils/productionJobHelpers';
import { ProductionPhaseIndicator } from './ProductionPhaseIndicator';
import { SourceResearchSummary } from './SourceResearchSummary';
import { TextPipelineIndicator } from './TextPipelineIndicator';

interface ProductionPhaseBannerProps {
  job: ProductionJob;
  items: ProductionJobItem[];
  isPolling?: boolean;
  isBusy?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  onShowReview?: () => void;
}

export const ProductionPhaseBanner: React.FC<ProductionPhaseBannerProps> = ({
  job,
  items,
  isPolling = false,
  isBusy = false,
  onCancel,
  onRetry,
  onShowReview,
}) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [, setStallTick] = useState(0);
  const phaseStep = getCurrentPhaseStep(job);
  const progress = summarizePhaseProgress(job, items);
  const pendingReview = countPendingReviewItems(job, items);
  const pipelineStage = getTextPipelineStage(job, items);
  const sourceSummary = resolveSourceSummary(null, job);
  const isTextPhase = phaseStep === 'text_derivation' || !phaseStep;
  const stalled = isProductionJobStalled(job, items);
  const failureSummary =
    job.status === 'failed' ? getProductionJobFailureSummary(job, items) : null;

  useEffect(() => {
    if (job.status !== 'pending' && job.status !== 'planning') return;
    if (items.length > 0) return;
    const id = window.setInterval(() => setStallTick((n) => n + 1), 5000);
    return () => window.clearInterval(id);
  }, [job.id, job.status, items.length]);

  useEffect(() => {
    if (job.status !== 'completed') {
      setDismissed(false);
      return;
    }
    const timeoutId = window.setTimeout(() => setDismissed(true), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [job.id, job.status]);

  if (dismissed && job.status === 'completed') {
    return null;
  }

  if (!isProductionJobActive(job.status) && job.status !== 'completed' && job.status !== 'failed') {
    return null;
  }

  const messageKey = (() => {
    if (job.status === 'failed') return 'guides.production.banner.failed';
    if (job.status === 'completed') return 'guides.production.banner.completed';
    if (job.status === 'awaiting_review') {
      return 'guides.production.banner.awaitingReview';
    }
    if (stalled) return 'guides.production.banner.stalled';
    if (isTextPhase && ['research', 'deep', 'summarize'].includes(pipelineStage)) {
      return `guides.production.banner.pipeline.${pipelineStage}`;
    }
    if (job.status === 'pending') return 'guides.production.banner.pending';
    if (job.status === 'planning') return 'guides.production.banner.planning';
    if (job.status === 'processing' && phaseStep) {
      return `guides.production.banner.processing.${phaseStep}`;
    }
    return 'guides.production.banner.processing.generic';
  })();

  const tone = (() => {
    if (job.status === 'failed' || stalled) return 'danger';
    if (job.status === 'completed') return 'success';
    if (job.status === 'awaiting_review') return 'review';
    return 'active';
  })();

  const Icon =
    job.status === 'failed' || stalled
      ? AlertCircle
      : job.status === 'completed'
        ? CheckCircle2
        : job.status === 'pending'
          ? Clock
          : Loader2;

  const showCancel =
    onCancel && ['pending', 'planning', 'processing', 'awaiting_review'].includes(job.status);
  const showRetry = onRetry && job.status === 'failed';
  const showReviewLink = onShowReview && job.status === 'awaiting_review' && pendingReview > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-lg border px-4 py-3 shadow-sm',
        tone === 'danger' && 'border-destructive/40 bg-destructive/5',
        tone === 'success' && 'border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20',
        tone === 'review' && 'border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20',
        tone === 'active' && 'border-primary/30 bg-primary/5',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
                (job.status === 'failed' || stalled) && 'text-destructive',
                job.status === 'completed' && 'text-emerald-600 dark:text-emerald-400',
                job.status === 'awaiting_review' && 'text-amber-700 dark:text-amber-400',
                !stalled &&
                  !['failed', 'completed', 'awaiting_review'].includes(job.status) &&
                  'animate-spin text-primary',
                !stalled && job.status === 'pending' && 'animate-none text-muted-foreground',
              )}
              aria-hidden
            />
            <span className="font-medium">
              {t(messageKey, {
                count: pendingReview,
                phase: phaseStep ? t(`guides.production.phases.${phaseStep}`) : '',
              })}
            </span>
            {isPolling && !stalled && job.status !== 'awaiting_review' && (
              <span className="text-xs text-muted-foreground">
                {t('guides.production.polling')}
              </span>
            )}
          </div>

          {stalled && (
            <p className="text-xs text-destructive" role="alert">
              {t('guides.production.banner.stalledHint')}
            </p>
          )}

          {failureSummary && (
            <div className="space-y-1 text-xs" role="alert">
              <p className="font-medium text-destructive">
                {failureSummary.failureCode
                  ? t(`guides.generation.failure.${failureSummary.failureCode}.title`, {
                      defaultValue: t('guides.production.banner.failed'),
                    })
                  : t('guides.production.banner.failed')}
              </p>
              <p className="text-destructive/90">
                {failureSummary.failureCode
                  ? t(`guides.generation.failure.${failureSummary.failureCode}.message`, {
                      defaultValue:
                        failureSummary.detail || t('guides.production.banner.failedGeneric'),
                    })
                  : failureSummary.detail || t('guides.production.banner.failedGeneric')}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{t('guides.production.jobLabel', { id: job.id })}</span>
            {progress.total > 0 && (
              <span>
                {t('guides.production.progress', {
                  done: progress.done,
                  total: progress.total,
                })}
              </span>
            )}
          </div>

          {isTextPhase ? (
            <TextPipelineIndicator job={job} items={items} />
          ) : (
            <ProductionPhaseIndicator job={job} />
          )}

          {sourceSummary && (
            <SourceResearchSummary
              sources={sourceSummary}
              compact
              className="rounded-md border border-border/50 bg-background/60 px-2.5 py-2"
            />
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showReviewLink && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={onShowReview}
            >
              {t('guides.production.showReviewQueue', { count: pendingReview })}
            </Button>
          )}
          {showRetry && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={isBusy}
              onClick={() => void onRetry()}
            >
              {t('guides.production.retry')}
            </Button>
          )}
          {showCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={X}
              className="h-8 px-3 text-xs"
              disabled={isBusy}
              onClick={() => void onCancel()}
            >
              {t('guides.production.cancel')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
