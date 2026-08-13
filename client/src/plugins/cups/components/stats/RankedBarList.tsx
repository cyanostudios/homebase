import React from 'react';

import { cn } from '@/lib/utils';

import { barWidthPercent } from '../../utils/rankedBarWidth';

export type RankedBarListItem = {
  key: string;
  label: string;
  value: number;
  secondary?: string | null;
};

export function RankedBarList({
  items,
  emptyLabel,
  barClassName,
  valueFormatter,
}: {
  items: RankedBarListItem[];
  emptyLabel: string;
  barClassName: string;
  valueFormatter?: (n: number) => string;
}) {
  const format = valueFormatter ?? ((n: number) => new Intl.NumberFormat(undefined).format(n));
  const max = items.reduce((m, row) => Math.max(m, row.value), 0);

  if (items.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="mt-2 space-y-1">
      {items.map((row) => {
        const width = barWidthPercent(row.value, max);
        return (
          <li key={row.key} className="relative overflow-hidden rounded-md">
            <div
              className={cn('absolute inset-y-0 left-0 rounded-md opacity-25', barClassName)}
              style={{ width: `${width}%` }}
              aria-hidden
            />
            <div className="relative flex items-start justify-between gap-3 px-2 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{row.label}</div>
                {row.secondary ? (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {row.secondary}
                  </div>
                ) : null}
              </div>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {format(row.value)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
