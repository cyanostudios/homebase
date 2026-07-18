import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { guidesApi } from '../api/guidesApi';
import type {
  GenerationUsageSummary,
  ProductionJob,
  ProductionJobItem,
  ProductionStartScope,
  StartProductionJobPayload,
} from '../types/guides';
import {
  findActiveJob,
  isProductionJobTerminal,
  shouldPollProductionJob,
  upsertJobInList,
} from '../utils/productionJobHelpers';

const POLL_INTERVAL_MS = 3000;

export interface UseProductionJobResult {
  jobs: ProductionJob[];
  job: ProductionJob | null;
  items: ProductionJobItem[];
  usageSummary: GenerationUsageSummary | null;
  isLoading: boolean;
  isPolling: boolean;
  isBusy: boolean;
  error: string | null;
  failureCode: string | null;
  selectedJobId: string | null;
  hasActiveJob: boolean;
  refreshJobs: () => Promise<void>;
  selectJob: (jobId: string | null) => void;
  startJob: (scope: ProductionStartScope, options?: { force?: boolean }) => Promise<boolean>;
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
  options?: { force?: boolean },
): StartProductionJobPayload {
  return {
    type: scope.type,
    force: options?.force,
  };
}

export function useProductionJob(placeId: string): UseProductionJobResult {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [job, setJob] = useState<ProductionJob | null>(null);
  const [items, setItems] = useState<ProductionJobItem[]>([]);
  const [usageSummary, setUsageSummary] = useState<GenerationUsageSummary | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failureCode, setFailureCode] = useState<string | null>(null);
  const selectedJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  }, [selectedJobId]);

  const applyDetail = useCallback(
    (detail: {
      job: ProductionJob;
      items: ProductionJobItem[];
      usageSummary?: GenerationUsageSummary | null;
    }) => {
      setJob(detail.job);
      setItems(detail.items);
      if (detail.usageSummary !== undefined) {
        setUsageSummary(detail.usageSummary);
      }
      setJobs((prev) => upsertJobInList(prev, detail.job));
    },
    [],
  );

  const refreshJobs = useCallback(async () => {
    if (!placeId) return;
    setError(null);
    try {
      const list = await guidesApi.listProductionJobs(placeId);
      setJobs(list);
      const active = findActiveJob(list);
      const targetId = selectedJobIdRef.current ?? active?.id ?? null;
      if (!targetId) {
        setJob(null);
        setItems([]);
        setUsageSummary(null);
        return;
      }
      const detail = await guidesApi.getProductionJob(placeId, targetId);
      applyDetail(detail);
      if (!selectedJobIdRef.current && active) {
        setSelectedJobId(active.id);
      }
    } catch {
      setError(t('guides.production.loadFailed'));
      setJobs([]);
      setJob(null);
      setItems([]);
      setUsageSummary(null);
    }
  }, [applyDetail, placeId, t]);

  const loadJobDetail = useCallback(
    async (jobId: string) => {
      const detail = await guidesApi.getProductionJob(placeId, jobId);
      applyDetail(detail);
      if (isProductionJobTerminal(detail.job.status)) {
        const list = await guidesApi.listProductionJobs(placeId);
        setJobs(list);
      }
      return detail;
    },
    [applyDetail, placeId],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void refreshJobs().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshJobs]);

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
      }>,
    ) => {
      setIsBusy(true);
      setError(null);
      setFailureCode(null);
      try {
        const result = await action();
        applyDetail(result);
        const list = await guidesApi.listProductionJobs(placeId);
        setJobs(list);
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
    async (scope: ProductionStartScope, options?: { force?: boolean }) => {
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
    isLoading,
    isPolling,
    isBusy,
    error,
    failureCode,
    selectedJobId,
    hasActiveJob: active !== null,
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
