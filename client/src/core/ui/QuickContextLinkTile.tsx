import type { LucideIcon } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TILE_CLASS = 'min-h-[4.5rem] rounded-xl bg-muted/40 px-3 py-3.5 text-left transition-colors';

const TILE_LABEL_CLASS = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

const TILE_VALUE_CLASS =
  'mt-1 flex min-w-0 items-start gap-1.5 text-xs font-medium text-foreground';

export function QuickContextLinkTile({
  label,
  meta,
  metaClassName,
  icon: Icon,
  iconClassName,
  children,
  onClick,
  className,
}: {
  /** Plugin / category label (rendered uppercase). */
  label: string;
  /** Status (or other meta) shown beside the label. */
  meta?: string | null;
  /** Badge colors for status meta. */
  metaClassName?: string;
  icon: LucideIcon;
  iconClassName?: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <p className={cn(TILE_LABEL_CLASS, 'shrink-0 truncate')}>{label}</p>
        {meta ? (
          metaClassName ? (
            <Badge
              variant="outline"
              className={cn(
                'h-5 max-w-full shrink truncate px-1.5 text-[10px] font-medium',
                metaClassName,
              )}
            >
              {meta}
            </Badge>
          ) : (
            <span className="min-w-0 truncate text-xs text-muted-foreground">{meta}</span>
          )
        ) : null}
      </div>
      <span className={TILE_VALUE_CLASS}>
        <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', iconClassName)} aria-hidden />
        <span className="min-w-0 line-clamp-2 text-left">{children}</span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cn(TILE_CLASS, 'w-full cursor-pointer hover:bg-muted/60', className)}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className={cn(TILE_CLASS, className)}>{content}</div>;
}

export function QuickContextLinkTileGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('grid grid-cols-1 gap-2 md:grid-cols-2', className)}>{children}</div>;
}
