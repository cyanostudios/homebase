import { Edit, Info, Languages, ListOrdered, MapPin, Trash2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import { useGuides } from '../hooks/useGuides';
import { GuideStopsSection } from './GuideStopsSection';
import {
  formatGuideLifecycleStatus,
  isMasterGuideEditorialStatus,
  type Guide,
} from '../types/guides';

interface GuideViewProps {
  guide?: Guide;
  item?: Guide;
}

export const GuideView: React.FC<GuideViewProps> = ({ guide, item }) => {
  const { t } = useTranslation();
  const { openGuideForEdit, deleteGuide } = useGuides();
  const actualGuide = guide || item;
  if (!actualGuide) return null;

  const editorialStatus = isMasterGuideEditorialStatus(actualGuide.masterGuideEditorialStatus)
    ? actualGuide.masterGuideEditorialStatus
    : 'draft';

  return (
    <div className="plugin-guides min-h-full bg-background px-4 py-5 sm:px-5 sm:py-6">
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <Card
              padding="none"
              className="overflow-hidden border border-border/70 bg-card shadow-sm"
            >
              <DetailSection
                title={t('guides.quickActions')}
                icon={Edit}
                iconPlugin="guides"
                className="p-4"
              >
                <div className="flex flex-col items-start gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Edit}
                    className="h-9 justify-start rounded-md px-3 text-xs"
                    onClick={() => openGuideForEdit(actualGuide)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => void deleteGuide(actualGuide.id)}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </DetailSection>
            </Card>

            <Card
              padding="none"
              className="overflow-hidden border border-border/70 bg-card shadow-sm"
            >
              <DetailSection
                title={t('guides.information')}
                icon={Info}
                iconPlugin="guides"
                className="p-4"
              >
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('guides.colId')}</span>
                    <span className="font-mono">
                      {formatDisplayNumber('guides', actualGuide.id)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('guides.masterGuideId')}</span>
                    <span className="font-mono">{actualGuide.masterGuideId ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('common.created')}</span>
                    <span>{formatDate(actualGuide.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('common.updated')}</span>
                    <span>{formatDate(actualGuide.updatedAt)}</span>
                  </div>
                </div>
              </DetailSection>
            </Card>
          </div>
        }
      >
        <div className="space-y-4">
          <Card
            padding="none"
            className="overflow-hidden border border-border/70 bg-card shadow-sm"
          >
            <DetailSection
              title={t('guides.details')}
              icon={MapPin}
              iconPlugin="guides"
              className="p-6"
            >
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('guides.displayName')}
                  </div>
                  <div className="text-lg font-semibold">{actualGuide.displayName}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {formatGuideLifecycleStatus(actualGuide.lifecycleStatus)}
                  </Badge>
                </div>

                <div className="border-t border-border/50 pt-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('guides.shortIntro')}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{actualGuide.shortIntro ?? '—'}</div>
                </div>

                <div className="border-t border-border/50 pt-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('guides.geographicReference')}
                  </div>
                  <div className="text-sm">{actualGuide.geographicReference ?? '—'}</div>
                </div>
              </div>
            </DetailSection>
          </Card>

          <Card
            padding="none"
            className="overflow-hidden border border-border/70 bg-card shadow-sm"
          >
            <DetailSection
              title={t('guides.masterGuide')}
              icon={Languages}
              iconPlugin="guides"
              className="p-6"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="uppercase">
                    {actualGuide.sourceLanguage}
                  </Badge>
                  <Badge variant="secondary">{t(`guides.editorial.${editorialStatus}`)}</Badge>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('guides.sourceLanguage')}
                    </div>
                    <div className="mt-1 uppercase">{actualGuide.sourceLanguage}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('guides.masterGuideEditorialStatus')}
                    </div>
                    <div className="mt-1">{t(`guides.editorial.${editorialStatus}`)}</div>
                  </div>
                </div>
              </div>
            </DetailSection>
          </Card>

          <Card
            padding="none"
            className="overflow-hidden border border-border/70 bg-card shadow-sm"
          >
            <DetailSection
              title={t('guides.guideStops')}
              icon={ListOrdered}
              iconPlugin="guides"
              className="p-6"
            >
              <GuideStopsSection
                placeId={actualGuide.id}
                sourceLanguage={actualGuide.sourceLanguage}
              />
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>
    </div>
  );
};
