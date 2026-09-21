import {
  Download,
  Eye,
  EyeOff,
  Globe,
  History,
  Info,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trophy,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailHeaderMetaRow } from '@/core/ui/DetailHeaderMenus';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_INFO_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import { cn } from '@/lib/utils';
import { ingestApi } from '@/plugins/ingest/api/ingestApi';
import type { IngestSource } from '@/plugins/ingest/types/ingest';

import { useCups } from '../hooks/useCups';
import type { Cup } from '../types/cups';

import { CupDetailHeaderMenus } from './CupDetailHeaderMenus';
import { CupPropertiesFields } from './CupPropertiesFields';
import { CupRatings } from './CupRatings';

type CupViewTab = 'information' | 'ratings' | 'ingest' | 'activity';

const CUP_VIEW_TABS: CupViewTab[] = ['information', 'ratings', 'ingest', 'activity'];

function parseCupViewTab(value: string | null): CupViewTab {
  if (value === 'properties') {
    return 'information';
  }
  if (value && CUP_VIEW_TABS.includes(value as CupViewTab)) {
    return value as CupViewTab;
  }
  return 'information';
}

export function CupView({
  cup,
  item,
  stacked: _stacked = false,
}: {
  cup?: Cup | null;
  item?: Cup | null;
  /** Single-column card stack (e.g. list detail column). */
  stacked?: boolean;
}) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseCupViewTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: CupViewTab) => {
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
  const current = cup ?? item ?? null;
  const {
    restoreCup,
    quickEditDraft,
    setQuickEditField,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    onDiscardQuickEditAndClose,
  } = useCups();
  const [isRestoring, setIsRestoring] = useState(false);
  const [ingestSources, setIngestSources] = useState<IngestSource[]>([]);

  useEffect(() => {
    let cancelled = false;
    ingestApi
      .getSources()
      .then((sources) => {
        if (!cancelled) {
          setIngestSources(sources);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const ingestSourceName = (id: string | null | undefined): string => {
    if (!id) {
      return '—';
    }
    const source = ingestSources.find((s) => String(s.id) === String(id));
    return source?.name ?? String(id);
  };

  const handleRestore = async () => {
    if (!current) {
      return;
    }
    setIsRestoring(true);
    try {
      await restoreCup(current.id);
    } finally {
      setIsRestoring(false);
    }
  };

  const displayCup = useMemo(() => {
    if (!current) {
      return null;
    }
    return {
      ...current,
      visible: quickEditDraft?.visible ?? current.visible,
      sanctioned: quickEditDraft?.sanctioned ?? current.sanctioned,
      featured: quickEditDraft?.featured ?? current.featured,
    };
  }, [current, quickEditDraft]);

  const ratingsCount = current != null && current.ratings_count > 0 ? current.ratings_count : null;

  const tabs = useMemo(
    () => [
      {
        id: 'information' as const,
        label: t('cups.tabs.information'),
        icon: Info,
        count: null as number | null,
      },
      {
        id: 'ratings' as const,
        label: t('cups.tabs.ratings'),
        icon: Star,
        count: ratingsCount,
      },
      {
        id: 'ingest' as const,
        label: t('cups.tabs.ingest'),
        icon: Download,
        count: null as number | null,
      },
      {
        id: 'activity' as const,
        label: t('cups.tabs.activity'),
        icon: History,
        count: null as number | null,
      },
    ],
    [ratingsCount, t],
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

  if (!current || !displayCup) {
    return null;
  }

  const heroImageUrl = (current.featured_image_url || '').trim();

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.cups')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={Trophy}
          className="h-9 w-9 bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>{current.name}</h3>
    </div>
  );

  const updatedLabel = current.updated_at
    ? new Date(current.updated_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  const locationLabel = current.location?.trim() || null;
  const isVisible = displayCup.visible !== false;
  const isSanctioned = displayCup.sanctioned !== false;
  const isFeatured = displayCup.featured === true;

  const informationCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title={t('cups.tabs.information')} icon={Trophy} subtleTitle className="p-6">
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <span className="text-muted-foreground">Name</span>
            <span className="col-span-2 font-medium">{current.name}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <span className="text-muted-foreground">Organizer</span>
            <span className="col-span-2">{current.organizer || '—'}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <span className="text-muted-foreground">Location</span>
            <span className="col-span-2">{current.location || '—'}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <span className="text-muted-foreground">Date range</span>
            <span className="col-span-2">
              {current.start_date ? new Date(current.start_date).toLocaleDateString('sv-SE') : '—'}{' '}
              - {current.end_date ? new Date(current.end_date).toLocaleDateString('sv-SE') : '—'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <span className="text-muted-foreground">Categories</span>
            <span className="col-span-2">{current.categories || '—'}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <span className="text-muted-foreground">Match format</span>
            <span className="col-span-2">{current.match_format || '—'}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <span className="text-muted-foreground">Teams</span>
            <span className="col-span-2">
              {current.team_count !== null && current.team_count !== undefined
                ? String(current.team_count)
                : '—'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <span className="text-muted-foreground">Registration</span>
            <span className="col-span-2">
              {current.registration_url ? (
                <a
                  className="text-primary hover:underline inline-flex items-center gap-1"
                  href={current.registration_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Open
                </a>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <span className="text-muted-foreground">Description</span>
            <span className="col-span-2 whitespace-pre-wrap">{current.description || '—'}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 items-start">
            <span className="text-muted-foreground">{t('cups.heroImageView')}</span>
            <div className="col-span-2 min-w-0">
              {heroImageUrl ? (
                <a
                  href={heroImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img
                    src={heroImageUrl}
                    alt={`${current.name} — ${t('cups.heroImageView')}`}
                    className="h-24 w-40 max-w-full rounded-md object-cover"
                    loading="lazy"
                  />
                </a>
              ) : (
                <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-xs leading-relaxed text-muted-foreground">
                  {t('cups.heroImageNone')}
                </p>
              )}
            </div>
          </div>
        </div>
      </DetailSection>
    </Card>
  );

  const propertiesCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('cups.cupProperties')}
        icon={SlidersHorizontal}
        subtleTitle
        className="p-6"
      >
        <CupPropertiesFields
          values={{
            visible: displayCup.visible !== false,
            sanctioned: displayCup.sanctioned !== false,
            featured: displayCup.featured === true,
          }}
          onVisibleChange={(value) => setQuickEditField('visible', value)}
          onSanctionedChange={(value) => setQuickEditField('sanctioned', value)}
          onFeaturedChange={(value) => setQuickEditField('featured', value)}
        />
      </DetailSection>
    </Card>
  );

  const ingestCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title={t('cups.columnIngest')} icon={Download} subtleTitle className="p-6">
        <div>
          <div className={cn(DETAIL_INFO_ROW_CLASS, 'items-start gap-3')}>
            <span className="shrink-0 text-slate-500 dark:text-slate-400">Source URL</span>
            <span className="min-w-0 flex-1 break-all text-right font-extrabold text-foreground">
              {current.source_url || '—'}
            </span>
          </div>
          <div className={cn(DETAIL_INFO_ROW_CLASS, 'items-start gap-3')}>
            <span className="shrink-0 text-slate-500 dark:text-slate-400">Ingest source</span>
            <span className="min-w-0 flex-1 break-all text-right font-extrabold text-foreground">
              {ingestSourceName(current.ingest_source_id)}
            </span>
          </div>
          <div className={cn(DETAIL_INFO_ROW_CLASS, 'items-start gap-3')}>
            <span className="shrink-0 text-slate-500 dark:text-slate-400">Ingest run</span>
            <span className="min-w-0 flex-1 break-all text-right font-extrabold text-foreground">
              {current.ingest_run_id || '—'}
            </span>
          </div>
        </div>
      </DetailSection>
    </Card>
  );

  return (
    <>
      <DetailLayout gridClassName="grid-cols-1">
        <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
          <div className="border-b border-border/50 px-4 py-5">
            <CupDetailHeaderMenus cup={current} leading={titleLeading} />
            <DetailHeaderMetaRow>
              {locationLabel ? (
                <span className="min-w-0 text-xs text-muted-foreground">{locationLabel}</span>
              ) : null}
              {updatedLabel ? (
                <p className="min-w-0 text-xs text-muted-foreground">
                  {t('common.updated')} {updatedLabel}
                </p>
              ) : null}
              <StatusOutlineBadge
                icon={isVisible ? Eye : EyeOff}
                className={
                  isVisible ? QC_STATUS_BADGE_COLORS.success : QC_STATUS_BADGE_COLORS.muted
                }
              >
                {isVisible ? t('common.visible') : t('common.hidden')}
              </StatusOutlineBadge>
              {isSanctioned ? (
                <StatusOutlineBadge icon={ShieldCheck} className={QC_STATUS_BADGE_COLORS.success}>
                  {t('cups.propertySanctioned')}
                </StatusOutlineBadge>
              ) : null}
              {isFeatured ? (
                <StatusOutlineBadge icon={Star} className={QC_STATUS_BADGE_COLORS.success}>
                  {t('cups.featured')}
                </StatusOutlineBadge>
              ) : null}
            </DetailHeaderMetaRow>
            <div className="mt-4">{tabChips}</div>
          </div>
        </Card>
        {current.deleted_at !== null && current.deleted_at !== undefined && (
          <Card
            padding="none"
            className="mb-3 border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Removed from source
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-500">
                  Removed on {new Date(current.deleted_at).toLocaleDateString('sv-SE')}. The cup was
                  not found in the latest import. It will be permanently deleted after 30 days.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={RotateCcw}
                className="h-8 shrink-0 px-3 text-xs text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40"
                onClick={handleRestore}
                disabled={isRestoring}
              >
                Restore
              </Button>
            </div>
          </Card>
        )}
        {activeTab === 'information' ? informationCard : null}
        {activeTab === 'information' ? propertiesCard : null}
        {activeTab === 'ratings' ? <CupRatings cupId={current.id} /> : null}
        {activeTab === 'ingest' ? ingestCard : null}
        {activeTab === 'activity' ? (
          <DetailActivityLog
            entityType="cup"
            entityId={current.id}
            limit={30}
            title={t('cups.activity')}
            showClearButton
            refreshKey={String(current.updated_at ?? current.id)}
            systemId={formatDisplayNumber('cups', current.id)}
          />
        ) : null}
      </DetailLayout>
      <ConfirmDialog
        isOpen={showDiscardQuickEditDialog}
        title={t('dialog.unsavedChanges')}
        message={t('cups.quickEditDiscardMessage')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={onDiscardQuickEditAndClose}
        onCancel={() => setShowDiscardQuickEditDialog(false)}
        variant="warning"
      />
    </>
  );
}
