import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { GenerationSourceSummary } from '../types/guides';

interface SourceResearchSummaryProps {
  sources: GenerationSourceSummary;
  className?: string;
  compact?: boolean;
}

export const SourceResearchSummary: React.FC<SourceResearchSummaryProps> = ({
  sources,
  className,
  compact = false,
}) => {
  const { t } = useTranslation();

  if (!sources.sources.length) return null;

  return (
    <div className={cn(compact ? 'space-y-1' : 'space-y-2', className)}>
      {!compact && <span className="text-muted-foreground">{t('guides.usage.sources')}</span>}
      <ul className={cn('space-y-1', compact && 'text-xs')}>
        {sources.sources.map((source) => (
          <li key={source.sourceKey} className="space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="capitalize">{source.sourceKey}</span>
              <span className="text-muted-foreground">
                {source.status === 'ok'
                  ? t('guides.usage.sourceOk', { count: source.excerptCount })
                  : source.status === 'empty'
                    ? t('guides.usage.sourceEmpty')
                    : t('guides.usage.sourceFailed')}
              </span>
            </div>
            {source.status === 'failed' && source.errorMessage && (
              <p className="text-[11px] leading-snug text-destructive/90">{source.errorMessage}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
