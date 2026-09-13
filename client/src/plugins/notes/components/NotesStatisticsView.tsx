import { LayoutGrid, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { StatDonutChart, StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { useNotes } from '../hooks/useNotes';
import { noteHasContent, noteHasMentions, noteIsRecentlyUpdated } from '../utils/noteListFilter';

const MENTIONS_CHART_COLORS = {
  withMentions: '#0ea5e9',
  withoutMentions: '#94a3b8',
} as const;

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

interface NotesStatisticsViewProps {
  onClose?: () => void;
}

export function NotesStatisticsView({ onClose }: NotesStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const { notes } = useNotes();

  useMobileBarOverride(onClose ? { onClose } : null);

  const stats = useMemo(
    () => ({
      total: notes.length,
      withMentions: notes.filter((n) => noteHasMentions(n)).length,
      withContent: notes.filter((n) => noteHasContent(n)).length,
      recentlyUpdated: notes.filter((n) => noteIsRecentlyUpdated(n)).length,
    }),
    [notes],
  );

  const mentionSegments = useMemo(() => {
    const withoutMentions = Math.max(0, stats.total - stats.withMentions);
    return [
      {
        key: 'withMentions',
        label: t('notes.stats.withMentions'),
        value: stats.withMentions,
        color: MENTIONS_CHART_COLORS.withMentions,
      },
      {
        key: 'withoutMentions',
        label: t('notes.stats.withoutMentions', { defaultValue: 'Without mentions' }),
        value: withoutMentions,
        color: MENTIONS_CHART_COLORS.withoutMentions,
      },
    ].filter((segment) => segment.value > 0);
  }, [stats.total, stats.withMentions, t]);

  return (
    <div className="space-y-6">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
            {t('notes.statistics.title', { defaultValue: 'Note statistics' })}
          </h2>
        </div>
        {onClose ? (
          <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
            <RoundIconLabelButton
              type="button"
              icon={X}
              label={t('common.close')}
              variant="secondary"
              alwaysExpanded
              onClick={onClose}
            />
          </div>
        ) : null}
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {t('notes.statistics.description', {
          defaultValue: 'Overview of mentions, content, and recent updates.',
        })}
      </p>

      <DetailSection
        title={t('notes.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
          <StatKpiTile
            label={t('notes.stats.total')}
            value={stats.total}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('notes.stats.withMentions')}
            value={stats.withMentions}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('notes.stats.withContent')}
            value={stats.withContent}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('notes.stats.recentlyUpdated')}
            value={stats.recentlyUpdated}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
        </div>
      </DetailSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatDonutChart
          title={t('notes.statistics.mentionsMix', { defaultValue: 'Notes with mentions' })}
          ariaLabel={t('notes.statistics.mentionsMixAria', {
            defaultValue: 'Share of notes with and without mentions',
          })}
          segments={mentionSegments}
        />
      </div>
    </div>
  );
}
