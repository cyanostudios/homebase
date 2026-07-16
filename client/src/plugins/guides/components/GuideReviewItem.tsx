import { Check, Loader2, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { GuideStop, GuideVariantPresentation, ProductionJobItem } from '../types/guides';
import { isProductionReviewStatus } from '../types/guides';
import { getProposedItemText } from '../utils/productionJobHelpers';

interface GuideReviewItemProps {
  item: ProductionJobItem;
  stop?: GuideStop;
  variant?: GuideVariantPresentation;
  isBusy?: boolean;
  onApprove: (itemId: string) => void;
  onReject: (itemId: string) => void;
  onRegenerate: (itemId: string) => void;
}

function itemLabel(
  stop: GuideStop | undefined,
  variant: GuideVariantPresentation | undefined,
  t: (key: string, opts?: Record<string, string>) => string,
): string {
  const stopTitle = stop?.title ?? '—';
  if (!variant) return stopTitle;
  const variantType = t(`guides.variantTypes.${variant.variantType}`);
  return `${stopTitle} · ${variantType} · ${variant.language}`;
}

export const GuideReviewItem: React.FC<GuideReviewItemProps> = ({
  item,
  stop,
  variant,
  isBusy = false,
  onApprove,
  onReject,
  onRegenerate,
}) => {
  const { t } = useTranslation();
  const label = itemLabel(stop, variant, t);
  const reviewStatus = isProductionReviewStatus(item.reviewStatus ?? '')
    ? item.reviewStatus
    : 'pending_review';
  const proposed = getProposedItemText(item);
  const current = variant?.presentationText ?? null;
  const isProcessing = ['pending', 'queued', 'processing', 'awaiting_callback'].includes(
    item.status,
  );
  const isFailed = item.status === 'failed';

  if (reviewStatus === 'superseded') {
    return null;
  }

  const compact =
    reviewStatus === 'approved' || reviewStatus === 'rejected' || isProcessing || isFailed;

  return (
    <li
      className={cn(
        'rounded-lg border border-border/70 bg-card p-4',
        reviewStatus === 'approved' &&
          'border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10',
        reviewStatus === 'rejected' && 'bg-muted/20',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            {reviewStatus === 'approved' && (
              <Badge
                variant="secondary"
                className="gap-1 text-[10px] text-emerald-700 dark:text-emerald-400"
              >
                <Check className="h-3 w-3" aria-hidden />
                {t('guides.production.review.approved')}
              </Badge>
            )}
            {reviewStatus === 'rejected' && (
              <Badge variant="outline" className="text-[10px]">
                {t('guides.production.review.rejected')}
              </Badge>
            )}
            {isProcessing && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                {t('guides.production.review.regenerating')}
              </Badge>
            )}
            {isFailed && (
              <Badge variant="outline" className="text-[10px] text-destructive">
                {t('guides.production.review.failed')}
              </Badge>
            )}
          </div>

          {!compact && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('guides.production.review.current')}
                </div>
                <p className="whitespace-pre-wrap text-sm">
                  {current?.trim() ? current : t('guides.production.review.emptyCurrent')}
                </p>
              </div>
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('guides.production.review.proposed')}
                </div>
                <p className="whitespace-pre-wrap text-sm">
                  {proposed?.trim() ? proposed : t('guides.production.review.emptyProposed')}
                </p>
              </div>
            </div>
          )}

          {isFailed && item.errorMessage && (
            <p className="text-xs text-destructive">{item.errorMessage}</p>
          )}
        </div>

        {!compact && reviewStatus === 'pending_review' && item.status === 'completed' && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={ThumbsUp}
              className="h-8 px-3 text-xs"
              disabled={isBusy}
              aria-label={t('guides.production.review.approveAria', { label })}
              onClick={() => onApprove(item.id)}
            >
              {t('guides.production.review.approve')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={ThumbsDown}
              className="h-8 px-3 text-xs"
              disabled={isBusy}
              aria-label={t('guides.production.review.rejectAria', { label })}
              onClick={() => onReject(item.id)}
            >
              {t('guides.production.review.reject')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              className="h-8 px-3 text-xs"
              disabled={isBusy}
              aria-label={t('guides.production.review.regenerateAria', { label })}
              onClick={() => onRegenerate(item.id)}
            >
              {t('guides.production.review.regenerate')}
            </Button>
          </div>
        )}

        {(isProcessing || isFailed) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            className="h-8 px-3 text-xs"
            disabled={isBusy || isProcessing}
            onClick={() => onRegenerate(item.id)}
          >
            {t('guides.production.review.regenerate')}
          </Button>
        )}
      </div>
    </li>
  );
};
