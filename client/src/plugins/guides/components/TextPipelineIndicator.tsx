import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { ProductionJob, ProductionJobItem } from '../types/guides';
import {
  getTextPipelineStage,
  getTextPipelineStages,
  type TextPipelineStage,
} from '../utils/productionJobHelpers';

interface TextPipelineIndicatorProps {
  job: ProductionJob;
  items: ProductionJobItem[];
  className?: string;
}

function stageState(
  stage: TextPipelineStage,
  current: TextPipelineStage,
): 'done' | 'active' | 'upcoming' {
  const order = getTextPipelineStages();
  if (current === 'failed') {
    return stage === 'research' ? 'active' : 'upcoming';
  }
  if (current === 'done') return 'done';
  const currentIndex = order.indexOf(current);
  const stageIndex = order.indexOf(stage);
  if (stageIndex < 0) return 'upcoming';
  if (stageIndex < currentIndex) return 'done';
  if (stageIndex === currentIndex) return 'active';
  return 'upcoming';
}

export const TextPipelineIndicator: React.FC<TextPipelineIndicatorProps> = ({
  job,
  items,
  className,
}) => {
  const { t } = useTranslation();
  const stages = getTextPipelineStages();
  const current = getTextPipelineStage(job, items);
  const labels = stages.map((s) => t(`guides.production.pipeline.${s}`)).join(', ');

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 text-xs text-muted-foreground', className)}
      aria-label={t('guides.production.pipelineAria', {
        stages: labels,
        current: t(
          `guides.production.pipeline.${current === 'done' || current === 'failed' ? 'review' : current}`,
        ),
      })}
    >
      {stages.map((stage, index) => {
        const state = stageState(stage, current);
        const isLast = index === stages.length - 1;
        return (
          <React.Fragment key={stage}>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex h-2 w-2 rounded-full',
                  state === 'done' && 'bg-emerald-500',
                  state === 'active' && 'bg-primary',
                  state === 'upcoming' && 'bg-muted-foreground/40',
                )}
                aria-hidden
              />
              <span className={cn(state === 'active' && 'font-medium text-foreground')}>
                {t(`guides.production.pipeline.${stage}`)}
              </span>
              {state === 'done' && (
                <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
                  ✓
                </span>
              )}
            </span>
            {!isLast && (
              <span className="text-muted-foreground/50" aria-hidden>
                —
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
