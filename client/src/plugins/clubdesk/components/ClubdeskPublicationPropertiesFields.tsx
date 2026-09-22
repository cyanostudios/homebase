import { CheckCircle2, FilePenLine, Star, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BADGE_SELECT_ITEM_CLASS,
  BADGE_SELECT_TRIGGER_CLASS,
  QC_STATUS_BADGE_COLORS,
} from '@/core/ui/badgeStyles';
import { DETAIL_PROP_ROW_CLASS } from '@/core/ui/detailViewCardStyles';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import { cn } from '@/lib/utils';

import type { PublicationStatus } from '../types/clubdesk';

export type ClubdeskPublicationPropertiesValues = {
  publicationStatus: PublicationStatus;
  featured: boolean;
  slug?: string | null;
  category?: string | null;
  currency?: string | null;
};

type ClubdeskPublicationPropertiesFieldsProps = {
  values: ClubdeskPublicationPropertiesValues;
  onPublicationStatusChange: (status: PublicationStatus) => void;
  onFeaturedChange: (featured: boolean) => void;
  /** Guides: show category read-row. */
  showCategory?: boolean;
  /** Price lists: show currency read-row. */
  showCurrency?: boolean;
  disabled?: boolean;
  className?: string;
};

function PublicationStatusBadge({ status }: { status: PublicationStatus }) {
  const { t } = useTranslation();
  const isPublished = status === 'published';
  return (
    <StatusOutlineBadge
      icon={isPublished ? CheckCircle2 : FilePenLine}
      className={isPublished ? QC_STATUS_BADGE_COLORS.success : QC_STATUS_BADGE_COLORS.muted}
    >
      {isPublished ? t('clubdesk.status.published') : t('clubdesk.status.draft')}
    </StatusOutlineBadge>
  );
}

function FeaturedBadge({ featured }: { featured: boolean }) {
  const { t } = useTranslation();
  return (
    <StatusOutlineBadge
      icon={featured ? Star : X}
      className={featured ? QC_STATUS_BADGE_COLORS.success : QC_STATUS_BADGE_COLORS.neutral}
    >
      {featured ? t('clubdesk.featuredShort') : t('clubdesk.notFeatured')}
    </StatusOutlineBadge>
  );
}

export function ClubdeskPublicationPropertiesFields({
  values,
  onPublicationStatusChange,
  onFeaturedChange,
  showCategory = false,
  showCurrency = false,
  disabled = false,
  className,
}: ClubdeskPublicationPropertiesFieldsProps) {
  const { t } = useTranslation();
  const status = values.publicationStatus === 'published' ? 'published' : 'draft';
  const featured = values.featured === true;

  return (
    <div className={cn(className)}>
      <div className={DETAIL_PROP_ROW_CLASS}>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {t('clubdesk.publicationStatus')}
        </span>
        <div className="flex shrink-0 justify-end">
          <Select
            value={status}
            onValueChange={(value) => onPublicationStatusChange(value as PublicationStatus)}
            disabled={disabled}
          >
            <SelectTrigger className={cn(BADGE_SELECT_TRIGGER_CLASS, 'h-9 w-full sm:w-[180px]')}>
              <SelectValue>
                <PublicationStatusBadge status={status} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
              <SelectItem value="draft" className={BADGE_SELECT_ITEM_CLASS}>
                <PublicationStatusBadge status="draft" />
              </SelectItem>
              <SelectItem value="published" className={BADGE_SELECT_ITEM_CLASS}>
                <PublicationStatusBadge status="published" />
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={DETAIL_PROP_ROW_CLASS}>
        <span className="text-sm text-slate-500 dark:text-slate-400">{t('clubdesk.featured')}</span>
        <div className="flex shrink-0 justify-end">
          <Select
            value={featured ? 'true' : 'false'}
            onValueChange={(value) => onFeaturedChange(value === 'true')}
            disabled={disabled}
          >
            <SelectTrigger className={cn(BADGE_SELECT_TRIGGER_CLASS, 'h-9 w-full sm:w-[180px]')}>
              <SelectValue>
                <FeaturedBadge featured={featured} />
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-[180px] rounded-xl border-border/50 shadow-xl">
              <SelectItem value="true" className={BADGE_SELECT_ITEM_CLASS}>
                <FeaturedBadge featured />
              </SelectItem>
              <SelectItem value="false" className={BADGE_SELECT_ITEM_CLASS}>
                <FeaturedBadge featured={false} />
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {showCategory ? (
        <div className={DETAIL_PROP_ROW_CLASS}>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t('clubdesk.category')}
          </span>
          <span className="max-w-[180px] truncate text-right text-sm font-extrabold text-foreground">
            {values.category?.trim() || t('clubdesk.categoryNone')}
          </span>
        </div>
      ) : null}

      {showCurrency ? (
        <div className={DETAIL_PROP_ROW_CLASS}>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t('clubdesk.priceList.currency')}
          </span>
          <span className="max-w-[180px] truncate text-right font-mono text-sm font-extrabold text-foreground">
            {values.currency?.trim() || 'SEK'}
          </span>
        </div>
      ) : null}

      <div className={DETAIL_PROP_ROW_CLASS}>
        <span className="text-sm text-slate-500 dark:text-slate-400">{t('clubdesk.slug')}</span>
        <span className="max-w-[180px] truncate text-right font-mono text-xs font-extrabold text-foreground">
          {values.slug ? `/${values.slug}` : '—'}
        </span>
      </div>
    </div>
  );
}
