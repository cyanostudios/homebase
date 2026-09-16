import { LayoutGrid } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { StatDonutChart, StatKpiTile } from '@/core/ui/charts/StatCharts';
import { DetailSection } from '@/core/ui/DetailSection';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';

import { useFiles } from '../hooks/useFiles';
import { fileHasSize, fileIsImage, fileIsUpdatedWithinDays } from '../utils/fileListFilter';

const MIME_CHART_COLORS = {
  images: '#0ea5e9',
  other: '#94a3b8',
} as const;

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

interface FilesStatisticsViewProps {
  onClose?: () => void;
}

export function FilesStatisticsView({ onClose }: FilesStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const { files } = useFiles();

  useMobileBarOverride(onClose ? { onClose } : null);

  const stats = useMemo(
    () => ({
      total: files.length,
      images: files.filter((f) => fileIsImage(f)).length,
      withSize: files.filter((f) => fileHasSize(f)).length,
      updated7d: files.filter((f) => fileIsUpdatedWithinDays(f, 7)).length,
    }),
    [files],
  );

  const mimeSegments = useMemo(() => {
    const other = Math.max(0, stats.total - stats.images);
    return [
      {
        key: 'images',
        label: t('files.filterImages'),
        value: stats.images,
        color: MIME_CHART_COLORS.images,
      },
      {
        key: 'other',
        label: t('files.statistics.otherFiles', { defaultValue: 'Other files' }),
        value: other,
        color: MIME_CHART_COLORS.other,
      },
    ].filter((segment) => segment.value > 0);
  }, [stats.total, stats.images, t]);

  return (
    <div className="space-y-6">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
            {t('files.statistics.title', { defaultValue: 'File statistics' })}
          </h2>
        </div>
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {t('files.statistics.description', {
          defaultValue: 'Overview of file types, sizes, and recent uploads.',
        })}
      </p>

      <DetailSection
        title={t('files.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
          <StatKpiTile
            label={t('files.filterTotal')}
            value={stats.total}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('files.filterImages')}
            value={stats.images}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('files.filterWithSize')}
            value={stats.withSize}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('files.filterUpdated7d')}
            value={stats.updated7d}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
        </div>
      </DetailSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatDonutChart
          title={t('files.statistics.mimeMix', { defaultValue: 'Images vs other files' })}
          ariaLabel={t('files.statistics.mimeMixAria', {
            defaultValue: 'Share of image files versus other file types',
          })}
          segments={mimeSegments}
        />
      </div>
    </div>
  );
}
