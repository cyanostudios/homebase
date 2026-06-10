import React from 'react';

import { cn } from '@/lib/utils';

import type { TeamColor } from '../types/teams';
import { TEAM_COLOR_GRADIENTS, TEAM_COLORS } from '../types/teams';

export function SeriesTeamColorPicker({
  value,
  onChange,
}: {
  value: TeamColor;
  onChange: (color: TeamColor) => void;
}) {
  return (
    <div className="flex items-center gap-2">
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
