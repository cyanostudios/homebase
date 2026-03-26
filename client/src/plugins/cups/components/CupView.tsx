import { Copy, ExternalLink, Info, Trash2, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation, type TFunction } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import { useCups } from '../context/CupsContext';
import type { Cup } from '../types/cup';

import { CupForm } from './CupForm';

interface CupViewProps {
  cup?: Cup;
  item?: Cup;
}

/** White card shell – matches SLOT_DETAIL_CARD_CLASS */
const CUP_DETAIL_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';
const PANEL_MAX_WIDTH = 'max-w-[920px]';
const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';

// ─── Quick Actions Card ────────────────────────────────────────────────────────

interface CupQuickActionsCardProps {
  cup: Cup;
  onDeleteClick: () => void;
  onEditClick: () => void;
}

function CupQuickActionsCard({ cup: _cup, onDeleteClick, onEditClick }: CupQuickActionsCardProps) {
  const { t } = useTranslation();
  return (
    <Card padding="none" className={CUP_DETAIL_CARD_CLASS}>
      <DetailSection title={t('cups.quickActions')} icon={Zap} iconPlugin="cups" className="p-4">
        <div className="flex flex-col items-start gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={Copy}
            className={quickActionButtonClass}
            onClick={onEditClick}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            onClick={onDeleteClick}
          >
            {t('common.delete')}
          </Button>
        </div>
      </DetailSection>
    </Card>
  );
}

// ─── Metadata Card ────────────────────────────────────────────────────────────

interface CupMetadataCardProps {
  cup: Cup;
}

