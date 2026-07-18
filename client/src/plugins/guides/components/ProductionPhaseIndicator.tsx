import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { ProductionItemStep, ProductionJob } from '../types/guides';
import { getCurrentPhaseStep } from '../utils/productionJobHelpers';

interface ProductionPhaseIndicatorProps {
  job: ProductionJob;
  className?: string;
}

function phaseState(
  job: ProductionJob,
  step: ProductionItemStep,
  index: number,
): 'done' | 'active' | 'upcoming' {
  if (index < job.currentPhaseIndex) return 'done';
  if (index === job.currentPhaseIndex) return 'active';
  return 'upcoming';
}

export const ProductionPhaseIndicator: React.FC<ProductionPhaseIndicatorProps> = ({
  job,
  className,
}) => {
  const { t } = useTranslation();
  const phases = job.phases ?? [];
  const current = getCurrentPhaseStep(job);

  const labels = phases.map((step) => t(`guides.production.phases.${step}`)).join(', ');
  const currentLabel = current ? t(`guides.production.phases.${current}`) : '';

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 text-xs text-muted-foreground', className)}
      aria-label={t('guides.production.phaseIndicatorAria', {
        phases: labels,
        current: currentLabel,
      })}
    >
      {phases.map((step, index) => {
        const state = phaseState(job, step, index);
        const isLast = index === phases.length - 1;
        return (
          <React.Fragment key={step}>
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
                {t(`guides.production.phases.${step}`)}
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
