import { Layers, SlidersHorizontal, Users } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import {
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
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
import { findDuplicateVariantIndices } from '../utils/inventoryValidation';
import {
  VARIANT_LIST_ROW_CLASS,
  VARIANT_WARNING_DOT_CLASS,
  VARIANT_WARNING_DOT_PLACEHOLDER_CLASS,
} from '../utils/variantListStyles';

import { GarmentShareBlock } from './GarmentShareBlock';
import { InventoryListAssignmentCheckboxes } from './InventoryListAssignmentCheckboxes';
import { VariantQuantityEditor } from './InventoryQuickContextPanel';
import { PersonMatrix } from './PersonMatrix';

interface GarmentViewProps {
  garment?: GarmentList | null;
  item?: GarmentList | null;
}

function formatPurchasePrice(price: number | null | undefined, currency: string): string {
  if (price == null || Number.isNaN(price)) {
    return '—';
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'SEK',
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency || 'SEK'}`;
  }
}

function InventoryDetailView({ item }: { item: InventoryItem }) {
  const { t } = useTranslation();
  const { updateInventoryVariantQuantity, isSaving } = useGarments();

  const description = item.description?.trim() || '';
  const comment = item.comment?.trim() || '';
  const material = item.material?.trim() || '';
  const variants = item.variants || [];
  const duplicateVariantIndices = useMemo(() => findDuplicateVariantIndices(variants), [variants]);

  const propertyRows: { label: string; value: string }[] = [
    { label: t('garments.brand'), value: item.brand?.trim() || '—' },
    {
      label: t('garments.purchasePrice'),
      value: formatPurchasePrice(item.purchasePrice, item.currency || 'SEK'),
    },
    ...(item.recommendedPrice != null && !Number.isNaN(item.recommendedPrice)
      ? [
          {
            label: t('garments.recommendedPrice'),
            value: formatPurchasePrice(item.recommendedPrice, item.currency || 'SEK'),
          },
        ]
      : []),
    ...(item.salePrice != null && !Number.isNaN(item.salePrice)
      ? [
          {
            label: t('garments.salePrice'),
            value: formatPurchasePrice(item.salePrice, item.currency || 'SEK'),
          },
        ]
      : []),
    { label: t('garments.totalQuantity'), value: String(item.totalQuantity ?? 0) },
    {
      label: t('garments.variantCount'),
      value: String(item.variantCount ?? variants.length),
    },
    ...(material ? [{ label: t('garments.material'), value: material }] : []),
  ];

  return (
    <DetailLayout
      gridClassName="grid-cols-1 lg:grid-cols-2"
      leftSidebar={
        <div className="space-y-4">
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <div className="border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                  aria-hidden
                >
                  {(item.articleName || '—').trim().slice(0, 2).toUpperCase()}
                </div>
                <h2 className={cn('min-w-0 flex-1', PLUGIN_PAGE_TITLE_CLASS)}>
                  {item.articleName || '—'}
                </h2>
              </div>
            </div>
            <DetailSection
              title={t('garments.details')}
              icon={SlidersHorizontal}
              subtleTitle
              className="p-4"
            >
              <div className="space-y-4">
                <div className="space-y-0">
                  {propertyRows.map((row) => (
                    <div key={row.label} className={DETAIL_PROP_ROW_CLASS}>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {row.label}
                      </span>
                      <span className={cn(DETAIL_FIELD_VALUE_CLASS, 'sm:text-right')}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                {description ? (
                  <div>
                    <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.description')}</div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{description}</p>
                  </div>
                ) : null}
                {comment ? (
                  <div>
                    <div className={DETAIL_FIELD_LABEL_CLASS}>{t('garments.comment')}</div>
                    <div className={DETAIL_NOTE_CALLOUT_CLASS}>
                      <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                        {comment}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </DetailSection>
          </Card>
          <InventoryListAssignmentCheckboxes itemId={item.id} />
        </div>
      }
    >
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('garments.variants')}
          icon={Layers}
          subtleTitle
          className="p-4 sm:p-5"
        >
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('garments.noVariantsYet')}</p>
          ) : (
            <div className="space-y-1">
              {duplicateVariantIndices.identity.size > 0 ? (
                <p className="text-sm text-destructive">
                  {t('garments.variantIdentityDuplicateWarning')}
                </p>
              ) : null}
              {duplicateVariantIndices.sku.size > 0 ? (
                <p className="text-sm text-destructive">
                  {t('garments.variantSkuDuplicateWarning')}
                </p>
              ) : null}
              {variants.map((row, index) => {
                const rowDup = duplicateVariantIndices.any.has(index);
                const label =
                  [row.audience?.trim(), row.color?.trim(), row.size?.trim()]
                    .filter(Boolean)
                    .join(' · ') ||
                  row.sku?.trim() ||
                  '—';
                const sku = row.sku?.trim() || '';
                const showSkuSuffix = sku && label !== sku;
                return (
                  <div key={row.id} className={VARIANT_LIST_ROW_CLASS}>
                    <span
                      className={
                        rowDup ? VARIANT_WARNING_DOT_CLASS : VARIANT_WARNING_DOT_PLACEHOLDER_CLASS
                      }
                      aria-hidden={!rowDup}
                      title={rowDup ? t('garments.variantIdentityDuplicateWarning') : undefined}
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="min-w-0 flex-1 truncate text-xs">
                        <span className="font-semibold text-foreground">{label}</span>
                        {showSkuSuffix ? (
                          <span
                            className={cn(
                              'text-muted-foreground',
                              duplicateVariantIndices.sku.has(index) && 'text-destructive',
                            )}
                          >
                            {' · '}
                            {sku}
                          </span>
                        ) : null}
                      </div>
                      <VariantQuantityEditor
                        variant={row}
                        disabled={isSaving}
                        onQuantityChange={async (variantId, quantity) => {
                          await updateInventoryVariantQuantity(item.id, variantId, quantity);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DetailSection>
      </Card>
    </DetailLayout>
  );
}

export const GarmentView: React.FC<GarmentViewProps> = ({ garment, item }) => {
  const { t } = useTranslation();
  const { panelKind, currentInventoryItem } = useGarments();
  const { teams } = useTeams();

  if (panelKind === 'inventory') {
    if (!currentInventoryItem) {
      return null;
    }
    return <InventoryDetailView item={currentInventoryItem} />;
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
            <PersonMatrix list={list} />
          </div>
        </Card>

        <GarmentShareBlock list={list} />
      </div>
    </DetailLayout>
  );
};
