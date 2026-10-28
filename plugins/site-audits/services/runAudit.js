// plugins/site-audits/services/runAudit.js
// Orchestrates one manual audit run: concurrency gate (max 1/user, max 2 global, in-memory),
// crawl + score the target site (and optional competitor), persist results, update
// site_audits.last_score/last_run_at. Runs in-process, asynchronously, after the 202 response.
const { Database, Logger } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');
const { crawl, MAX_PAGES, QUICK_MAX_PAGES } = require('./crawler');
const { analyzeSite } = require('./scoring');
const { compareSummaries } = require('./compare');
const {
  CANCELLED_MESSAGE,
  cleanupJob,
  isCancelledError,
  registerJob,
  requestCancelByRunId,
  throwIfAborted,
} = require('./auditCancel');

const MAX_RUNS_PER_USER = 1;
const MAX_RUNS_GLOBAL = 2;
const STALE_RUN_MINUTES = 30;

// In-memory only — matches the single-process, no-separate-worker design in the ADR.
// A "job" is one POST /:id/runs invocation (which may crawl both the site and its
// competitor sequentially); it counts as a single concurrency slot either way.
const activeJobsByUser = new Map(); // userId -> Set<jobId>
let activeGlobalCount = 0;

function normalizeUserId(userId) {
  return String(userId);
}

function canStartJob(userId) {
  const userActive = activeJobsByUser.get(normalizeUserId(userId))?.size || 0;
  return activeGlobalCount < MAX_RUNS_GLOBAL && userActive < MAX_RUNS_PER_USER;
}

/**
 * Check and take a concurrency slot in one synchronous step. startRun must use this
 * rather than canStartJob + a later acquire: there are awaits between those, and a
 * second request can pass the check before the first one records the slot.
 * @returns {boolean} true when the slot was taken
 */
function tryAcquireSlot(userId, jobId) {
  if (!canStartJob(userId)) return false;
  const key = normalizeUserId(userId);
  activeGlobalCount += 1;
  if (!activeJobsByUser.has(key)) {
    activeJobsByUser.set(key, new Set());
  }
  activeJobsByUser.get(key).add(jobId);
  return true;
}

function releaseSlot(userId, jobId) {
  const key = normalizeUserId(userId);
  const jobs = activeJobsByUser.get(key);
  if (!jobs || !jobs.has(jobId)) {
    return;
  }
  jobs.delete(jobId);
  if (jobs.size === 0) {
    activeJobsByUser.delete(key);
  }
  activeGlobalCount = Math.max(0, activeGlobalCount - 1);
}

function resetForTests() {
  activeJobsByUser.clear();
  activeGlobalCount = 0;
}

/**
 * Mark any run stuck in `queued`/`running` past the staleness window as `failed`. Called
 * lazily (no separate worker/cron) before creating a new run and before listing runs, scoped
 * to the caller's own tenant pool.
 * Scoped to the caller's user_id so a shared tenant pool cannot fail another user's runs.
 * @param {import('pg').Pool} pool
 * @param {string|number} userId
 */
async function failStaleRuns(pool, userId) {
  if (!pool || typeof pool.query !== 'function' || userId == null || userId === '') {
    return { failed: 0 };
  }
  try {
    const result = await pool.query(
      `
        UPDATE site_audit_runs AS r
        SET status = 'failed',
            error = 'Run exceeded the maximum allowed duration and was marked failed automatically',
            finished_at = NOW()
        FROM site_audits AS s
        WHERE r.site_audit_id = s.id
          AND s.user_id = $1
          AND r.status IN ('queued', 'running')
          AND r.started_at < NOW() - ($2::int * INTERVAL '1 minute')
        RETURNING r.id
      `,
      [userId, STALE_RUN_MINUTES],
    );
    return { failed: result.rows?.length || 0 };
  } catch (error) {
    Logger.error('Failed to mark stale site-audit runs as failed', error);
    return { failed: 0 };
  }
}