function CupMetadataCard({ cup }: CupMetadataCardProps) {
  const { t } = useTranslation();
  return (
    <Card padding="none" className={CUP_DETAIL_CARD_CLASS}>
      <DetailSection title={t('cups.information')} icon={Info} iconPlugin="cups" className="p-4">
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">ID</span>
            <span className="font-mono font-medium">#{cup.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('common.created')}</span>
            <span className="font-medium">
              {cup.created_at ? new Date(cup.created_at).toLocaleDateString() : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('common.updated')}</span>
            <span className="font-medium">
              {cup.updated_at ? new Date(cup.updated_at).toLocaleDateString() : '—'}
            </span>
          </div>
          {cup.scraped_at && (
            <div className="flex items-center justify-between border-t border-border/50 pt-3">
              <span className="text-muted-foreground">{t('cups.scrapedAt')}</span>
              <span className="font-medium">{new Date(cup.scraped_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </DetailSection>
    </Card>
  );
}

// ─── Main Info Card ────────────────────────────────────────────────────────────

interface CupStructuredFieldsProps {
  cup: Cup;
  dateRange: string;
  t: TFunction;
  /** Under raw-first layout: always show age column (— if empty). */
  ageColumnAlways: boolean;
  registrationBorder: 'pt-5' | 'pt-4';
}

function CupStructuredFields({
  cup,
  dateRange,
  t,
  ageColumnAlways,
  registrationBorder,
}: CupStructuredFieldsProps) {
  const ageBlock =
    cup.age_groups || ageColumnAlways ? (
      <div>
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('cups.ageGroups')}
        </div>
        <div className="text-sm font-medium">{cup.age_groups ?? '—'}</div>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('cups.dates')}
          </div>
          <div className="text-sm font-medium">{dateRange || '—'}</div>
        </div>
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('cups.region')}
          </div>
          <div className="text-sm font-medium">{cup.region ?? '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('cups.location')}
          </div>
          <div className="text-sm font-medium">{cup.location ?? '—'}</div>
        </div>
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('cups.organizer')}
          </div>
          <div className="text-sm font-medium">{cup.organizer ?? '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('cups.sportType')}
          </div>
          <div className="text-sm font-medium capitalize">{cup.sport_type}</div>
        </div>
        {ageBlock}
      </div>

      {cup.registration_url && (
        <div className={cn('border-t border-border/50', registrationBorder)}>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('cups.registrationUrl')}
          </div>
          <a
            href={cup.registration_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-plugin hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('cups.register')}
          </a>
        </div>
      )}
    </div>
  );
}

interface CupMainInfoCardProps {
  cup: Cup;
}

function CupMainInfoCard({ cup }: CupMainInfoCardProps) {
  const { t } = useTranslation();
  const dateRange = [cup.start_date, cup.end_date].filter(Boolean).join(' – ');
  const raw =
    typeof cup.raw_snippet === 'string'
      ? cup.raw_snippet.trim()
      : cup.raw_snippet
        ? String(cup.raw_snippet)
        : '';
  const rawFirst = Boolean(raw);
  const sourceUrl =
    typeof cup.source_url === 'string'
      ? cup.source_url
      : cup.source_url
        ? String(cup.source_url)
        : '';

  const sourceLinkBlock =
    sourceUrl && !sourceUrl.startsWith('file://') ? (
      <div>
        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('cups.source')}
        </div>
        <a
          href={cup.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {sourceUrl}
        </a>
      </div>
    ) : null;

  const extractedBlock = (
    <>
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t('cups.extractedFields')}
      </div>
      <CupStructuredFields
        cup={cup}
        dateRange={dateRange}
        t={t}
        ageColumnAlways
        registrationBorder="pt-4"
      />
    </>
  );

  return (
    <Card padding="none" className={cn(CUP_DETAIL_CARD_CLASS, 'plugin-cups')}>
      <div className="space-y-5 p-6">
        {/* Title — secondary when raw is the foundation */}
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('cups.name')}
          </div>
          <div
            className={cn(
              'font-semibold text-foreground',
              rawFirst ? 'text-lg sm:text-xl' : 'text-2xl',
            )}
          >
            {cup.name}
          </div>
        </div>

        {rawFirst ? (
          <>
            {sourceLinkBlock}
            <div className="min-h-0 flex-1">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('cups.scrapedContent')}
              </div>
              <div className="max-h-[min(78vh,40rem)] min-h-[12rem] overflow-y-auto break-words rounded-lg border border-border/50 bg-muted/25 px-3 py-3 shadow-inner">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {raw}
                </p>
              </div>
            </div>
            <div className="border-t border-border/50 pt-5">{extractedBlock}</div>
          </>
        ) : (
          <>
            <CupStructuredFields
              cup={cup}
              dateRange={dateRange}
              t={t}
              ageColumnAlways={false}
              registrationBorder="pt-5"
            />
            {sourceLinkBlock}
          </>
        )}
      </div>
    </Card>
  );
}

// ─── CupView ─────────────────────────────────────────────────────────────────

export function CupView({ cup: cupProp, item }: CupViewProps) {
  const { t } = useTranslation();
  const cup = cupProp ?? item;
  const { currentCup, panelMode, openCupForEdit, closeCupPanel, deleteCup } = useCups();
  const activeCup = cup ?? currentCup;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (panelMode === 'create' || panelMode === 'edit') {
    return <CupForm />;
  }

  if (!activeCup) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          'plugin-cups min-h-full bg-background px-4 py-5 sm:px-5 sm:py-6 rounded-xl',
          'md:-mx-6 md:-my-4 md:rounded-b-lg md:rounded-t-none',
        )}
      >
        <DetailLayout
          mainClassName={PANEL_MAX_WIDTH}
          sidebar={
            <div className="space-y-4">
              <CupQuickActionsCard
                cup={activeCup}
                onDeleteClick={() => setShowDeleteDialog(true)}
                onEditClick={() => openCupForEdit(activeCup)}
              />
              <CupMetadataCard cup={activeCup} />
            </div>
          }
        >
          <div className="space-y-4">
            <CupMainInfoCard cup={activeCup} />
          </div>
        </DetailLayout>
      </div>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title={t('cups.deleteTitle')}
        message={t('cups.deleteMessage', { name: activeCup.name })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={() => {
          deleteCup(activeCup.id);
          setShowDeleteDialog(false);
          closeCupPanel();
        }}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </>
  );
}
