import { ChevronRight, MapPin } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import type { Guide } from '../types/guides';
import { GUIDE_LIFECYCLE_COLORS } from '../types/guides';

export function GuideCard({
  guide,
  selected,
  onClick,
  checkbox,
}: {
  guide: Guide;
  selected?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Card
      className={cn(
        'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border-0 bg-white p-0 shadow-sm transition-all dark:bg-slate-950',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : 'hover:shadow-md',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
          return;
        }
        onClick();
      }}
      data-list-item={JSON.stringify(guide)}
      data-plugin-name="guides"
      role="button"
      aria-label={t('guides.openPlace', { name: guide.displayName })}
    >
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {checkbox}
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] text-muted-foreground">
                {formatDisplayNumber('guides', guide.id)}
              </p>
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                {guide.displayName}
              </h3>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        </div>

        {guide.place?.displayName || guide.geographicReference ? (
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">
              {guide.place?.displayName ?? guide.geographicReference}
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={GUIDE_LIFECYCLE_COLORS[guide.lifecycleStatus]}>
            {t(`guides.lifecycle.${guide.lifecycleStatus}`)}
          </Badge>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {guide.sourceLanguage}
          </span>
        </div>

        <div className="mt-auto text-xs text-muted-foreground">
          {t('guides.colUpdated')} {formatDate(guide.updatedAt)}
        </div>
      </div>
    </Card>
  );
}
