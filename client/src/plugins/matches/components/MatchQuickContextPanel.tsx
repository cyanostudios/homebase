import { Trophy } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BADGE_CHIP_CLASS, QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import { formatMatchScore, type Match } from '../types/match';

import { MatchDetailHeaderMenus } from './MatchDetailHeaderMenus';

function matchLabel(match: Match): string {
  return match.name?.trim() || `${match.home_team} – ${match.away_team}`;
}

export function MatchQuickContextPanel({
  match,
  headerBelow = null,
}: {
  match: Match;
  headerBelow?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const title = matchLabel(match);
  const score = formatMatchScore(match);
  const updatedLabel = match.updated_at
    ? new Date(match.updated_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.match')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={Trophy}
          className="h-9 w-9 bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>{title}</h3>
    </div>
  );

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
      <div className="px-4 py-5">
        <MatchDetailHeaderMenus match={match} leading={titleLeading} />
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {updatedLabel ? (
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                {t('common.updated')} {updatedLabel}
              </p>
            ) : (
              <div className="min-w-0 flex-1" />
            )}
            {score ? (
              <Badge className={cn('shrink-0', BADGE_CHIP_CLASS, QC_STATUS_BADGE_COLORS.success)}>
                {score}
              </Badge>
            ) : null}
          </div>
          {headerBelow}
        </div>
      </div>
    </Card>
  );
}
