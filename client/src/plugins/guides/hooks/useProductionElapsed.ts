import { useEffect, useState } from 'react';

import type { ProductionJob } from '../types/guides';
import {
  formatProductionElapsed,
  getProductionElapsedStartIso,
  isProductionJobGenerating,
} from '../utils/productionJobHelpers';

/**
 * Live elapsed clock while a production job is generating.
 * Returns null when not generating or start time is missing/invalid.
 */
export function useProductionElapsed(job: ProductionJob | null | undefined): string | null {
  const enabled = Boolean(job && isProductionJobGenerating(job.status));
  const startIso = job ? getProductionElapsedStartIso(job) : null;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || !startIso) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled, startIso, job?.id]);

  if (!enabled || !startIso) return null;
  const startMs = Date.parse(startIso);
  if (!Number.isFinite(startMs)) return null;
  return formatProductionElapsed(Math.max(0, nowMs - startMs));
}
