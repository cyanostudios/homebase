import { Factory, Languages, Loader2, Play, Volume2, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

import { useProductionElapsed } from '../hooks/useProductionElapsed';
import type { ProductionJob, ProductionJobItem } from '../types/guides';
import {
  countPendingReviewItems,
  getTextPipelineStage,
  isProductionJobActive,
  summarizePhaseProgress,
} from '../utils/productionJobHelpers';

interface GuideProductionPanelProps {
  job: ProductionJob | null;
  items: ProductionJobItem[];
  hasActiveJob: boolean;
  isBusy?: boolean;
  sourceHasText?: boolean;
  canGenerateSourceAudio?: boolean;
  isGeneratingSourceAudio?: boolean;
  onStartSource: () => void;
  onStartTranslations: () => void;
  onGenerateSourceAudio?: () => void;
  onShowReview?: () => void;
  onCancel?: () => void;
}

export const GuideProductionPanel: React.FC<GuideProductionPanelProps> = ({
  job,
  items,
  hasActiveJob,
  isBusy = false,
  sourceHasText = false,
  canGenerateSourceAudio = false,
  isGeneratingSourceAudio = false,
  onStartSource,
  onStartTranslations,
  onGenerateSourceAudio,
  onShowReview,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const elapsed = useProductionElapsed(job);

  const active = job && isProductionJobActive(job.status);
  const progress = job ? summarizePhaseProgress(job, items) : null;
  const pendingReview = job ? countPendingReviewItems(job, items) : 0;
  const pipelineStage = job ? getTextPipelineStage(job, items) : null;
  const jobDisabled = isBusy || hasActiveJob;
  const audioDisabled =
    jobDisabled || isGeneratingSourceAudio || !canGenerateSourceAudio || !onGenerateSourceAudio;

  return (
    <>
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('guides.production.panelTitle')}
          icon={Factory}
          iconPlugin="guides"
          className="p-4"
        >
          <div className="space-y-3 text-xs">
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Play}
              className="h-9 w-full justify-start px-3 text-xs"
              disabled={jobDisabled || isGeneratingSourceAudio}
              onClick={onStartSource}
            >
              {t('guides.production.generateSource')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={Languages}
              className="h-9 w-full justify-start px-3 text-xs"
              disabled={jobDisabled || isGeneratingSourceAudio || !sourceHasText}
              onClick={onStartTranslations}
            >
              {t('guides.production.generateTranslations')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={isGeneratingSourceAudio ? Loader2 : Volume2}
              className={
                isGeneratingSourceAudio
                  ? 'h-9 w-full justify-start px-3 text-xs [&_svg]:animate-spin'
                  : 'h-9 w-full justify-start px-3 text-xs'
              }
              disabled={audioDisabled}
              onClick={() => onGenerateSourceAudio?.()}
            >
              {isGeneratingSourceAudio
                ? t('guides.production.generatingSourceAudio')
                : t('guides.production.generateSourceAudio')}
            </Button>
            {!active && !hasActiveJob && (
              <p className="text-muted-foreground">{t('guides.production.panelIdleHint')}</p>
            )}
            {!sourceHasText && !hasActiveJob && (
              <p className="text-muted-foreground">
                {t('guides.production.translationsNeedSource')}
              </p>
            )}
            {sourceHasText && !canGenerateSourceAudio && !hasActiveJob && (
              <p className="text-muted-foreground">
                {t('guides.production.sourceAudioNeedsApproval')}
              </p>
            )}

            {active && job && (
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <div className="font-medium text-foreground">
                    {t('guides.production.panelActive')}
                  </div>
                  {elapsed && (
                    <div className="font-mono tabular-nums text-muted-foreground" aria-hidden>
                      {t('guides.production.elapsed', { time: elapsed })}
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-muted-foreground">
                  {pipelineStage && ['research', 'generate', 'review'].includes(pipelineStage) && (
                    <div>
                      {t('guides.production.panelPhase', {
                        phase: t(`guides.production.pipeline.${pipelineStage}`),
                      })}
                    </div>
                  )}
                  <div>{t('guides.production.jobLabel', { id: job.id })}</div>
                  {progress && progress.total > 0 && (
                    <div>
                      {t('guides.production.progress', {
                        done: progress.done,
                        total: progress.total,
                      })}
                    </div>
                  )}
                  {job.status === 'awaiting_review' && pendingReview > 0 && (
                    <div>{t('guides.production.panelAwaitingYou', { count: pendingReview })}</div>
                  )}
                </div>

                {job.status === 'awaiting_review' && pendingReview > 0 && onShowReview && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 w-full justify-start px-3 text-xs"
                    onClick={onShowReview}
                  >
                    {t('guides.production.showReviewQueue', { count: pendingReview })}
                  </Button>
                )}

                {onCancel && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={X}
                    className="h-8 w-full justify-start px-3 text-xs text-red-600 dark:text-red-400"
                    disabled={isBusy}
                    onClick={() => setCancelOpen(true)}
                  >
                    {t('guides.production.cancelJob')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </DetailSection>
      </Card>

      <ConfirmDialog
        isOpen={cancelOpen}
        title={t('guides.production.cancelJobTitle')}
        message={t('guides.production.cancelJobDescription')}
        confirmText={t('guides.production.cancel')}
        cancelText={t('common.cancel')}
        variant="danger"
        confirmDisabled={isBusy}
        onConfirm={() => {
          setCancelOpen(false);
          onCancel?.();
        }}
        onCancel={() => setCancelOpen(false)}
      />
    </>
  );
};
