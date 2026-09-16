import { ArrowDown, ArrowUp, Info, ListOrdered } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { pathToNavPage } from '@/core/routing/routeMap';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import { RichTextContent } from '@/core/ui/RichTextContent';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import { useClubdesk } from '../hooks/useClubdesk';
import type { Clubdesk } from '../types/clubdesk';

import { ClubdeskDetailHeaderMenus } from './ClubdeskDetailHeaderMenus';
import { PriceListView } from './PriceListView';

interface ClubdeskViewProps {
  clubdesk?: Clubdesk | null;
  item?: Clubdesk | null;
  /** Single-column card stack (e.g. list detail column). */
  stacked?: boolean;
}

export const ClubdeskView: React.FC<ClubdeskViewProps> = (props) => {
  const location = useLocation();
  if (pathToNavPage(location.pathname) === 'clubdesk-price-list') {
    return <PriceListView stacked={props.stacked} />;
  }
  return <ClubdeskGuideView {...props} />;
};

type ClubdeskGuideViewTab = 'information' | 'steps';

const CLUBDESK_GUIDE_VIEW_TABS: ClubdeskGuideViewTab[] = ['information', 'steps'];

function parseClubdeskGuideViewTab(value: string | null): ClubdeskGuideViewTab {
  if (value && CLUBDESK_GUIDE_VIEW_TABS.includes(value as ClubdeskGuideViewTab)) {
    return value as ClubdeskGuideViewTab;
  }
  return 'information';
}

const ClubdeskGuideView: React.FC<ClubdeskViewProps> = ({ clubdesk, item, stacked = false }) => {
  const viewItem = clubdesk ?? item ?? null;
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseClubdeskGuideViewTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: ClubdeskGuideViewTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'information') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );
  const { reorderClubdeskSteps, isSaving } = useClubdesk();

  const steps = viewItem?.steps || [];
  const stepsCount = steps.length > 0 ? steps.length : null;

  const tabs = useMemo(
    () => [
      {
        id: 'information' as const,
        label: t('clubdesk.tabs.information'),
        icon: Info,
        count: null as number | null,
      },
      {
        id: 'steps' as const,
        label: t('clubdesk.tabs.steps'),
        icon: ListOrdered,
        count: stepsCount,
      },
    ],
    [stepsCount, t],
  );

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>
              {tab.label}
              {tab.count != null ? (
                <>
                  {' '}
                  <span className="tabular-nums font-semibold">({tab.count})</span>
                </>
              ) : null}
            </span>
          </Button>
        );
      })}
    </div>
  );

  if (!viewItem) {
    return null;
  }

  const isPublished = viewItem.publicationStatus === 'published';

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.clubdesk-guides')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={ListOrdered}
          className="h-9 w-9 bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {(viewItem.title || '').trim() || '—'}
      </h3>
    </div>
  );

  const informationCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('clubdesk.tabs.information')}
        iconPlugin="clubdesk"
        className="p-6"
        subtleTitle
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
  );

  const stepsCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('clubdesk.tabs.steps')}
        icon={ListOrdered}
        iconPlugin="clubdesk"
        subtleTitle
        className="p-6"
      >
        {steps.length === 0 ? (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('clubdesk.noStepsYet')}</p>
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
  );

  return (
    <DetailLayout gridClassName={stacked ? 'grid-cols-1' : undefined}>
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
        <div className="border-b border-border/50 px-4 py-5">
          <ClubdeskDetailHeaderMenus clubdesk={viewItem} leading={titleLeading} />
          <div className="mt-4">{tabChips}</div>
        </div>
      </Card>
      {activeTab === 'information' ? informationCard : null}
      {activeTab === 'steps' ? stepsCard : null}
    </DetailLayout>
  );
};
