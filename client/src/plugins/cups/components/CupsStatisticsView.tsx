import { X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMobileBarOverride } from '@/core/ui/MobileActionsContext';

import { CupPageviewStats } from './stats/CupPageviewStats';

const PERIOD_OPTIONS = [7, 30, 90] as const;

interface CupsStatisticsViewProps {
  onClose?: () => void;
}

export function CupsStatisticsView({ onClose }: CupsStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(30);

  useMobileBarOverride(onClose ? { onClose } : null);

  return (
    <div className="space-y-4">
      <div className="flex flex-shrink-0 items-center justify-between gap-3">
        <div className="mr-4 hidden min-w-0 flex-1 items-center gap-4 md:flex">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('cups.statistics.title')}
          </h2>
        </div>
        <div className="flex w-full flex-shrink-0 items-center justify-end gap-2 md:w-auto">
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
