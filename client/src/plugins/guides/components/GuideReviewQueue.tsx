import { ChevronRight } from 'lucide-react';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';

import { guidesApi } from '../api/guidesApi';
import type {
  GuideStop,
  GuideVariantPresentation,
  ProductionJob,
  ProductionJobItem,
} from '../types/guides';
import {
  canAdvancePhase,
  countPendingReviewItems,
  getNextPhaseLabelKey,
  getPhaseItems,
  shouldShowReviewQueue,
} from '../utils/productionJobHelpers';
import { GuideReviewItem } from './GuideReviewItem';

export interface GuideReviewQueueHandle {
  scrollIntoView: () => void;
}

interface GuideReviewQueueProps {
  placeId: string;
  job: ProductionJob;
  items: ProductionJobItem[];
  isBusy?: boolean;
  onApproveItem: (itemId: string) => void;
  onRejectItem: (itemId: string) => void;
  onRegenerateItem: (itemId: string) => void;
  onApprovePhase: () => void;
}

export const GuideReviewQueue = forwardRef<GuideReviewQueueHandle, GuideReviewQueueProps>(
  function GuideReviewQueue(
    {
      placeId,
      job,
      items,
      isBusy = false,
      onApproveItem,
      onRejectItem,
      onRegenerateItem,
      onApprovePhase,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [stops, setStops] = useState<GuideStop[]>([]);
    const [variantsByStop, setVariantsByStop] = useState<
      Record<string, GuideVariantPresentation[]>
    >({});
    const [isLoadingMeta, setIsLoadingMeta] = useState(false);

    useImperativeHandle(ref, () => ({
      scrollIntoView: () => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }));

    const phaseItems = useMemo(
      () => getPhaseItems(job, items).filter((item) => item.reviewStatus !== 'superseded'),
      [job, items],
    );
    const phaseItemKey = useMemo(
      () => phaseItems.map((item) => `${item.id}:${item.updatedAt}`).join('|'),
      [phaseItems],
    );
    const pendingCount = countPendingReviewItems(job, items);
    const canContinue = canAdvancePhase(job, items);
    const continueKey = getNextPhaseLabelKey(job);

    const loadMetadata = useCallback(async () => {
      setIsLoadingMeta(true);
      try {
        const stopList = await guidesApi.getStops(placeId);
        setStops(stopList);
        const stopIds = [...new Set(phaseItems.map((item) => item.stopId))];
        const variantEntries = await Promise.all(
          stopIds.map(async (stopId) => {
            const variants = await guidesApi.getVariants(placeId, stopId);
            return [stopId, variants] as const;
          }),
        );
        setVariantsByStop(Object.fromEntries(variantEntries));
      } catch {
        setStops([]);
        setVariantsByStop({});
      } finally {
        setIsLoadingMeta(false);
      }
    }, [phaseItemKey, placeId]);

    useEffect(() => {
      if (!shouldShowReviewQueue(job)) return;
      void loadMetadata();
    }, [job.id, job.status, job.reviewPhase, loadMetadata]);

    if (!shouldShowReviewQueue(job)) {
      return null;
    }

    return (
      <div ref={containerRef}>
        <Card padding="none" className="overflow-hidden border border-border/70 bg-card shadow-sm">
          <DetailSection
            title={t('guides.production.review.queueTitle', { count: pendingCount })}
            icon={ChevronRight}
            iconPlugin="guides"
            className="p-6"
          >
            {isLoadingMeta ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : (
              <ul className="space-y-3">
                {phaseItems.map((item) => {
                  const stop = stops.find((s) => s.id === item.stopId);
                  const variants = variantsByStop[item.stopId] ?? [];
                  const variant = item.variantId
                    ? variants.find((v) => v.id === item.variantId)
                    : undefined;
                  return (
                    <GuideReviewItem
                      key={item.id}
                      item={item}
                      stop={stop}
                      variant={variant}
                      isBusy={isBusy}
                      onApprove={onApproveItem}
                      onReject={onRejectItem}
                      onRegenerate={onRegenerateItem}
                    />
                  );
                })}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-4">
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="h-9 px-3 text-xs"
                disabled={isBusy || !canContinue}
                title={
                  !canContinue && pendingCount > 0
                    ? t('guides.production.review.continueDisabledTooltip', { count: pendingCount })
                    : undefined
                }
                onClick={() => onApprovePhase()}
              >
                {continueKey ? t(continueKey) : t('guides.production.continueNextPhase')}
              </Button>
            </div>
          </DetailSection>
        </Card>
      </div>
    );
  },
);
