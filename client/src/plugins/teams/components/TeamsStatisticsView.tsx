import { X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';

import { TeamStats } from './stats/TeamStats';

interface TeamsStatisticsViewProps {
  onClose?: () => void;
}

export function TeamsStatisticsView({ onClose }: TeamsStatisticsViewProps = {}) {
  const { t } = useTranslation();

  useMobileBarOverride(onClose ? { onClose } : null);

  return (
    <div className="space-y-6">
      <div className={PLUGIN_PAGE_HEADER_CLASS}>
        <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
          <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('teams.statistics.title')}</h2>
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
        {t('teams.statistics.description', {
          defaultValue: 'Overview of team status, players, series, and responsibles.',
        })}
      </p>

      <TeamStats />
    </div>
  );
}
