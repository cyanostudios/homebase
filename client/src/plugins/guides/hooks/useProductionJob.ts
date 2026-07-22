import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { guidesApi } from '../api/guidesApi';
import type {
  GenerationUsageSummary,
  PlaceTotalEstimatedCost,
  ProductionItemStep,
  ProductionJob,
  ProductionJobDetail,
  ProductionJobItem,
  ProductionStartScope,
  StartProductionJobPayload,
} from '../types/guides';
import {
  findActiveJob,
  isProductionJobActive,
  isProductionJobTerminal,
  parseProductionJobListResponse,
  resolveProductionJobTargetId,
  shouldPollProductionJob,
  upsertJobInList,
} from '../utils/productionJobHelpers';
import { useGuides } from './useGuides';

const POLL_INTERVAL_MS = 3000;

export interface UseProductionJobResult {
  jobs: ProductionJob[];
  job: ProductionJob | null;
  items: ProductionJobItem[];
  usageSummary: GenerationUsageSummary | null;
  placeTotalEstimatedCost: PlaceTotalEstimatedCost | null;
  placeTotalEstimatedAudioCost: PlaceTotalEstimatedCost | null;
  isLoading: boolean;
  isPolling: boolean;
  isBusy: boolean;
  error: string | null;
  failureCode: string | null;
  selectedJobId: string | null;
  hasActiveJob: boolean;
  refreshJobs: () => Promise<void>;
  selectJob: (jobId: string | null) => void;
  startJob: (
    scope: ProductionStartScope,
    options?: { force?: boolean; languages?: string[]; phases?: ProductionItemStep[] },
  ) => Promise<boolean>;
  clearFailure: () => void;
  approveItem: (itemId: string) => Promise<void>;
  rejectItem: (itemId: string) => Promise<void>;
  regenerateItem: (itemId: string) => Promise<void>;
  approvePhase: () => Promise<void>;
  cancelJob: () => Promise<void>;
  retryJob: () => Promise<void>;
}

function scopeToPayload(
  scope: ProductionStartScope,
  options?: { force?: boolean; languages?: string[]; phases?: ProductionItemStep[] },
): StartProductionJobPayload {
  return {
    type: scope.type,
    force: options?.force,
    languages: options?.languages?.length ? options.languages : undefined,
    phases: options?.phases?.length ? options.phases : undefined,
  };
}

