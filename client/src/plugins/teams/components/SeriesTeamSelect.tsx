import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { SeriesTeamOption } from '../types/teams';

const ALL_SERIES_TEAMS = '__all__';

export function SeriesTeamSelect({
  options,
  value,
  onChange,
  className,
  disabled,
}: {
  options: SeriesTeamOption[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  className?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  if (options.length === 0) {
    return null;
  }

  const selectValue = value?.trim() ? value : ALL_SERIES_TEAMS;

  return (
    <Select
      value={selectValue}
      onValueChange={(next) => onChange(next === ALL_SERIES_TEAMS ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? 'h-9 w-full text-sm'}>
        <SelectValue placeholder={t('teams.form.seriesTeamPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_SERIES_TEAMS}>{t('teams.form.seriesTeamAll')}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
