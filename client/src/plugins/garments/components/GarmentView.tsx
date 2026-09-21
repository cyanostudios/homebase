import { Shirt, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';
import { SeriesTeamBadge } from '@/plugins/teams/components/ResponsibleRow';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import {
  SERIES_TEAM_BADGE_NEUTRAL_STYLE,
  TEAM_COLORS,
  TEAM_HEADER_BADGE_CLASS,
  type TeamColor,
} from '@/plugins/teams/types/teams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useGarments } from '../hooks/useGarments';
import type { GarmentList, InventoryItem } from '../types/garments';

import { GarmentListDetailHeaderMenus } from './GarmentDetailHeaderMenus';
import { GarmentShareBlock } from './GarmentShareBlock';
import { InventoryQuickContextPanel } from './InventoryQuickContextPanel';
import { PersonMatrix } from './PersonMatrix';

interface GarmentViewProps {
  garment?: GarmentList | null;
  item?: GarmentList | null;
  inventoryItem?: InventoryItem | null;
  /** Single-column card stack (e.g. list detail column). */
  stacked?: boolean;
}

export const GarmentView: React.FC<GarmentViewProps> = ({
  garment,
  item,
  inventoryItem,
  stacked = false,
}) => {
  const { t } = useTranslation();
  const { panelKind, currentInventoryItem, updateInventoryVariantQuantity, isSaving } =
    useGarments();
  const { teams } = useTeams();

  const inv =
    inventoryItem ??
    (panelKind === 'inventory' ? currentInventoryItem : null) ??
    (!garment && !item ? currentInventoryItem : null);

  if (inv) {
    return (
      <InventoryQuickContextPanel
        item={inv}
        onVariantQuantityChange={async (variantId, quantity) => {
          await updateInventoryVariantQuantity(inv.id, variantId, quantity);
        }}
        quantitySaving={isSaving}
      />
    );
  }

  const list = garment ?? item;
  if (!list) {
    return null;
  }

  const matchedTeam = list.teamId
    ? teams.find((team) => String(team.id) === String(list.teamId))
    : undefined;
  const teamColor: TeamColor | null =
    matchedTeam?.color && TEAM_COLORS.includes(matchedTeam.color as TeamColor)
      ? (matchedTeam.color as TeamColor)
      : null;
  const teamLabel = matchedTeam ? formatTeamLabel(matchedTeam) || matchedTeam.name : null;
  const personCount = list.personCount ?? list.persons?.length ?? 0;

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.garments-lists')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={Shirt}
          className="h-8 w-8 bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {list.name || '—'}
      </h3>
    </div>
  );

  if (stacked) {
    return (
      <div className="min-w-0 space-y-4">
        <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'min-w-0 overflow-hidden')}>
          <div className="border-b border-border/50 px-4 py-5">
            <GarmentListDetailHeaderMenus list={list} leading={titleLeading} />
          </div>
          <div className="min-w-0 px-4 pb-4 pt-1 md:px-6 md:pb-6">
            <PersonMatrix key={list.id} list={list} />
          </div>
        </Card>
        <GarmentShareBlock list={list} />
      </div>
    );
  }

  return (
    <DetailLayout>
      <div className="min-w-0 space-y-4">
        <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'min-w-0 overflow-hidden')}>
          <div className="px-4 pb-2 pt-4 md:px-6 md:pt-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0')}>{list.name || '—'}</h2>
              {teamLabel ? (
                <SeriesTeamBadge label={teamLabel} color={teamColor} size="header" />
              ) : null}
              <span
                className={cn(
                  'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full font-medium',
                  TEAM_HEADER_BADGE_CLASS,
                  SERIES_TEAM_BADGE_NEUTRAL_STYLE,
                )}
              >
                <Users className="h-3.5 w-3.5" aria-hidden />
                <span>{t('garments.personCount', { count: personCount })}</span>
              </span>
            </div>
          </div>
          <div className="min-w-0 px-4 pb-4 pt-1 md:px-6 md:pb-6">
            <PersonMatrix key={list.id} list={list} />
          </div>
        </Card>

        <GarmentShareBlock list={list} />
      </div>
    </DetailLayout>
  );
};
