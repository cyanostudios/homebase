import { Edit, Info, Languages, ListOrdered, MapPin, Receipt, Trash2 } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import { useGuides } from '../hooks/useGuides';
import { useProductionJob } from '../hooks/useProductionJob';
import { GuideProductionPanel } from './GuideProductionPanel';
import { GuideReviewQueue, type GuideReviewQueueHandle } from './GuideReviewQueue';
import { GuideStopsSection } from './GuideStopsSection';
import { ProductionJobHistory } from './ProductionJobHistory';
import { ProductionPhaseBanner } from './ProductionPhaseBanner';
import { StartProductionDialog } from './StartProductionDialog';
import {
  isMasterGuideEditorialStatus,
  type Guide,
  type GuideLifecycleStatus,
  type ProductionStartScope,
} from '../types/guides';
import { isProductionJobActive, resolveSourceSummary } from '../utils/productionJobHelpers';
import { SourceResearchSummary } from './SourceResearchSummary';

interface GuideViewProps {
  guide?: Guide;
  item?: Guide;
}

export const GuideView: React.FC<GuideViewProps> = ({ guide, item }) => {
  const { t } = useTranslation();
  const { openGuideForEdit, deleteGuide } = useGuides();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [startScope, setStartScope] = useState<ProductionStartScope>({ type: 'full_guide' });
  const reviewQueueRef = useRef<GuideReviewQueueHandle>(null);
  const actualGuide = guide || item;
  const production = useProductionJob(actualGuide?.id ?? '');
  if (!actualGuide) return null;

  const editorialStatus = isMasterGuideEditorialStatus(actualGuide.masterGuideEditorialStatus)
    ? actualGuide.masterGuideEditorialStatus
    : 'draft';

  const lifecycleLabel = (status: GuideLifecycleStatus) => t(`guides.lifecycle.${status}`);

  const handleDeleteConfirm = () => {
    setDeleteOpen(false);
    void deleteGuide(actualGuide.id);
  };

  const openStartDialog = (scope: ProductionStartScope) => {
    setStartScope(scope);
    setStartDialogOpen(true);
  };

  const handleStartConfirm = async (options: { force: boolean }) => {
    const ok = await production.startJob(startScope, options);
    if (ok) {
      production.clearFailure();
      setStartDialogOpen(false);
    }
  };

  const handleStartRetry = async () => {
    const ok = await production.startJob(startScope, { force: false });
    if (ok) {
      production.clearFailure();
      setStartDialogOpen(false);
    }
  };

  const usage = production.usageSummary;
  const sourceSummary = resolveSourceSummary(usage?.sources, production.job);
  const showUsageCard = Boolean(usage) || Boolean(sourceSummary);

  const showBanner =
    production.job &&
    (isProductionJobActive(production.job.status) ||
      production.job.status === 'completed' ||
      production.job.status === 'failed');

  return (
    <div className="plugin-guides min-h-full bg-background px-4 py-5 sm:px-5 sm:py-6">
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <GuideProductionPanel
              job={production.job}
              items={production.items}
              hasActiveJob={production.hasActiveJob}
              isBusy={production.isBusy}
              onStartFullGuide={() => openStartDialog({ type: 'full_guide' })}
              onShowReview={() => reviewQueueRef.current?.scrollIntoView()}
              onCancel={() => void production.cancelJob()}
            />

            <ProductionJobHistory
              jobs={production.jobs}
              selectedJobId={production.selectedJobId}
              onSelectJob={production.selectJob}
            />

            <Card
              padding="none"
              className="overflow-hidden border border-border/70 bg-card shadow-sm"
            >
              <DetailSection
                title={t('guides.quickActions')}
                icon={Edit}
                iconPlugin="guides"
                className="p-4"
              >
                <div className="flex flex-col items-start gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Edit}
                    className="h-9 justify-start rounded-md px-3 text-xs"
                    onClick={() => openGuideForEdit(actualGuide)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => setDeleteOpen(true)}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </DetailSection>
            </Card>

            <Card
              padding="none"
              className="overflow-hidden border border-border/70 bg-card shadow-sm"
            >
              <DetailSection
                title={t('guides.information')}
                icon={Info}
                iconPlugin="guides"
                className="p-4"
              >
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('guides.colId')}</span>
                    <span className="font-mono">
                      {formatDisplayNumber('guides', actualGuide.id)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('guides.masterGuideId')}</span>
                    <span className="font-mono">{actualGuide.masterGuideId ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('common.created')}</span>
                    <span>{formatDate(actualGuide.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('common.updated')}</span>
                    <span>{formatDate(actualGuide.updatedAt)}</span>
                  </div>
                </div>
              </DetailSection>
            </Card>

            {showUsageCard && (
              <Card
                padding="none"
                className="overflow-hidden border border-border/70 bg-card shadow-sm"
              >
                <DetailSection title={t('guides.usage.title')} icon={Receipt} className="p-4">
                  <div className="space-y-3 text-xs">
                    {usage && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            {t('guides.usage.provider')}
                          </span>
                          <span>{usage.provider ?? '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{t('guides.usage.model')}</span>
                          <span className="font-mono">{usage.model ?? '—'}</span>
                        </div>
                        <div className="border-t border-border/50 pt-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {t('guides.usage.inputTokens')}
                            </span>
                            <span>{usage.inputTokens.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {t('guides.usage.outputTokens')}
                            </span>
                            <span>{usage.outputTokens.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {t('guides.usage.totalTokens')}
                            </span>
                            <span>{usage.totalTokens.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="border-t border-border/50 pt-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {t('guides.usage.estCost')}
                            </span>
                            <span>
                              {usage.estimatedCost
                                ? `~${usage.estimatedCost.totalCost.toFixed(4)} ${usage.estimatedCost.currency}`
                                : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {t('guides.usage.latency')}
                            </span>
                            <span>
                              {usage.latencyMs > 0
                                ? `${(usage.latencyMs / 1000).toFixed(1)} s`
                                : '—'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                    {sourceSummary && (
                      <div className={usage ? 'border-t border-border/50 pt-3' : undefined}>
                        <SourceResearchSummary sources={sourceSummary} />
                      </div>
                    )}
                    {usage && (
                      <p className="text-[10px] text-muted-foreground">
                        {t('guides.usage.estimatedNote')}
                      </p>
                    )}
                  </div>
                </DetailSection>
              </Card>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {production.error && (
            <p className="text-sm text-destructive" role="alert">
              {production.error}
            </p>
          )}

          {showBanner && production.job && (
            <ProductionPhaseBanner
              job={production.job}
              items={production.items}
              isPolling={production.isPolling}
              isBusy={production.isBusy}
              onCancel={() => void production.cancelJob()}
              onRetry={() => void production.retryJob()}
              onShowReview={() => reviewQueueRef.current?.scrollIntoView()}
            />
          )}

          {production.job && (
            <GuideReviewQueue
              ref={reviewQueueRef}
              placeId={actualGuide.id}
              job={production.job}
              items={production.items}
              isBusy={production.isBusy}
              onApproveItem={(id) => void production.approveItem(id)}
              onRejectItem={(id) => void production.rejectItem(id)}
              onRegenerateItem={(id) => void production.regenerateItem(id)}
              onApprovePhase={() => void production.approvePhase()}
            />
          )}

          <Card
            padding="none"
            className="overflow-hidden border border-border/70 bg-card shadow-sm"
          >
            <DetailSection
              title={t('guides.details')}
              icon={MapPin}
              iconPlugin="guides"
              className="p-6"
            >
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('guides.displayName')}
                  </div>
                  <div className="text-lg font-semibold">{actualGuide.displayName}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{lifecycleLabel(actualGuide.lifecycleStatus)}</Badge>
                </div>

                <div className="border-t border-border/50 pt-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('guides.shortIntro')}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{actualGuide.shortIntro ?? '—'}</div>
                </div>

                <div className="border-t border-border/50 pt-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('guides.place.label')}
                  </div>
                  <div className="text-sm">
                    {actualGuide.place?.displayName ||
                      actualGuide.place?.formattedAddress ||
                      actualGuide.geographicReference ||
                      '—'}
                  </div>
                  {actualGuide.place?.formattedAddress &&
                    actualGuide.place.displayName &&
                    actualGuide.place.formattedAddress !== actualGuide.place.displayName && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {actualGuide.place.formattedAddress}
                      </div>
                    )}
                </div>
              </div>
            </DetailSection>
          </Card>

          <Card
            padding="none"
            className="overflow-hidden border border-border/70 bg-card shadow-sm"
          >
            <DetailSection
              title={t('guides.masterGuide')}
              icon={Languages}
              iconPlugin="guides"
              className="p-6"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="uppercase">
                    {actualGuide.sourceLanguage}
                  </Badge>
                  <Badge variant="secondary">{t(`guides.editorial.${editorialStatus}`)}</Badge>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('guides.sourceLanguage')}
                    </div>
                    <div className="mt-1 uppercase">{actualGuide.sourceLanguage}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('guides.masterGuideEditorialStatus')}
                    </div>
                    <div className="mt-1">{t(`guides.editorial.${editorialStatus}`)}</div>
                  </div>
                </div>
              </div>
            </DetailSection>
          </Card>

          <Card
            padding="none"
            className="overflow-hidden border border-border/70 bg-card shadow-sm"
          >
            <DetailSection
              title={t('guides.guideStops')}
              icon={ListOrdered}
              iconPlugin="guides"
              className="p-6"
            >
              <GuideStopsSection
                placeId={actualGuide.id}
                sourceLanguage={actualGuide.sourceLanguage}
                hasActiveProductionJob={production.hasActiveJob}
                productionBusy={production.isBusy}
                onStartStopProduction={(stop) =>
                  openStartDialog({
                    type: 'stop',
                    stopId: stop.id,
                    stopTitle: stop.title,
                  })
                }
                onStartVariantProduction={(stopId, variant) =>
                  openStartDialog({
                    type: 'variant',
                    stopId,
                    variantId: variant.id,
                    variantLabel: `${variant.variantType}/${variant.language}`,
                  })
                }
              />
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>

      <StartProductionDialog
        isOpen={startDialogOpen}
        scope={startScope}
        isBusy={production.isBusy}
        hasActiveJob={production.hasActiveJob}
        failureCode={production.failureCode}
        onConfirm={(options) => void handleStartConfirm(options)}
        onRetry={() => void handleStartRetry()}
        onClearFailure={production.clearFailure}
        onCancel={() => {
          production.clearFailure();
          setStartDialogOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        title={t('guides.deletePlaceTitle')}
        message={t('guides.deletePlaceDescription', { name: actualGuide.displayName })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
};