export function useProductionJob(placeId: string): UseProductionJobResult {
  const { t } = useTranslation();
  const { consumePendingProductionDetail, pendingProductionDetail } = useGuides();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [job, setJob] = useState<ProductionJob | null>(null);
  const [items, setItems] = useState<ProductionJobItem[]>([]);
  const [usageSummary, setUsageSummary] = useState<GenerationUsageSummary | null>(null);
  const [placeTotalEstimatedCost, setPlaceTotalEstimatedCost] =
    useState<PlaceTotalEstimatedCost | null>(null);
  const [placeTotalEstimatedAudioCost, setPlaceTotalEstimatedAudioCost] =
    useState<PlaceTotalEstimatedCost | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failureCode, setFailureCode] = useState<string | null>(null);
  const selectedJobIdRef = useRef<string | null>(null);
  const jobRef = useRef<ProductionJob | null>(null);

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  }, [selectedJobId]);

  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  const applyDetail = useCallback(
    (detail: {
      job: ProductionJob;
      items: ProductionJobItem[];
      usageSummary?: GenerationUsageSummary | null;
      placeTotalEstimatedCost?: PlaceTotalEstimatedCost | null;
      placeTotalEstimatedAudioCost?: PlaceTotalEstimatedCost | null;
    }) => {
      setJob(detail.job);
      setItems(detail.items);
      if (detail.usageSummary !== undefined) {
        setUsageSummary(detail.usageSummary);
      }
      if (detail.placeTotalEstimatedCost !== undefined) {
        setPlaceTotalEstimatedCost(detail.placeTotalEstimatedCost);
      }
      if (detail.placeTotalEstimatedAudioCost !== undefined) {
        setPlaceTotalEstimatedAudioCost(detail.placeTotalEstimatedAudioCost);
      }
      setJobs((prev) => upsertJobInList(prev, detail.job));
      setSelectedJobId(detail.job.id);
    },
    [],
  );

  const seedFromPendingDetail = useCallback(
    (detail: ProductionJobDetail | null) => {
      if (!detail?.job) return false;
      if (placeId && String(detail.job.placeId) !== String(placeId)) return false;
      applyDetail(detail);
      setIsLoading(false);
      return true;
    },
    [applyDetail, placeId],
  );

  // Apply Save-and-produce job before paint so the status banner is visible immediately.
  useLayoutEffect(() => {
    if (!placeId || !pendingProductionDetail) return;
    const detail = consumePendingProductionDetail();
    seedFromPendingDetail(detail);
  }, [placeId, pendingProductionDetail, consumePendingProductionDetail, seedFromPendingDetail]);

  const refreshJobs = useCallback(async () => {
    if (!placeId) return;
    setError(null);
    try {
      const listResponse = await guidesApi.listProductionJobs(placeId);
      const {
        jobs: jobsList,
        placeTotalEstimatedCost: placeCost,
        placeTotalEstimatedAudioCost: audioCost,
      } = parseProductionJobListResponse(listResponse);
      setJobs(jobsList);
      setPlaceTotalEstimatedCost(placeCost);
      setPlaceTotalEstimatedAudioCost(audioCost);
      const targetId = resolveProductionJobTargetId(jobsList, selectedJobIdRef.current);
      if (!targetId) {
        // Avoid clearing a freshly seeded active job when a concurrent list fetch is stale.
        const current = jobRef.current;
        if (current && isProductionJobActive(current.status)) {
          return;
        }
        setJob(null);
        setItems([]);
        setUsageSummary(null);
        return;
      }
      const detail = await guidesApi.getProductionJob(placeId, targetId);
      applyDetail(detail);
      if (!selectedJobIdRef.current) {
        setSelectedJobId(targetId);
      }
    } catch {
      setError(t('guides.production.loadFailed'));
      setJobs([]);
      setJob(null);
      setItems([]);
      setUsageSummary(null);
      setPlaceTotalEstimatedCost(null);
      setPlaceTotalEstimatedAudioCost(null);
    }
  }, [applyDetail, placeId, t]);

  const loadJobDetail = useCallback(
    async (jobId: string) => {
      const detail = await guidesApi.getProductionJob(placeId, jobId);
      applyDetail(detail);
      if (isProductionJobTerminal(detail.job.status)) {
        const {
          jobs: jobsList,
          placeTotalEstimatedCost: placeCost,
          placeTotalEstimatedAudioCost: audioCost,
        } = parseProductionJobListResponse(await guidesApi.listProductionJobs(placeId));
        setJobs(jobsList);
        setPlaceTotalEstimatedCost(placeCost);
        setPlaceTotalEstimatedAudioCost(audioCost);
      }
      return detail;
    },
    [applyDetail, placeId],
  );

  useEffect(() => {
    let cancelled = false;
    if (!placeId) {
      setIsLoading(false);
      return;
    }
    const alreadySeeded =
      jobRef.current != null && String(jobRef.current.placeId) === String(placeId);
    if (!alreadySeeded) {
      setIsLoading(true);
    }
    void refreshJobs().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshJobs, placeId]);

  useEffect(() => {
    if (!job || !shouldPollProductionJob(job.status)) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    const intervalId = window.setInterval(() => {
      void loadJobDetail(job.id).catch(() => {
        setError(t('guides.production.loadFailed'));
      });
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      setIsPolling(false);
    };
  }, [job?.id, job?.status, loadJobDetail, t]);

  const selectJob = useCallback(
    (jobId: string | null) => {
      setSelectedJobId(jobId);
      if (!jobId) {
        setJob(null);
        setItems([]);
        setUsageSummary(null);
        return;
      }
      setIsLoading(true);
      void loadJobDetail(jobId)
        .catch(() => setError(t('guides.production.loadFailed')))
        .finally(() => setIsLoading(false));
    },
    [loadJobDetail, t],
  );

  const runMutation = useCallback(
    async (
      action: () => Promise<{
        job: ProductionJob;
        items: ProductionJobItem[];
        usageSummary?: GenerationUsageSummary | null;
        placeTotalEstimatedCost?: PlaceTotalEstimatedCost | null;
        placeTotalEstimatedAudioCost?: PlaceTotalEstimatedCost | null;
      }>,
    ) => {
      setIsBusy(true);
      setError(null);
      setFailureCode(null);
      try {
        const result = await action();
        applyDetail(result);
        const {
          jobs: jobsList,
          placeTotalEstimatedCost: placeCost,
          placeTotalEstimatedAudioCost: audioCost,
        } = parseProductionJobListResponse(await guidesApi.listProductionJobs(placeId));
        setJobs(jobsList);
        setPlaceTotalEstimatedCost(placeCost);
        setPlaceTotalEstimatedAudioCost(audioCost);
        setSelectedJobId(result.job.id);
      } catch (err) {
        const status = (err as { status?: number }).status;
        const code = (err as { code?: string }).code;
        if (status === 409) {
          setError(t('guides.production.activeJobConflict'));
        } else if (status === 422 && code) {
          setFailureCode(code);
          setError(null);
        } else {
          setError(t('guides.production.actionFailed'));
        }
        throw err;
      } finally {
        setIsBusy(false);
      }
    },
    [applyDetail, placeId, t],
  );

  const startJob = useCallback(
    async (
      scope: ProductionStartScope,
      options?: { force?: boolean; languages?: string[]; phases?: ProductionItemStep[] },
    ) => {
      try {
        await runMutation(() =>
          guidesApi.startProductionJob(placeId, scopeToPayload(scope, options)),
        );
        return true;
      } catch {
        return false;
      }
    },
    [placeId, runMutation],
  );

  const clearFailure = useCallback(() => {
    setFailureCode(null);
  }, []);

  const approveItem = useCallback(
    async (itemId: string) => {
      if (!job) return;
      await runMutation(() => guidesApi.approveProductionJobItem(placeId, job.id, itemId));
    },
    [job, placeId, runMutation],
  );

  const rejectItem = useCallback(
    async (itemId: string) => {
      if (!job) return;
      await runMutation(() => guidesApi.rejectProductionJobItem(placeId, job.id, itemId));
    },
    [job, placeId, runMutation],
  );

  const regenerateItem = useCallback(
    async (itemId: string) => {
      if (!job) return;
      await runMutation(() => guidesApi.regenerateProductionJobItem(placeId, job.id, itemId));
    },
    [job, placeId, runMutation],
  );

  const approvePhase = useCallback(async () => {
    if (!job) return;
    await runMutation(() =>
      guidesApi.approveProductionJobPhase(placeId, job.id, { continue: true }),
    );
  }, [job, placeId, runMutation]);

  const cancelJob = useCallback(async () => {
    if (!job) return;
    await runMutation(() => guidesApi.cancelProductionJob(placeId, job.id));
  }, [job, placeId, runMutation]);

  const retryJob = useCallback(async () => {
    if (!job) return;
    await runMutation(() => guidesApi.retryProductionJob(placeId, job.id));
  }, [job, placeId, runMutation]);

  const active = findActiveJob(jobs);

  return {
    jobs,
    job,
    items,
    usageSummary,
    placeTotalEstimatedCost,
    placeTotalEstimatedAudioCost,
    isLoading,
    isPolling,
    isBusy,
    error,
    failureCode,
    selectedJobId,
    hasActiveJob: active !== null || (job != null && isProductionJobActive(job.status)),
    refreshJobs,
    selectJob,
    startJob,
    clearFailure,
    approveItem,
    rejectItem,
    regenerateItem,
    approvePhase,
    cancelJob,
    retryJob,
  };
}
