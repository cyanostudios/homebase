import { Globe, Info, RotateCcw, SlidersHorizontal, Trophy, Trash2, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_INFO_ROW_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import { useCups } from '../hooks/useCups';
import type { Cup } from '../types/cups';

export function CupView({ cup, item }: { cup?: Cup | null; item?: Cup | null }) {
  const { t } = useTranslation();
  const current = cup ?? item ?? null;
  const { deleteCup, restoreCup } = useCups();
  const [showDelete, setShowDelete] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

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
  if (!current) {
    return null;
  }

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-3">
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('contacts.information')}
                icon={Info}
                subtleTitle
                className="p-4"
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">ID</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDisplayNumber('cups', current.id)}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Source URL</span>
                    <span className="max-w-[170px] truncate font-semibold text-foreground">
                      {current.source_url || '—'}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Ingest source</span>
                    <span className="font-semibold text-foreground">
                      {current.ingest_source_id || '—'}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Ingest run</span>
                    <span className="font-semibold text-foreground">
                      {current.ingest_run_id || '—'}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Updated</span>
                    <span className="font-mono font-semibold text-foreground">
                      {current.updated_at
                        ? new Date(current.updated_at).toLocaleDateString('sv-SE')
                        : '—'}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Created</span>
                    <span className="font-mono font-semibold text-foreground">
                      {current.created_at
                        ? new Date(current.created_at).toLocaleDateString('sv-SE')
                        : '—'}
                    </span>
                  </div>
                </div>
              </DetailSection>
            </Card>
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('contacts.quickActions')}
                icon={Zap}
                subtleTitle
                className="p-4"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 [&>svg]:text-red-600 dark:[&>svg]:text-red-400"
                  onClick={() => setShowDelete(true)}
                >
                  {t('common.delete')}
                </Button>
              </DetailSection>
            </Card>
            <DetailActivityLog
              entityType="cups"
              entityId={current.id}
              title={t('contacts.activity')}
            />
          </div>
        }
      >
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
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection title="Cup information" icon={Trophy} subtleTitle className="p-6">
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
                  {current.start_date
                    ? new Date(current.start_date).toLocaleDateString('sv-SE')
                    : '—'}{' '}
                  -{' '}
                  {current.end_date ? new Date(current.end_date).toLocaleDateString('sv-SE') : '—'}
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
            </div>
          </DetailSection>
        </Card>
        <Card padding="none" className={cn('mt-3', DETAIL_VIEW_CARD_CLASS)}>
          <DetailSection
            title={t('cups.cupProperties')}
            icon={SlidersHorizontal}
            subtleTitle
            className="p-6"
          >
            <div>
              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('cups.propertyPublic')}
                </span>
                {current.visible ? (
                  <Badge className="border-0 rounded-md bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300">
                    {t('common.yes')}
                  </Badge>
                ) : (
                  <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                    {t('common.no')}
                  </Badge>
                )}
              </div>
              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('cups.propertySanctioned')}
                </span>
                {current.sanctioned ? (
                  <Badge className="border-0 rounded-md bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300">
                    {t('common.yes')}
                  </Badge>
                ) : (
                  <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                    {t('common.no')}
                  </Badge>
                )}
              </div>
              <div className={DETAIL_PROP_ROW_CLASS}>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {t('cups.propertyFeatured')}
                </span>
                {current.featured ? (
                  <Badge className="border-0 rounded-md bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300">
                    {t('common.yes')}
                  </Badge>
                ) : (
                  <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                    {t('common.no')}
                  </Badge>
                )}
              </div>
            </div>
          </DetailSection>
        </Card>
      </DetailLayout>
      <ConfirmDialog
        isOpen={showDelete}
        title="Delete cup?"
        message={`Delete "${current.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={async () => {
          await deleteCup(current.id);
          setShowDelete(false);
        }}
        onCancel={() => setShowDelete(false)}
        variant="danger"
      />
    </>
  );
}
