import { ArrowDown, ArrowUp, ListOrdered } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { pathToNavPage } from '@/core/routing/routeMap';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { DETAIL_NOTE_CALLOUT_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { useClubdesk } from '../hooks/useClubdesk';
import type { Clubdesk } from '../types/clubdesk';

import { PriceListView } from './PriceListView';

interface ClubdeskViewProps {
  clubdesk?: Clubdesk | null;
  item?: Clubdesk | null;
}

export const ClubdeskView: React.FC<ClubdeskViewProps> = (props) => {
  const location = useLocation();
  if (pathToNavPage(location.pathname) === 'clubdesk-price-list') {
    return <PriceListView />;
  }
  return <ClubdeskGuideView {...props} />;
};

const ClubdeskGuideView: React.FC<ClubdeskViewProps> = ({ clubdesk, item }) => {
  const viewItem = clubdesk ?? item ?? null;
  const { t } = useTranslation();
  const { reorderClubdeskSteps, isSaving } = useClubdesk();

  if (!viewItem) {
    return null;
  }

  const isPublished = viewItem.publicationStatus === 'published';
  const steps = viewItem.steps || [];

  return (
    <DetailLayout>
      <div className="space-y-4">
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={(viewItem.title || '').trim() || '—'}
            iconPlugin="clubdesk"
            className="p-6"
            prominentTitle
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge
                variant={isPublished ? 'default' : 'secondary'}
                className={cn(
                  'text-[10px] font-extrabold',
                  isPublished &&
                    'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200',
                )}
              >
                {isPublished ? t('clubdesk.status.published') : t('clubdesk.status.draft')}
              </Badge>
              {viewItem.category ? (
                <Badge variant="outline" className="text-[10px] font-extrabold">
                  {viewItem.category}
                </Badge>
              ) : null}
              {viewItem.slug ? (
                <span className="font-mono text-xs text-muted-foreground">/{viewItem.slug}</span>
              ) : null}
            </div>

            {!isPublished ? (
              <div className={cn(DETAIL_NOTE_CALLOUT_CLASS, 'mb-3 text-xs text-muted-foreground')}>
                {t('clubdesk.notVisiblePublic')}
              </div>
            ) : null}

            {viewItem.featuredImageUrl ? (
              <img
                src={viewItem.featuredImageUrl}
                alt=""
                width={300}
                height={300}
                className="mb-4 h-[300px] w-[300px] max-w-full rounded-lg object-cover"
              />
            ) : null}

            {viewItem.description ? (
              <div className="text-sm text-foreground">
                <RichTextContent content={viewItem.description} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </DetailSection>
        </Card>

        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('clubdesk.stepsCard')}
            icon={ListOrdered}
            iconPlugin="clubdesk"
            className="p-6"
          >
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('clubdesk.noStepsYet')}</p>
            ) : (
              <ol className="space-y-3">
                {steps.map((step, index) => (
                  <li
                    key={step.id ?? `step-${index}`}
                    className="flex gap-3 rounded-lg border border-border/50 p-3"
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-plugin-subtle text-xs font-semibold text-plugin">
                      {step.sequenceOrder ?? index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{step.title}</div>
                      {step.description ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          <RichTextContent content={step.description} />
                        </div>
                      ) : null}
                    </div>
                    {step.imageUrl ? (
                      <img
                        src={step.imageUrl}
                        alt=""
                        className="h-14 w-14 flex-shrink-0 rounded-md object-cover"
                      />
                    ) : null}
                    <div className="flex flex-shrink-0 flex-col gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={ArrowUp}
                        className="h-8 w-8 px-0"
                        disabled={isSaving || index === 0}
                        aria-label={t('clubdesk.moveStepUp')}
                        onClick={() => void reorderClubdeskSteps(viewItem, index, -1)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={ArrowDown}
                        className="h-8 w-8 px-0"
                        disabled={isSaving || index === steps.length - 1}
                        aria-label={t('clubdesk.moveStepDown')}
                        onClick={() => void reorderClubdeskSteps(viewItem, index, 1)}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </DetailSection>
        </Card>
      </div>
    </DetailLayout>
  );
};
