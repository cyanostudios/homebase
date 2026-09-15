import { ChevronRight, Info, Languages, MapPin, Receipt } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

import { useGuides } from '../hooks/useGuides';
import { useProductionJob } from '../hooks/useProductionJob';
import { GuidePresentationSection } from './GuidePresentationSection';
import { GuideProductionPanel } from './GuideProductionPanel';
import { GuideReviewQueue, type GuideReviewQueueHandle } from './GuideReviewQueue';
import { ProductionJobHistory } from './ProductionJobHistory';
import { ProductionPhaseBanner } from './ProductionPhaseBanner';
import { StartProductionDialog } from './StartProductionDialog';
import {
  GUIDE_LANGUAGE_SOURCE_BADGE_CLASS,
  GUIDE_LIFECYCLE_COLORS,
  type Guide,
  type GuideLifecycleStatus,
  type GuidePresentation,
  type ProductionStartMode,
  type ProductionStartScope,
} from '../types/guides';
import {
  isProductionJobActive,
  resolveSourceSummary,
  shouldShowReviewQueue,
} from '../utils/productionJobHelpers';
import { resolveAudioGenerateErrorMessage } from '../utils/resolveAudioGenerateErrorMessage';
import { SourceResearchSummary } from './SourceResearchSummary';
import { GuideLanguageBadges } from './GuideLanguageBadges';
import { guidesApi } from '../api/guidesApi';

interface GuideViewProps {
  guide?: Guide;
  item?: Guide;
}

type GuideViewTab = 'details' | 'presentations' | 'review';

const GUIDE_VIEW_TABS: GuideViewTab[] = ['details', 'presentations', 'review'];

function parseGuideViewTab(value: string | null): GuideViewTab {
  if (value && GUIDE_VIEW_TABS.includes(value as GuideViewTab)) {
    return value as GuideViewTab;
  }
  return 'details';
}

