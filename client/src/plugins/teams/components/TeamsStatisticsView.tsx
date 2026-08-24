import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';

import { TeamStats } from './stats/TeamStats';

interface TeamsStatisticsViewProps {
  onClose?: () => void;
}

export function TeamsStatisticsView({ onClose }: TeamsStatisticsViewProps = {}) {
  const { t } = useTranslation();

  useMobileBarOverride(onClose ? { onClose } : null);

  return (
    <div className="space-y-4">
      <div className="hidden flex-shrink-0 items-center justify-between md:flex">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('teams.statistics.title')}
          </h2>
        </div>
        {onClose ? (
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={X}
              className="h-9 px-3 text-xs"
              onClick={onClose}
            >
              {t('common.close')}
            </Button>
          </div>
        ) : null}
      </div>

      <TeamStats />
    </div>
  );
}
