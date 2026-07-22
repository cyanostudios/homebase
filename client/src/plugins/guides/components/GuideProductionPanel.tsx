import { Factory, Languages, Play, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

import type { ProductionJob, ProductionJobItem } from '../types/guides';
import {
  countPendingReviewItems,
  getTextPipelineStage,
  isProductionJobActive,
  summarizePhaseProgress,
} from '../utils/productionJobHelpers';
import { ContentSourcesSettings } from './ContentSourcesSettings';

interface GuideProductionPanelProps {
  job: ProductionJob | null;
  items: ProductionJobItem[];
  hasActiveJob: boolean;
  isBusy?: boolean;
  sourceHasText?: boolean;
  onStartSource: () => void;
  onStartTranslations: () => void;
  onShowReview?: () => void;
  onCancel?: () => void;
}

export const GuideProductionPanel: React.FC<GuideProductionPanelProps> = ({
  job,
  items,
  hasActiveJob,
  isBusy = false,
  sourceHasText = false,
  onStartSource,
  onStartTranslations,
  onShowReview,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [showSources, setShowSources] = React.useState(false);

  const active = job && isProductionJobActive(job.status);
  const progress = job ? summarizePhaseProgress(job, items) : null;
  const pendingReview = job ? countPendingReviewItems(job, items) : 0;
  const pipelineStage = job ? getTextPipelineStage(job, items) : null;
  const jobDisabled = isBusy || hasActiveJob;

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
              disabled={jobDisabled}
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
              disabled={jobDisabled || !sourceHasText}
              onClick={onStartTranslations}
            >
              {t('guides.production.generateTranslations')}
            </Button>
            {!active && !hasActiveJob && (
              <p className="text-muted-foreground">{t('guides.production.panelIdleHint')}</p>
            )}
            {!sourceHasText && !hasActiveJob && (
              <p className="text-muted-foreground">
                {t('guides.production.translationsNeedSource')}
              </p>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start px-3 text-xs"
              onClick={() => setShowSources((v) => !v)}
            >
              {showSources
                ? t('guides.contentSources.hideLink')
                : t('guides.contentSources.showLink')}
            </Button>

            {active && job && (
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="font-medium text-foreground">
                  {t('guides.production.panelActive')}
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

      {showSources && (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <ContentSourcesSettings />
        </Card>
      )}

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