export const GuideView: React.FC<GuideViewProps> = ({ guide, item }) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseGuideViewTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: GuideViewTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'details') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );
  const { validationErrors } = useGuides();
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [startDialogMode, setStartDialogMode] = useState<ProductionStartMode>('source');
  const [startScope, setStartScope] = useState<ProductionStartScope>({ type: 'full_guide' });
  const [presentations, setPresentations] = useState<GuidePresentation[]>([]);
  const [produceActionError, setProduceActionError] = useState<string | null>(null);
  const [lastTranslationLanguages, setLastTranslationLanguages] = useState<string[]>([]);
  const [isGeneratingSourceAudio, setIsGeneratingSourceAudio] = useState(false);
  const [sourceAudioError, setSourceAudioError] = useState<string | null>(null);
  const [sourceAudioReplaceOpen, setSourceAudioReplaceOpen] = useState(false);
  const [audioRefreshKey, setAudioRefreshKey] = useState(0);
  const reviewQueueRef = useRef<GuideReviewQueueHandle>(null);
  const actualGuide = guide || item;
  const production = useProductionJob(actualGuide?.id ?? '');

  const presentationsRefreshKey = useMemo(
    () =>
      production.items
        .filter((jobItem) => jobItem.reviewStatus === 'approved')
        .map((jobItem) => `${jobItem.presentationId}:${jobItem.reviewedAt ?? jobItem.updatedAt}`)
        .sort()
        .join('|'),
    [production.items],
  );

  const presentationsCount = presentations.length > 0 ? presentations.length : null;

  const tabs = useMemo(
    () => [
      {
        id: 'details' as const,
        label: t('guides.tabs.details'),
        icon: MapPin,
        count: null as number | null,
      },
      {
        id: 'presentations' as const,
        label: t('guides.tabs.presentations'),
        icon: Languages,
        count: presentationsCount,
      },
      {
        id: 'review' as const,
        label: t('guides.tabs.review'),
        icon: ChevronRight,
        count: null as number | null,
      },
    ],
    [presentationsCount, t],
  );

  const showReviewTab = useCallback(() => {
    setActiveTab('review');
    window.requestAnimationFrame(() => {
      reviewQueueRef.current?.scrollIntoView();
    });
  }, [setActiveTab]);

  if (!actualGuide) return null;

  const generalError = validationErrors.find((e) => e.field === 'general')?.message ?? null;

  const lifecycleLabel = (status: GuideLifecycleStatus) => t(`guides.lifecycle.${status}`);

  const sourcePresentation = presentations.find(
    (p) => p.language.toLowerCase() === actualGuide.sourceLanguage.toLowerCase(),
  );
  const sourceHasText = Boolean(sourcePresentation?.presentationText?.trim());
  const canGenerateSourceAudio = sourceHasText && sourcePresentation?.approvalStatus === 'approved';

  const generatedLanguageCodes = presentations
    .filter((p) => p.presentationText?.trim())
    .map((p) => p.language.toLowerCase());

  const handleGenerateSourceAudio = async () => {
    if (!canGenerateSourceAudio || isGeneratingSourceAudio) return;
    if (production.hasActiveJob || production.isBusy) return;
    setIsGeneratingSourceAudio(true);
    setSourceAudioError(null);
    try {
      await guidesApi.generateAudio(actualGuide.id, actualGuide.sourceLanguage);
      setAudioRefreshKey((key) => key + 1);
      await production.refreshJobs();
    } catch (err) {
      setSourceAudioError(resolveAudioGenerateErrorMessage(err, t));
      setAudioRefreshKey((key) => key + 1);
    } finally {
      setIsGeneratingSourceAudio(false);
    }
  };

  const requestGenerateSourceAudio = async () => {
    if (!canGenerateSourceAudio || isGeneratingSourceAudio) return;
    if (production.hasActiveJob || production.isBusy) return;
    setSourceAudioError(null);
    try {
      const existing = await guidesApi.getAudioOrNull(actualGuide.id, actualGuide.sourceLanguage);
      if (existing?.storageRef && (existing.status === 'ready' || existing.status === 'stale')) {
        setSourceAudioReplaceOpen(true);
        return;
      }
    } catch {
      // If status check fails, still attempt generate — server will validate.
    }
    await handleGenerateSourceAudio();
  };

  const openStartDialog = (mode: ProductionStartMode) => {
    setStartDialogMode(mode);
    setStartScope({ type: 'full_guide' });
    setProduceActionError(null);
    setStartDialogOpen(true);
  };

  const handleStartConfirm = async (options: { force: boolean; languages?: string[] }) => {
    if (startDialogMode === 'source') {
      setProduceActionError(null);
      const ok = await production.startJob(startScope, {
        force: options.force,
        languages: [actualGuide.sourceLanguage.toLowerCase()],
        phases: ['text_derivation'],
      });
      if (ok) {
        production.clearFailure();
        setStartDialogOpen(false);
      }
      return;
    }

    const selected = (options.languages ?? []).map((l) => l.toLowerCase());
    if (selected.length === 0) return;

    setProduceActionError(null);
    setLastTranslationLanguages(selected);

    try {
      production.clearFailure();
      const existing = new Set(presentations.map((p) => p.language.toLowerCase()));
      for (const lang of selected) {
        if (!existing.has(lang)) {
          await guidesApi.createPresentation(actualGuide.id, lang);
        }
      }
      const ok = await production.startJob(startScope, {
        force: options.force,
        languages: selected,
        phases: ['translation'],
      });
      if (ok) {
        setStartDialogOpen(false);
      }
    } catch {
      setProduceActionError(t('guides.production.start.prepareLanguagesFailed'));
    }
  };

  const handleStartRetry = async () => {
    setProduceActionError(null);
    if (startDialogMode === 'source') {
      const ok = await production.startJob(startScope, {
        force: false,
        languages: [actualGuide.sourceLanguage.toLowerCase()],
        phases: ['text_derivation'],
      });
      if (ok) {
        production.clearFailure();
        setStartDialogOpen(false);
      }
      return;
    }

    const languages =
      lastTranslationLanguages.length > 0
        ? lastTranslationLanguages
        : presentations
            .filter(
              (p) =>
                p.language.toLowerCase() !== actualGuide.sourceLanguage.toLowerCase() &&
                !p.presentationText?.trim(),
            )
            .map((p) => p.language.toLowerCase());

    if (languages.length === 0) {
      setProduceActionError(t('guides.production.start.prepareLanguagesFailed'));
      return;
    }

    const ok = await production.startJob(startScope, {
      force: false,
      languages,
      phases: ['translation'],
    });
    if (ok) {
      production.clearFailure();
      setStartDialogOpen(false);
    }
  };

  const usage = production.usageSummary;
  const sourceSummary = resolveSourceSummary(usage?.sources, production.job);
  const showUsageCard = Boolean(usage) || Boolean(sourceSummary);

  const showBanner =
    production.job &&
    (isProductionJobActive(production.job.status) ||
      production.job.status === 'completed' ||
      production.job.status === 'failed');

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>
              {tab.label}
              {tab.count != null ? (
                <>
                  {' '}
                  <span className="tabular-nums font-semibold">({tab.count})</span>
                </>
              ) : null}
            </span>
          </Button>
        );
      })}
    </div>
  );

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.guides')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={MapPin}
          className="h-9 w-9 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {actualGuide.displayName}
      </h3>
    </div>
  );

  const headerCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <div className="px-4 py-5">
        {titleLeading}
        <div className="mt-4">{tabChips}</div>
      </div>
    </Card>
  );

  const detailsCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('guides.tabs.details')}
        icon={MapPin}
        iconPlugin="guides"
        subtleTitle
        className="p-6"
      >
        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('guides.displayName')}
            </div>
            <div className={PLUGIN_PAGE_TITLE_CLASS}>{actualGuide.displayName}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className={GUIDE_LIFECYCLE_COLORS[actualGuide.lifecycleStatus]}>
              {lifecycleLabel(actualGuide.lifecycleStatus)}
            </Badge>
            <Badge className={GUIDE_LANGUAGE_SOURCE_BADGE_CLASS}>
              {actualGuide.sourceLanguage}
            </Badge>
          </div>

          {actualGuide.shortIntro && (
            <div className="border-t border-border/50 pt-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('guides.shortIntro')}
              </div>
              <div className="whitespace-pre-wrap text-sm">{actualGuide.shortIntro}</div>
            </div>
          )}

          <div className="border-t border-border/50 pt-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('guides.place.label')}
            </div>
            <div className="text-sm">
              {actualGuide.place?.displayName ||
                actualGuide.place?.formattedAddress ||
                actualGuide.geographicReference ||
                '—'}
            </div>
            {actualGuide.place?.formattedAddress &&
              actualGuide.place.displayName &&
              actualGuide.place.formattedAddress !== actualGuide.place.displayName && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {actualGuide.place.formattedAddress}
                </div>
              )}
          </div>
        </div>
      </DetailSection>
    </Card>
  );

  const presentationsCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('guides.tabs.presentations')}
        icon={Languages}
        iconPlugin="guides"
        subtleTitle
        className="p-6"
      >
        <GuidePresentationSection
          placeId={actualGuide.id}
          sourceLanguage={actualGuide.sourceLanguage}
          disabled={production.hasActiveJob || production.isBusy || isGeneratingSourceAudio}
          refreshKey={presentationsRefreshKey}
          audioRefreshKey={audioRefreshKey}
          onPresentationsChange={setPresentations}
          onAudioLedgerChange={() => void production.refreshJobs()}
        />
      </DetailSection>
    </Card>
  );

  const reviewContent =
    production.job && shouldShowReviewQueue(production.job) ? (
      <GuideReviewQueue
        ref={reviewQueueRef}
        placeId={actualGuide.id}
        job={production.job}
        items={production.items}
        isBusy={production.isBusy}
        onApproveItem={(id) => void production.approveItem(id)}
        onRejectItem={(id) => void production.rejectItem(id)}
        onRegenerateItem={(id) => void production.regenerateItem(id)}
        onApprovePhase={() => void production.approvePhase()}
      />
    ) : (
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('guides.tabs.review')}
          icon={ChevronRight}
          iconPlugin="guides"
          subtleTitle
          className="p-6"
        >
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('guides.tabs.reviewEmpty')}</p>
        </DetailSection>
      </Card>
    );

  return (
    <div className="plugin-guides">
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <GuideProductionPanel
              job={production.job}
              items={production.items}
              hasActiveJob={production.hasActiveJob}
              isBusy={production.isBusy}
              sourceHasText={sourceHasText}
              canGenerateSourceAudio={canGenerateSourceAudio}
              isGeneratingSourceAudio={isGeneratingSourceAudio}
              onStartSource={() => openStartDialog('source')}
              onStartTranslations={() => openStartDialog('translation')}
              onGenerateSourceAudio={() => void requestGenerateSourceAudio()}
              onShowReview={showReviewTab}
              onCancel={() => void production.cancelJob()}
            />

            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('guides.information.title')}
                icon={Info}
                iconPlugin="guides"
                className="p-4"
                collapsible
              >
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('guides.masterGuideId')}</span>
                    <span className="font-mono">{actualGuide.masterGuideId ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t('guides.information.totalCost')}
                    </span>
                    <span>
                      {production.placeTotalEstimatedCost
                        ? `~${production.placeTotalEstimatedCost.totalCost.toFixed(4)} ${production.placeTotalEstimatedCost.currency}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t('guides.information.totalCostAudio')}
                    </span>
                    <span>
                      {production.placeTotalEstimatedAudioCost
                        ? `~${production.placeTotalEstimatedAudioCost.totalCost.toFixed(4)} ${production.placeTotalEstimatedAudioCost.currency}`
                        : '—'}
                    </span>
                  </div>
                  {generatedLanguageCodes.length > 0 && (
                    <div className="border-t border-border/50 pt-3">
                      <div className="mb-1.5 text-muted-foreground">
                        {t('guides.information.generatedLanguages')}
                      </div>
                      <GuideLanguageBadges
                        languages={generatedLanguageCodes}
                        sourceLanguage={actualGuide.sourceLanguage}
                      />
                    </div>
                  )}
                </div>
              </DetailSection>
            </Card>

            <ProductionJobHistory
              jobs={production.jobs}
              selectedJobId={production.selectedJobId}
              onSelectJob={production.selectJob}
            />

            {showUsageCard && (
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={t('guides.usage.title')}
                  icon={Receipt}
                  iconPlugin="guides"
                  className="p-4"
                >
                  <div className="space-y-3 text-xs">
                    {usage && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            {t('guides.usage.provider')}
                          </span>
                          <span>{usage.provider ?? '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{t('guides.usage.model')}</span>
                          <span className="font-mono">{usage.model ?? '—'}</span>
                        </div>
                        <div className="border-t border-border/50 pt-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {t('guides.usage.inputTokens')}
                            </span>
                            <span>{usage.inputTokens.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {t('guides.usage.outputTokens')}
                            </span>
                            <span>{usage.outputTokens.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {t('guides.usage.totalTokens')}
                            </span>
                            <span>{usage.totalTokens.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="border-t border-border/50 pt-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {t('guides.usage.estCost')}
                            </span>
                            <span>
                              {usage.estimatedCost
                                ? `~${usage.estimatedCost.totalCost.toFixed(4)} ${usage.estimatedCost.currency}`
                                : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {t('guides.usage.latency')}
                            </span>
                            <span>
                              {usage.latencyMs > 0
                                ? `${(usage.latencyMs / 1000).toFixed(1)} s`
                                : '—'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                    {sourceSummary && (
                      <div className={usage ? 'border-t border-border/50 pt-3' : undefined}>
                        <SourceResearchSummary sources={sourceSummary} />
                      </div>
                    )}
                    {usage && (
                      <p className="text-[10px] text-muted-foreground">
                        {t('guides.usage.estimatedNote')}
                      </p>
                    )}
                  </div>
                </DetailSection>
              </Card>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {generalError && (
            <p className="text-sm text-destructive" role="alert">
              {generalError}
            </p>
          )}
          {production.error && (
            <p className="text-sm text-destructive" role="alert">
              {production.error}
            </p>
          )}

          {headerCard}

          {activeTab === 'details' ? detailsCard : null}
          {activeTab === 'presentations' ? presentationsCard : null}
          {activeTab === 'review' ? (
            <>
              {showBanner && production.job ? (
                <ProductionPhaseBanner
                  job={production.job}
                  items={production.items}
                  isPolling={production.isPolling}
                  isBusy={production.isBusy}
                  onCancel={() => void production.cancelJob()}
                  onRetry={() => void production.retryJob()}
                  onShowReview={showReviewTab}
                />
              ) : null}
              {reviewContent}
            </>
          ) : null}
        </div>
      </DetailLayout>

      <StartProductionDialog
        isOpen={startDialogOpen}
        mode={startDialogMode}
        scope={startScope}
        isBusy={production.isBusy}
        hasActiveJob={production.hasActiveJob}
        failureCode={production.failureCode}
        actionError={produceActionError}
        presentations={presentations}
        sourceLanguage={actualGuide.sourceLanguage}
        onConfirm={(options) => void handleStartConfirm(options)}
        onRetry={() => void handleStartRetry()}
        onClearFailure={() => {
          production.clearFailure();
          setProduceActionError(null);
        }}
        onCancel={() => {
          production.clearFailure();
          setProduceActionError(null);
          setStartDialogOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={sourceAudioReplaceOpen}
        title={t('guides.audio.regenerateTitle')}
        message={t('guides.audio.regenerateDescriptionReady')}
        confirmText={t('guides.audio.regenerate')}
        cancelText={t('common.cancel')}
        variant="warning"
        confirmDisabled={isGeneratingSourceAudio}
        onConfirm={() => {
          setSourceAudioReplaceOpen(false);
          void handleGenerateSourceAudio();
        }}
        onCancel={() => setSourceAudioReplaceOpen(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(sourceAudioError)}
        title={t('guides.audio.generateFailedTitle')}
        message={sourceAudioError ?? ''}
        confirmText={t('common.close')}
        variant="danger"
        onConfirm={() => setSourceAudioError(null)}
        onCancel={() => setSourceAudioError(null)}
      />
    </div>
  );
};