async function finishIfActive(model, req, runId, payload) {
  try {
    return await model.finishRunIfActive(req, runId, payload);
  } catch (error) {
    Logger.error('Failed to finish site audit run', error, { runId, status: payload?.status });
    return null;
  }
}

async function executeTarget(model, req, run, targetUrl, signal, mode) {
  throwIfAborted(signal);
  const auditMode = mode === 'quick' ? 'quick' : 'full';
  const crawlResult = await crawl(targetUrl, { signal, mode: auditMode });
  throwIfAborted(signal);
  // Crawl pages still carry analysis.techHints. analyzeSite scores them; pre-scoring
  // would drop the HTML signals the technology inventory reads.
  const summary = analyzeSite(crawlResult.pages, crawlResult.siteMeta);
  throwIfAborted(signal);
  const pageCap = auditMode === 'quick' ? QUICK_MAX_PAGES : MAX_PAGES;
  const finished = await model.finishRunIfActive(req, run.id, {
    status: 'done',
    score: summary.score,
    summary,
    pages: summary.pages.slice(0, pageCap),
  });
  if (!finished) {
    throwIfAborted(signal);
    return null;
  }
  return summary;
}

async function runJob(
  model,
  req,
  { userId, jobId, siteAudit, siteRun, competitorRun, signal, mode },
) {
  try {
    let siteSummary = null;
    let competitorSummary = null;

    try {
      siteSummary = await executeTarget(model, req, siteRun, siteAudit.url, signal, mode);
    } catch (error) {
      if (isCancelledError(error) || signal?.aborted) {
        await finishIfActive(model, req, siteRun.id, {
          status: 'cancelled',
          error: CANCELLED_MESSAGE,
        });
      } else {
        Logger.error('Site audit crawl failed', error, {
          siteAuditId: siteAudit.id,
          runId: siteRun.id,
        });
        await finishIfActive(model, req, siteRun.id, {
          status: 'failed',
          error: error.message || 'Crawl failed',
        });
      }
    }

    if (competitorRun && siteAudit.competitorUrl) {
      if (signal?.aborted) {
        await finishIfActive(model, req, competitorRun.id, {
          status: 'cancelled',
          error: CANCELLED_MESSAGE,
        });
      } else {
        try {
          competitorSummary = await executeTarget(
            model,
            req,
            competitorRun,
            siteAudit.competitorUrl,
            signal,
            mode,
          );
        } catch (error) {
          if (isCancelledError(error) || signal?.aborted) {
            await finishIfActive(model, req, competitorRun.id, {
              status: 'cancelled',
              error: CANCELLED_MESSAGE,
            });
          } else {
            Logger.error('Competitor audit crawl failed', error, {
              siteAuditId: siteAudit.id,
              runId: competitorRun.id,
            });
            await finishIfActive(model, req, competitorRun.id, {
              status: 'failed',
              error: error.message || 'Crawl failed',
            });
          }
        }
      }
    }

    if (siteSummary) {
      await model.markSiteAuditScore(req, siteAudit.id, {
        lastScore: siteSummary.score,
        lastRunAt: new Date(),
      });
    }

    if (siteSummary && competitorSummary) {
      const comparison = compareSummaries(siteSummary, competitorSummary);
      await model.attachComparison(req, siteRun.id, comparison);
      await model.attachComparison(req, competitorRun.id, comparison);
    }
  } finally {
    cleanupJob(jobId);
    releaseSlot(userId, jobId);
  }
}

async function abandonRuns(model, req, runs) {
  for (const run of runs) {
    if (!run) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      await model.finishRun(req, run.id, {
        status: 'failed',
        error: 'Audit run could not be started',
      });
    } catch (error) {
      Logger.error('Failed to abandon site audit run', error, { runId: run.id });
    }
  }
}

/**
 * @param {import('../model')} model
 * @param {import('express').Request} req
 * @param {string|number} siteAuditId
 * @param {{ mode?: 'full'|'quick' }} [options]
 */
