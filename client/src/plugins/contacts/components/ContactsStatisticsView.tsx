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

import { useContacts } from '../hooks/useContacts';

const TYPE_CHART_COLORS = {
  company: '#0ea5e9',
  private: '#22c55e',
} as const;

const STAT_KPI_SOFT_CLASS = 'bg-sky-50 shadow-none dark:bg-sky-950/40';
const STAT_KPI_SOFT_LABEL_CLASS = 'text-sky-600/70 dark:text-sky-400/70';
const STAT_KPI_SOFT_VALUE_CLASS = 'text-sky-800 dark:text-sky-200';

interface ContactsStatisticsViewProps {
  onClose?: () => void;
}

export function ContactsStatisticsView({ onClose }: ContactsStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const { contacts, contactIdsWithTimeEntries } = useContacts();

  useMobileBarOverride(onClose ? { onClose } : null);

  const stats = useMemo(() => {
    const hasTimeLogged = (id: string | number) =>
      contactIdsWithTimeEntries.has(id) || contactIdsWithTimeEntries.has(String(id));
    return {
      total: contacts.length,
      companies: contacts.filter((c) => c.contactType === 'company').length,
      private: contacts.filter((c) => c.contactType === 'private').length,
      withTags: contacts.filter((c) => Array.isArray(c.tags) && c.tags.length > 0).length,
      timeLogged: contacts.filter((c) => hasTimeLogged(c.id)).length,
      assignable: contacts.filter((c) => c.isAssignable).length,
    };
  }, [contacts, contactIdsWithTimeEntries]);

  const typeSegments = useMemo(
    () =>
      [
        {
          key: 'company',
          label: t('contacts.stats.companies'),
          value: stats.companies,
          color: TYPE_CHART_COLORS.company,
        },
        {
          key: 'private',
          label: t('contacts.stats.private'),
          value: stats.private,
          color: TYPE_CHART_COLORS.private,
        },
      ].filter((segment) => segment.value > 0),
    [stats.companies, stats.private, t],
  );

  return (
    <div className="space-y-6">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>
            {t('contacts.statistics.title', { defaultValue: 'Contact statistics' })}
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
        {t('contacts.statistics.description', {
          defaultValue: 'Overview of companies, private contacts, tags, and time logged.',
        })}
      </p>

      <DetailSection
        title={t('contacts.statistics.overview', { defaultValue: 'Overview' })}
        icon={LayoutGrid}
        subtleTitle
      >
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          <StatKpiTile
            label={t('contacts.stats.total')}
            value={stats.total}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('contacts.stats.companies')}
            value={stats.companies}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('contacts.stats.private')}
            value={stats.private}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('contacts.stats.withTags')}
            value={stats.withTags}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('contacts.stats.timeLogged')}
            value={stats.timeLogged}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
          <StatKpiTile
            label={t('contacts.assignableYes', { defaultValue: 'Assignable' })}
            value={stats.assignable}
            className={STAT_KPI_SOFT_CLASS}
            labelClassName={STAT_KPI_SOFT_LABEL_CLASS}
            valueClassName={STAT_KPI_SOFT_VALUE_CLASS}
          />
        </div>
      </DetailSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatDonutChart
          title={t('contacts.statistics.typeMix', { defaultValue: 'Company vs private' })}
          ariaLabel={t('contacts.statistics.typeMixAria', {
            defaultValue: 'Share of company and private contacts',
          })}
          segments={typeSegments}
        />
      </div>
    </div>
  );
}
