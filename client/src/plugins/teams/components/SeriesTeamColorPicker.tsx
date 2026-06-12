import { Ban } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { TeamColor } from '../types/teams';
import { TEAM_COLOR_GRADIENTS, TEAM_COLORS } from '../types/teams';

export function SeriesTeamColorPicker({
  value,
  onChange,
}: {
  value: TeamColor | null;
  onChange: (color: TeamColor | null) => void;
}) {
  const { t } = useTranslation();
  const noColorSelected = value === null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        title={t('teams.form.seriesTeamNoColor')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground transition-transform',
          noColorSelected
            ? 'scale-110 ring-2 ring-foreground ring-offset-2'
            : 'hover:scale-105 hover:border-muted-foreground/60',
        )}
        onClick={() => onChange(null)}
      >
        <Ban className="h-3.5 w-3.5" />
      </button>
      {TEAM_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          title={color}
          className={cn(
            'h-7 w-7 rounded-full bg-gradient-to-br transition-transform',
            TEAM_COLOR_GRADIENTS[color],
            value === color ? 'scale-110 ring-2 ring-foreground ring-offset-2' : 'hover:scale-105',
          )}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