async function startRun(model, req, siteAuditId, options = {}) {
  const mode = options?.mode === 'quick' ? 'quick' : 'full';
  const db = Database.get(req);
  const userId = db.getUserId();
  if (!userId) {
    throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
  }

  await failStaleRuns(db.getPool(), userId);

  const siteAudit = await model.getById(req, siteAuditId);
  if (!siteAudit) {
    throw new AppError('Site audit not found', 404, AppError.CODES.NOT_FOUND);
  }

  const jobId = `${userId}:${siteAudit.id}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  if (!tryAcquireSlot(userId, jobId)) {
    throw new AppError(
      'Too many audits are running right now. Please wait for the current run to finish and try again.',
      429,
      AppError.CODES.SERVICE_UNAVAILABLE,
    );
  }

  let handedOff = false;
  let siteRun = null;
  let competitorRun = null;
  try {
    siteRun = await model.createRun(req, siteAudit.id, { target: 'site' });
    if (siteAudit.competitorUrl) {
      competitorRun = await model.createRun(req, siteAudit.id, { target: 'competitor' });
    }

    await model.markRunRunning(req, siteRun.id);
    if (competitorRun) {
      await model.markRunRunning(req, competitorRun.id);
    }

    const signal = registerJob(jobId, [siteRun.id, competitorRun?.id].filter(Boolean));

    handedOff = true;
    // Fire-and-forget: the HTTP response (202) returns immediately; the job continues using the
    // same `req` (whose tenant pool stays open for the app's lifetime, not just this request).
    // runJob's finally releases the slot; releasing again here would free a slot still in use
    // or double-decrement the global counter.
    runJob(model, req, { userId, jobId, siteAudit, siteRun, competitorRun, signal, mode }).catch(
      (error) => {
        Logger.error('Site audit run job crashed', error, { siteAuditId: siteAudit.id, jobId });
      },
    );

    return {
      site: siteAudit,
      run: await model.getRunById(req, siteAudit.id, siteRun.id),
      competitorRun: competitorRun
        ? await model.getRunById(req, siteAudit.id, competitorRun.id)
        : null,
    };
  } catch (error) {
    if (!handedOff) {
      cleanupJob(jobId);
      releaseSlot(userId, jobId);
      await abandonRuns(model, req, [siteRun, competitorRun]);
    }
    throw error;
  }
}

/**
 * Stop an active run (and its same-job competitor leg when present).
 * @param {import('../model')} model
 * @param {import('express').Request} req
 * @param {string|number} siteAuditId
 * @param {string|number} runId
 */
async function cancelRun(model, req, siteAuditId, runId) {
  const run = await model.getRunById(req, siteAuditId, runId);
  if (!run) {
    throw new AppError('Audit run not found', 404, AppError.CODES.NOT_FOUND);
  }
  if (run.status !== 'queued' && run.status !== 'running') {
    return { run, cancelled: false, runs: [run] };
  }

  const { runIds } = requestCancelByRunId(run.id);
  const cancelledRuns = [];
  for (const id of runIds) {
    // eslint-disable-next-line no-await-in-loop
    const updated = await model.finishRunIfActive(req, id, {
      status: 'cancelled',
      error: CANCELLED_MESSAGE,
    });
    if (updated) {
      cancelledRuns.push(updated);
    }
  }

  // If the in-memory job map was cold (process restart), still cancel this run in DB.
  if (!cancelledRuns.length) {
    const updated = await model.finishRunIfActive(req, run.id, {
      status: 'cancelled',
      error: CANCELLED_MESSAGE,
    });
    if (updated) cancelledRuns.push(updated);
  }

  const fresh = await model.getRunById(req, siteAuditId, runId);
  return {
    run: fresh,
    cancelled: cancelledRuns.length > 0 || fresh?.status === 'cancelled',
    runs: cancelledRuns.length ? cancelledRuns : fresh ? [fresh] : [],
  };
}

module.exports = {
  startRun,
  cancelRun,
  failStaleRuns,
  // Exposed for unit tests only — not part of the plugin's public surface.
  __testing: { canStartJob, tryAcquireSlot, releaseSlot, resetForTests },
};
