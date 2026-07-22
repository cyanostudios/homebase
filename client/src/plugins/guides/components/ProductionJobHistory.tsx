import { History } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { formatDate } from '@/core/utils/dateFormat';

import type { ProductionJob } from '../types/guides';
import { GUIDE_PRODUCTION_JOB_STATUS_COLORS, isProductionJobStatus } from '../types/guides';

interface ProductionJobHistoryProps {
  jobs: ProductionJob[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}

export const ProductionJobHistory: React.FC<ProductionJobHistoryProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
}) => {
  const { t } = useTranslation();

  if (!jobs?.length) {
    return null;
  }

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('guides.production.historyTitle')}
        icon={History}
        iconPlugin="guides"
        className="p-4"
      >
        <ul className="space-y-1.5">
          {jobs.map((job) => {
            const status = isProductionJobStatus(job.status) ? job.status : 'pending';
            const isSelected = selectedJobId === job.id;
            return (
              <li key={job.id}>
                <Button
                  type="button"
                  variant="ghost"
                  className={`h-auto w-full justify-start rounded-md px-2 py-1.5 text-left ${
                    isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : ''
                  }`}
                  onClick={() => onSelectJob(job.id)}
                  aria-current={isSelected ? 'true' : undefined}
                >
                  <div className="flex w-full flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">#{job.id}</span>
                      <Badge className={GUIDE_PRODUCTION_JOB_STATUS_COLORS[status]}>
                        {t(`guides.production.status.${status}`)}
                      </Badge>
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {t(`guides.production.jobTypes.${job.type}`)} · {formatDate(job.createdAt)}
                      {isSelected ? ` · ${t('guides.production.historySelected')}` : ''}
                    </div>
                  </div>
                </Button>
              </li>
            );
          })}
        </ul>
      </DetailSection>
    </Card>
  );
};
