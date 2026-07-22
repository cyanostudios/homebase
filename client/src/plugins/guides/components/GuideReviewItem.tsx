import { Check, Loader2, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { GuidePresentation, ProductionJobItem } from '../types/guides';
import {
  GUIDE_ITEM_FAILED_BADGE_CLASS,
  GUIDE_ITEM_PROCESSING_BADGE_CLASS,
  GUIDE_LANGUAGE_BADGE_CLASS,
  GUIDE_REVIEW_STATUS_COLORS,
  isProductionReviewStatus,
} from '../types/guides';
import { getProposedItemText } from '../utils/productionJobHelpers';

interface GuideReviewItemProps {
  item: ProductionJobItem;
  presentation?: GuidePresentation;
  isBusy?: boolean;
  onApprove: (itemId: string) => void;
  onReject: (itemId: string) => void;
  onRegenerate: (itemId: string) => void;
}

function itemLabel(
  presentation: GuidePresentation | undefined,
  t: (key: string) => string,
): string {
  if (!presentation) return t('guides.production.review.unknownLanguage');
  return presentation.language.toUpperCase();
}

export const GuideReviewItem: React.FC<GuideReviewItemProps> = ({
  item,
  presentation,
  isBusy = false,
  onApprove,
  onReject,
  onRegenerate,
}) => {
  const { t } = useTranslation();
  const label = itemLabel(presentation, t);
  const reviewStatus = isProductionReviewStatus(item.reviewStatus ?? '')
    ? item.reviewStatus
    : 'pending_review';
  const proposed = getProposedItemText(item);
  const current = presentation?.presentationText ?? null;
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
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={GUIDE_LANGUAGE_BADGE_CLASS}>{label}</Badge>
            {reviewStatus === 'approved' && (
              <Badge className={cn(GUIDE_REVIEW_STATUS_COLORS.approved, 'gap-1')}>
                <Check className="h-3 w-3" aria-hidden />
                {t('guides.production.review.approved')}
              </Badge>
            )}
            {reviewStatus === 'rejected' && (
              <Badge className={GUIDE_REVIEW_STATUS_COLORS.rejected}>
                {t('guides.production.review.rejected')}
              </Badge>
            )}
            {isProcessing && (
              <Badge className={GUIDE_ITEM_PROCESSING_BADGE_CLASS}>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                {t('guides.production.review.regenerating')}
              </Badge>
            )}
            {isFailed && (
              <Badge className={GUIDE_ITEM_FAILED_BADGE_CLASS}>
                {t('guides.production.review.failed')}
              </Badge>
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

        {!compact && (
          <div className="flex flex-col gap-3">
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
    </li>
  );
};
