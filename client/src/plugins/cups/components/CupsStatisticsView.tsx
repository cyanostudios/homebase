import { BarChart2, LayoutGrid, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';

import { useCups } from '../hooks/useCups';

import { CupPageviewStats } from './stats/CupPageviewStats';

const PERIOD_OPTIONS = [7, 30, 90] as const;

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

interface CupsStatisticsViewProps {
  onClose?: () => void;
}

export function CupsStatisticsView({ onClose }: CupsStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const { cups, openCupStatistics } = useCups();
  const [days, setDays] = useState<number>(30);
  const isEmbedded = onClose == null;

  useMobileBarOverride(onClose ? { onClose } : null);

  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();
    const active = cups.filter((c) => c.deleted_at === null || c.deleted_at === undefined);
    return {
      total: active.length,
      visible: active.filter((c) => Boolean(c.visible)).length,
      featured: active.filter((c) => Boolean(c.featured)).length,
      upcoming: active.filter((c) => {
        if (!c.start_date) {
          return false;
        }
        const startDateMs = new Date(c.start_date).getTime();
        return Number.isFinite(startDateMs) && startDateMs >= todayStartMs;
      }).length,
    };
  }, [cups]);

  const overviewSection = (
    <DetailSection
      title={t('cups.statistics.overview', { defaultValue: 'Overview' })}
      icon={LayoutGrid}
      subtleTitle
    >
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
        <StatKpiTile
          label={t('cups.stats.total')}
          value={stats.total}
          className={STAT_KPI_SOFT_CLASS}
          labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
          valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
        />
        <StatKpiTile
          label={t('cups.stats.visible')}
          value={stats.visible}
          className={STAT_KPI_SOFT_CLASS}
          labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
          valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
        />
        <StatKpiTile
          label={t('cups.stats.featured')}
          value={stats.featured}
          className={STAT_KPI_SOFT_CLASS}
          labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
          valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
        />
        <StatKpiTile
          label={t('cups.stats.upcoming')}
          value={stats.upcoming}
          className={STAT_KPI_SOFT_CLASS}
          labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
          valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
        />
      </div>
    </DetailSection>
  );

  if (isEmbedded) {
    return (
      <div className="space-y-6">
        <div className={PLUGIN_PAGE_HEADER_CLASS}>
          <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
            <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('cups.statistics.title')}</h2>
          </div>
        </div>
        <p className="hidden text-sm text-muted-foreground md:block">
          {t('cups.statistics.embeddedDescription', {
            defaultValue: 'Overview of cups by visibility, featured status, and upcoming dates.',
          })}
        </p>
        {overviewSection}
        <ExpandableIconButton
          icon={BarChart2}
          label={t('cups.statistics.openFull', { defaultValue: 'Open Cupappen statistics' })}
          variant="soft"
          onClick={() => openCupStatistics()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-shrink-0 items-center justify-between gap-3">
        <div className={PLUGIN_PAGE_HEADER_CLASS}>
          <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
            <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('cups.statistics.title')}</h2>
          </div>
        </div>
        <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
          <Select
            value={String(days)}
            onValueChange={(value) => {
              const next = Number(value);
              if (PERIOD_OPTIONS.includes(next as (typeof PERIOD_OPTIONS)[number])) {
                setDays(next);
              }
            }}
          >
            <SelectTrigger
              className="h-9 w-[10.5rem] rounded-full border-border/60 bg-background px-3 text-xs shadow-none"
              aria-label={t('cups.statistics.periodAriaLabel')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)} className="text-xs">
                  {t('cups.statistics.periodDays', { days: option })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onClose ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={X}
              className="hidden h-9 px-3 text-xs md:inline-flex"
              onClick={onClose}
            >
              {t('common.close')}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {t('cups.statistics.description')}
      </p>

      <CupPageviewStats days={days} />
    </div>
  );
}
