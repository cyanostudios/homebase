import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { CupPageviewStats } from './stats/CupPageviewStats';

const PERIOD_OPTIONS = [7, 30, 90] as const;

interface CupsStatisticsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function CupsStatisticsView({ inlineTrailing }: CupsStatisticsViewProps = {}) {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(30);

  return (
    <div className="space-y-4">
      <div className="flex flex-shrink-0 items-center justify-between gap-3">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('cups.statistics.title')}
          </h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
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
          {inlineTrailing}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{t('cups.statistics.description')}</p>

      <CupPageviewStats days={days} />
    </div>
  );
}
