// plugins/guides/production/ProductionOrchestrationService.js
const { Logger } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');
const { computeProductionFingerprint } = require('./fingerprint');
const {
  ProductionJobModel,
  ITEM_STEPS,
  DEFAULT_PHASES,
  CHECKPOINT_MODES,
} = require('./ProductionJobModel');
const TextProviderRegistry = require('../providers/text/TextProviderRegistry');
const TranslationProviderRegistry = require('../providers/translation/TranslationProviderRegistry');
const { ensureTextProvidersRegistered } = require('../providers/text/registerDefaultProviders');
const {
  ensureTranslationProvidersRegistered,
} = require('../providers/translation/registerDefaultProviders');

const DEFAULT_TEXT_PROVIDER = 'noop';
const DEFAULT_TRANSLATION_PROVIDER = 'noop';
const WORKER_BATCH_SIZE = Number(process.env.GUIDES_PRODUCTION_WORKER_BATCH_SIZE) || 5;
const IN_FLIGHT_ITEM_STATUSES = ['pending', 'queued', 'processing', 'awaiting_callback'];
const REGENERATABLE_REVIEW_STATUSES = ['pending_review', 'rejected'];

class ProductionOrchestrationService {
  /**
   * @param {import('../model')} guidesModel
   */
  constructor(guidesModel) {
    this.guidesModel = guidesModel;
    this.jobModel = new ProductionJobModel();
  }

  /**
   * Enqueue a production job; worker processes asynchronously.
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {{ type: string, stopId?: string, variantId?: string, phases?: string[], steps?: string[], checkpointMode?: string, force?: boolean, languages?: string[] }} options
   */
  async startJob(req, placeId, options) {
    await this.guidesModel.getById(req, placeId);

    if (await this.jobModel.hasActiveJob(req, placeId)) {
      throw new AppError(
        'A production job is already active for this place',
        409,
        AppError.CODES.CONFLICT,
      );
    }

    const phases = this._normalizePhases(options.phases ?? options.steps);
    const checkpointMode = this._normalizeCheckpointMode(options.checkpointMode);
    const job = await this.jobModel.createJob(req, placeId, {
      type: options.type,
      scopeStopId: options.stopId ?? null,
      scopeVariantId: options.variantId ?? null,
      phases,
      checkpointMode,
      jobOptions: {
        type: options.type,
        stopId: options.stopId ?? null,
        variantId: options.variantId ?? null,
        phases,
        languages: this._normalizeLanguages(options.languages),
        force: Boolean(options.force),
      },
      queuedAt: new Date().toISOString(),
    });

    const items = await this.jobModel.listJobItems(req, job.id);
    return { job, items };
  }

  /**
   * Approve current review phase and optionally continue to the next phase.
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} jobId
   * @param {{ continue?: boolean }} options
   */
  async approvePhase(req, placeId, jobId, options = {}) {
    const continuePipeline = options.continue !== false;
    const job = await this.jobModel.getJobById(req, placeId, jobId);
    if (job.status !== 'awaiting_review') {
      throw new AppError(
        'Only jobs awaiting review can approve a phase',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }

    const phaseIndex = job.currentPhaseIndex;
    const items = await this.jobModel.listJobItems(req, jobId);
    const phaseItems = items.filter((item) => item.phaseIndex === phaseIndex);

    this._assertPhaseCanAdvance(phaseItems);

    const phases = Array.isArray(job.phases) ? job.phases : DEFAULT_PHASES;
    const isLastPhase = phaseIndex >= phases.length - 1;

    let updated;
    if (isLastPhase || !continuePipeline) {
      updated = await this.jobModel.updateJobStatus(req, placeId, jobId, 'completed', {
        reviewPhase: null,
      });
    } else {
      updated = await this.jobModel.requeueJobForNextPhase(req, placeId, jobId);
    }

    await this.jobModel.appendEvent(req, jobId, 'phase_approved', {
      phaseIndex,
      continued: !isLastPhase && continuePipeline,
    });

    const refreshedItems = await this.jobModel.listJobItems(req, jobId);
    return { job: updated, items: refreshedItems };
  }

  /**
   * Approve a single completed item in the current review phase.
   */
  async approveItem(req, placeId, jobId, itemId) {
    const job = await this._requireJobAwaitingReview(req, placeId, jobId);
    const item = await this.jobModel.getJobItemById(req, jobId, itemId);
    this._validateItemInCurrentPhase(item, job);

    const updated = await this._approveSingleItem(req, placeId, item);
    await this.jobModel.appendEvent(req, jobId, 'item_approved', { itemId }, itemId);

    const refreshedJob = await this.jobModel.getJobById(req, placeId, jobId);
    const items = await this.jobModel.listJobItems(req, jobId);
    return { job: refreshedJob, item: updated, items };
  }

  /**
   * Reject a completed item; domain remains unchanged.
   */
  async rejectItem(req, placeId, jobId, itemId, options = {}) {
    const job = await this._requireJobAwaitingReview(req, placeId, jobId);
    const item = await this.jobModel.getJobItemById(req, jobId, itemId);
    this._validateItemInCurrentPhase(item, job);
    this._requireReviewableItem(item);

    const updated = await this.jobModel.updateJobItem(req, item.id, { reviewStatus: 'rejected' });
    await this.jobModel.appendEvent(
      req,
      jobId,
      'item_rejected',
      { itemId, reason: options.reason ?? null },
      itemId,
    );

    const refreshedJob = await this.jobModel.getJobById(req, placeId, jobId);
    const items = await this.jobModel.listJobItems(req, jobId);
    return { job: refreshedJob, item: updated, items };
  }

  /**
   * Supersede an item and enqueue a forced regeneration in the same phase.
   */
  async regenerateItem(req, placeId, jobId, itemId) {
    const job = await this._requireJobAwaitingReview(req, placeId, jobId);
    const item = await this.jobModel.getJobItemById(req, jobId, itemId);
    this._validateItemInCurrentPhase(item, job);
    this._requireRegeneratableItem(item);

    await this.jobModel.updateJobItem(req, item.id, { reviewStatus: 'superseded' });

    const stop = await this.guidesModel.getStopById(req, placeId, item.stopId);
    const variant = await this.guidesModel.getVariantById(
      req,
      placeId,
      item.stopId,
      item.variantId,
    );
    const place = await this.guidesModel.getById(req, placeId);
    const providerKey = item.providerKey || this._providerKeyForStep(item.step);
    const providerVersion =
      item.providerVersion || this._providerVersionForStep(item.step, providerKey);
    const fingerprint = this._computeFingerprintForTarget({
      step: item.step,
      stop,
      variant,
      place,
      providerKey,
      providerVersion,
      regenerateNonce: item.id,
    });

    const newItem = await this.jobModel.createJobItem(req, jobId, {
      stopId: item.stopId,
      variantId: item.variantId,
      step: item.step,
      phaseIndex: item.phaseIndex,
      status: 'pending',
      fingerprint,
      providerKey,
      providerVersion,
    });

    await this.jobModel.updateJobStatus(req, placeId, jobId, 'processing', {
      reviewPhase: null,
    });
    await this.jobModel.appendEvent(
      req,
      jobId,
      'item_regenerated',
      { oldItemId: item.id, newItemId: newItem.id },
      item.id,
    );

    const refreshedJob = await this.jobModel.getJobById(req, placeId, jobId);
    const items = await this.jobModel.listJobItems(req, jobId);
    return { job: refreshedJob, item: newItem, items };
  }

  /**
   * Bulk-approve all pending_review items in the current review phase.
   */
  async bulkApproveItemsInPhase(req, placeId, jobId) {
    const job = await this._requireJobAwaitingReview(req, placeId, jobId);
    const items = await this.jobModel.listJobItems(req, jobId);
    const phaseItems = items.filter(
      (item) =>
        item.phaseIndex === job.currentPhaseIndex &&
        item.status === 'completed' &&
        (item.reviewStatus === 'pending_review' || item.reviewStatus == null),
    );

    for (const item of phaseItems) {
      await this._approveSingleItem(req, placeId, item);
      await this.jobModel.appendEvent(req, jobId, 'item_approved', { itemId: item.id }, item.id);
    }

    const refreshedJob = await this.jobModel.getJobById(req, placeId, jobId);
    const refreshedItems = await this.jobModel.listJobItems(req, jobId);
    return { job: refreshedJob, items: refreshedItems };
  }

  /**
   * Retry a failed job from the current phase.
   */
  async retryJob(req, placeId, jobId) {
    const job = await this.jobModel.getJobById(req, placeId, jobId);
    if (job.status !== 'failed') {
      throw new AppError('Only failed jobs can be retried', 400, AppError.CODES.VALIDATION_ERROR);
    }

    await this.jobModel.resetFailedItemsInPhase(req, jobId, job.currentPhaseIndex);
    const updated = await this.jobModel.updateJobStatus(req, placeId, jobId, 'pending', {
      clearErrorMessage: true,
    });
    await this.jobModel.appendEvent(req, jobId, 'job_retried', {
      phaseIndex: job.currentPhaseIndex,
    });

    const items = await this.jobModel.listJobItems(req, jobId);
    return { job: updated, items };
  }

  /**
   * @deprecated Use approvePhase instead.
   */
  async approveJob(req, placeId, jobId) {
    Logger.warn('POST …/production-jobs/:jobId/approve is deprecated; use approve-phase', {
      placeId,
      jobId,
    });
    return this.approvePhase(req, placeId, jobId, { continue: true });
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} jobId
   */
  async cancelJob(req, placeId, jobId) {
    const job = await this.jobModel.getJobById(req, placeId, jobId);
    if (!['pending', 'planning', 'processing', 'awaiting_review'].includes(job.status)) {
      throw new AppError('Job cannot be cancelled', 400, AppError.CODES.VALIDATION_ERROR);
    }
    await this.jobModel.cancelActiveItemsForJob(req, jobId);
    const updated = await this.jobModel.updateJobStatus(req, placeId, jobId, 'cancelled');
    const items = await this.jobModel.listJobItems(req, jobId);
    return { job: updated, items };
  }

  async getJob(req, placeId, jobId) {
    const job = await this.jobModel.getJobById(req, placeId, jobId);
    const items = await this.jobModel.listJobItems(req, jobId);
    return { job, items };
  }

  async listJobs(req, placeId) {
    const jobs = await this.jobModel.listJobs(req, placeId);
    return jobs;
  }

  /**
   * One worker tick for a single tenant context.
   * @param {import('express').Request} req
   * @returns {Promise<number>} number of items claimed for processing in this tick
   */
  async runWorkerTick(req) {
    let itemsClaimed = 0;
    await this._resumeStalledPlanningJobs(req);
    const claimedJob = await this.jobModel.claimPendingJob(req);
    if (claimedJob) {
      try {
        const freshJob = await this.jobModel.getJobByIdInternal(req, claimedJob.id);
        if (freshJob.status === 'cancelled') {
          Logger.info('Skipping planning for cancelled production job', { jobId: claimedJob.id });
        } else {
          await this._planJob(req, freshJob);
          const processingJob = await this.jobModel.updateJobStatus(
            req,
            freshJob.placeId,
            freshJob.id,
            'processing',
            { blockedFrom: ['cancelled'] },
          );
          if (!processingJob) {
            Logger.info('Production job was cancelled during planning', { jobId: freshJob.id });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Production planning failed';
        await this.jobModel.updateJobStatus(req, claimedJob.placeId, claimedJob.id, 'failed', {
          errorMessage: message,
        });
        Logger.error('Production job planning failed', error, {
          placeId: claimedJob.placeId,
          jobId: claimedJob.id,
        });
      }
    }

    const items = await this.jobModel.claimPendingItems(req, WORKER_BATCH_SIZE);
    itemsClaimed = items.length;
    for (const item of items) {
      try {
        await this._processItem(req, item);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Production item failed';
        await this.jobModel.updateJobItem(req, item.id, {
          status: 'failed',
          errorMessage: message,
        });
        Logger.error('Production item failed', error, { itemId: item.id, jobId: item.jobId });
      }
    }

    await this._evaluateProcessingJobs(req);
    return itemsClaimed;
  }

  async _resumeStalledPlanningJobs(req) {
    const jobs = await this.jobModel.listJobsByStatus(req, 'planning');
    for (const job of jobs) {
      const summary = await this.jobModel.summarizeJobItems(req, job.id, job.currentPhaseIndex);
      if (summary.total === 0) {
        await this.jobModel.updateJobStatus(req, job.placeId, job.id, 'failed', {
          errorMessage: 'Production planning produced no targets',
        });
        continue;
      }

      const processingJob = await this.jobModel.updateJobStatus(
        req,
        job.placeId,
        job.id,
        'processing',
        {
          blockedFrom: ['cancelled'],
        },
      );
      if (!processingJob) {
        Logger.info('Skipped resume for cancelled production job', { jobId: job.id });
      }
    }
  }

  async _evaluateProcessingJobs(req) {
    const jobs = await this.jobModel.listJobsByStatus(req, 'processing');
    for (const job of jobs) {
      const phaseIndex = job.currentPhaseIndex;
      const inFlight = await this.jobModel.countInFlightItems(req, job.id, phaseIndex);
      if (inFlight > 0) continue;

      const summary = await this.jobModel.summarizeJobItems(req, job.id, phaseIndex);
      const phases = Array.isArray(job.phases) ? job.phases : DEFAULT_PHASES;
      const reviewPhase = phases[phaseIndex] ?? phases[0] ?? 'text_derivation';

      if (summary.total === 0) {
        await this.jobModel.updateJobStatus(req, job.placeId, job.id, 'failed', {
          errorMessage: 'No production targets',
        });
        continue;
      }

      if (summary.reviewable > 0) {
        if (this._shouldCheckpoint(job)) {
          await this.jobModel.updateJobStatus(req, job.placeId, job.id, 'awaiting_review', {
            reviewPhase,
          });
        } else {
          await this._autoAdvancePhase(req, job);
        }
        continue;
      }

      if (summary.failed > 0) {
        await this.jobModel.updateJobStatus(req, job.placeId, job.id, 'failed', {
          errorMessage: 'All production items failed',
        });
        continue;
      }

      const isLastPhase = phaseIndex >= phases.length - 1;
      if (isLastPhase) {
        await this.jobModel.updateJobStatus(req, job.placeId, job.id, 'completed');
      } else if (this._shouldCheckpoint(job)) {
        await this.jobModel.updateJobStatus(req, job.placeId, job.id, 'awaiting_review', {
          reviewPhase,
        });
      } else {
        await this._autoAdvancePhase(req, job);
      }
    }
  }

  async _autoAdvancePhase(req, job) {
    const items = await this.jobModel.listJobItems(req, job.id);
    const phaseItems = items.filter(
      (item) =>
        item.phaseIndex === job.currentPhaseIndex &&
        item.status === 'completed' &&
        (item.reviewStatus === 'pending_review' || item.reviewStatus == null),
    );
    await this._bulkApprovePhaseItems(req, job.placeId, phaseItems);

    const phases = Array.isArray(job.phases) ? job.phases : DEFAULT_PHASES;
    if (job.currentPhaseIndex >= phases.length - 1) {
      await this.jobModel.updateJobStatus(req, job.placeId, job.id, 'completed');
      return;
    }

    await this.jobModel.requeueJobForNextPhase(req, job.placeId, job.id);
    await this.jobModel.appendEvent(req, job.id, 'phase_approved', {
      phaseIndex: job.currentPhaseIndex,
      continued: true,
      auto: true,
    });
  }

  async _bulkApprovePhaseItems(req, placeId, phaseItems) {
    for (const item of phaseItems) {
      if (item.status !== 'completed' || !item.providerResult) continue;
      if (item.reviewStatus === 'approved' || item.reviewStatus === 'superseded') continue;
      if (item.reviewStatus === 'rejected') continue;
      await this._approveSingleItem(req, placeId, item);
    }
  }

  async _approveSingleItem(req, placeId, item) {
    if (item.status !== 'completed' || !item.providerResult) {
      throw new AppError(
        'Only completed items can be approved',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    if (item.reviewStatus === 'approved') {
      return item;
    }
    if (item.reviewStatus === 'superseded' || item.reviewStatus === 'rejected') {
      throw new AppError('Item cannot be approved', 400, AppError.CODES.VALIDATION_ERROR);
    }

    if (item.step === 'text_derivation' || item.step === 'translation') {
      const text =
        item.step === 'translation'
          ? item.providerResult.translatedText
          : item.providerResult.presentationText;
      if (text && item.variantId) {
        await this.guidesModel.applyProductionPresentationText(
          req,
          placeId,
          item.stopId,
          item.variantId,
          text,
        );
      }
    }

    return this.jobModel.updateJobItem(req, item.id, { reviewStatus: 'approved' });
  }

  _assertPhaseCanAdvance(phaseItems) {
    if (phaseItems.some((item) => item.status === 'failed')) {
      throw new AppError(
        'Cannot approve phase while items have failed',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }

    const inFlight = phaseItems.filter((item) => IN_FLIGHT_ITEM_STATUSES.includes(item.status));
    if (inFlight.length > 0) {
      throw new AppError(
        'Cannot approve phase while items are still processing',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }

    const pendingReview = phaseItems.filter(
      (item) =>
        item.status === 'completed' &&
        (!item.reviewStatus || item.reviewStatus === 'pending_review'),
    );
    if (pendingReview.length > 0) {
      throw new AppError(
        `${pendingReview.length} item(s) still awaiting review before phase can advance`,
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
  }

  async _requireJobAwaitingReview(req, placeId, jobId) {
    const job = await this.jobModel.getJobById(req, placeId, jobId);
    if (job.status !== 'awaiting_review') {
      throw new AppError(
        'Only jobs awaiting review can perform item review actions',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    return job;
  }

  _validateItemInCurrentPhase(item, job) {
    if (item.phaseIndex !== job.currentPhaseIndex) {
      throw new AppError(
        'Item is not in the current review phase',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
  }

  _requireReviewableItem(item) {
    if (item.status !== 'completed') {
      throw new AppError(
        'Only completed items can be reviewed',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    if (item.reviewStatus && item.reviewStatus !== 'pending_review') {
      throw new AppError('Item is not pending review', 400, AppError.CODES.VALIDATION_ERROR);
    }
  }

  _requireRegeneratableItem(item) {
    if (item.status !== 'completed') {
      throw new AppError(
        'Only completed items can be regenerated',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    if (!REGENERATABLE_REVIEW_STATUSES.includes(item.reviewStatus)) {
      throw new AppError('Item cannot be regenerated', 400, AppError.CODES.VALIDATION_ERROR);
    }
  }

  _computeFingerprintForTarget({
    step,
    stop,
    variant,
    place,
    providerKey,
    providerVersion,
    regenerateNonce,
  }) {
    if (step === 'translation') {
      return computeProductionFingerprint({
        step,
        sourcePresentationText: variant.presentationText,
        sourceLanguage: place.sourceLanguage,
        targetLanguage: variant.language,
        variantType: variant.variantType,
        providerKey,
        providerVersion,
        regenerateNonce,
      });
    }

    return computeProductionFingerprint({
      step,
      canonicalNarrative: stop.canonicalNarrative,
      ingestRunId: place.ingestRunId ?? null,
      variantType: variant.variantType,
      language: variant.language,
      providerKey,
      providerVersion,
      regenerateNonce,
    });
  }

  async _planJob(req, job) {
    const options = job.jobOptions ?? {};
    const phases = Array.isArray(job.phases) ? job.phases : DEFAULT_PHASES;
    const step = phases[job.currentPhaseIndex];
    if (!step) {
      throw new AppError('Invalid production phase index', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const force = Boolean(options.force);
    const place = await this.guidesModel.getById(req, job.placeId);
    const targets = await this._resolveTargetsForPhase(req, job.placeId, job, options);

    for (const target of targets) {
      await this._planStepItem(req, job, target, step, force, place);
    }

    await this.jobModel.appendEvent(req, job.id, 'phase_started', {
      phaseIndex: job.currentPhaseIndex,
      step,
    });
  }

  async _planStepItem(req, job, target, step, force, place) {
    const { stop, variant } = target;
    const providerKey = this._providerKeyForStep(step);
    const providerVersion = this._providerVersionForStep(step, providerKey);

    const fingerprint = this._computeFingerprintForTarget({
      step,
      stop,
      variant,
      place,
      providerKey,
      providerVersion,
    });

    if (!force && (await this.jobModel.hasCompletedFingerprint(req, fingerprint))) {
      await this.jobModel.createJobItem(req, job.id, {
        stopId: stop.id,
        variantId: variant.id,
        step,
        phaseIndex: job.currentPhaseIndex,
        status: 'skipped',
        fingerprint,
        providerKey,
        providerVersion,
        errorMessage: 'Skipped duplicate fingerprint',
      });
      return;
    }

    await this.jobModel.createJobItem(req, job.id, {
      stopId: stop.id,
      variantId: variant.id,
      step,
      phaseIndex: job.currentPhaseIndex,
      status: 'pending',
      fingerprint,
      providerKey,
      providerVersion,
    });
  }

  async _processItem(req, item) {
    const job = await this.jobModel.getJobByIdInternal(req, item.jobId);
    if (job.status === 'cancelled') {
      await this.jobModel.updateJobItem(req, item.id, { status: 'cancelled' });
      return;
    }

    const stop = await this.guidesModel.getStopById(req, job.placeId, item.stopId);
    const variant = await this.guidesModel.getVariantById(
      req,
      job.placeId,
      item.stopId,
      item.variantId,
    );

    if (item.step === 'text_derivation') {
      ensureTextProvidersRegistered();
      const provider = TextProviderRegistry.get(item.providerKey || DEFAULT_TEXT_PROVIDER);
      const result = await provider.generate(req, {
        canonicalNarrative: stop.canonicalNarrative,
        variantType: variant.variantType,
        language: variant.language,
      });
      if (result.status === 'retry') {
        await this.jobModel.updateJobItem(req, item.id, {
          status: 'pending',
          retryAfter: new Date(Date.now() + (result.retryAfterMs ?? 30000)).toISOString(),
          errorMessage: result.errorMessage ?? 'Rate limited — retry scheduled',
        });
        return;
      }
      if (result.status !== 'ready') {
        await this.jobModel.updateJobItem(req, item.id, {
          status: 'failed',
          errorMessage: result.errorMessage ?? 'Text derivation failed',
        });
        return;
      }
      const providerResult = result.providerResult ?? {
        presentationText: result.presentationText,
      };
      await this.jobModel.updateJobItem(req, item.id, {
        status: 'completed',
        providerResult,
        reviewStatus: 'pending_review',
      });
      return;
    }

    if (item.step === 'translation') {
      ensureTranslationProvidersRegistered();
      const provider = TranslationProviderRegistry.get(
        item.providerKey || DEFAULT_TRANSLATION_PROVIDER,
      );
      const sourceLanguage = (await this.guidesModel.getById(req, job.placeId)).sourceLanguage;
      const result = await provider.translate(req, {
        presentationText: variant.presentationText ?? '',
        sourceLanguage,
        targetLanguage: variant.language,
      });
      if (result.status !== 'ready') {
        await this.jobModel.updateJobItem(req, item.id, {
          status: 'failed',
          errorMessage: result.errorMessage ?? 'Translation failed',
        });
        return;
      }
      await this.jobModel.updateJobItem(req, item.id, {
        status: 'completed',
        providerResult: { translatedText: result.translatedText },
        reviewStatus: 'pending_review',
      });
      return;
    }

    await this.jobModel.updateJobItem(req, item.id, {
      status: 'skipped',
      errorMessage: 'Audio step not implemented in batch v1',
    });
  }

  _shouldCheckpoint(job) {
    const mode = job.checkpointMode ?? 'after_text';
    if (mode === 'auto') return false;
    if (mode === 'after_each') return true;
    return job.currentPhaseIndex === 0;
  }

  _normalizePhases(phases) {
    const normalized = (phases ?? DEFAULT_PHASES).map((s) => String(s).trim().toLowerCase());
    for (const step of normalized) {
      if (!ITEM_STEPS.includes(step)) {
        throw new AppError(
          `Invalid production step: ${step}`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
    }
    return normalized.length ? normalized : [...DEFAULT_PHASES];
  }

  _normalizeCheckpointMode(mode) {
    if (mode == null || mode === '') return 'after_text';
    const normalized = String(mode).trim().toLowerCase();
    if (!CHECKPOINT_MODES.includes(normalized)) {
      throw new AppError('Invalid checkpoint mode', 400, AppError.CODES.VALIDATION_ERROR);
    }
    return normalized;
  }

  _providerKeyForStep(step) {
    if (step === 'text_derivation') {
      return process.env.GUIDES_TEXT_PROVIDER || DEFAULT_TEXT_PROVIDER;
    }
    if (step === 'translation') return DEFAULT_TRANSLATION_PROVIDER;
    return 'noop';
  }

  _providerVersionForStep(step, providerKey) {
    if (step === 'text_derivation') {
      ensureTextProvidersRegistered();
      return TextProviderRegistry.get(providerKey).version ?? '1';
    }
    if (step === 'translation') {
      ensureTranslationProvidersRegistered();
      return TranslationProviderRegistry.get(providerKey).version ?? '1';
    }
    return '1';
  }

  _normalizeLanguages(languages) {
    if (!Array.isArray(languages) || languages.length === 0) return null;
    const normalized = languages
      .map((language) => String(language).trim().toLowerCase())
      .filter(Boolean);
    return normalized.length ? normalized : null;
  }

  _filterTargetsByLanguages(targets, languages) {
    if (!languages?.length) return targets;
    return targets.filter((target) =>
      languages.includes(String(target.variant.language).toLowerCase()),
    );
  }

  async _resolveTargetsForPhase(req, placeId, job, options) {
    if (job.currentPhaseIndex === 0) {
      const targets = await this._resolveTargets(req, placeId, job, options);
      return this._filterTargetsByLanguages(targets, options.languages);
    }

    const priorPhaseIndex = job.currentPhaseIndex - 1;
    const approvedTargets = await this.jobModel.listApprovedVariantTargetsForPhase(
      req,
      job.id,
      priorPhaseIndex,
    );

    const targets = [];
    for (const { stopId, variantId } of approvedTargets) {
      const stop = await this.guidesModel.getStopById(req, placeId, stopId);
      const variant = await this.guidesModel.getVariantById(req, placeId, stopId, variantId);
      targets.push({ stop, variant });
    }
    return this._filterTargetsByLanguages(targets, options.languages);
  }

  async _resolveTargets(req, placeId, job, options) {
    if (job.type === 'variant' || options.variantId) {
      const variantId = options.variantId ?? job.scopeVariantId;
      const stopId = options.stopId ?? job.scopeStopId;
      if (!variantId || !stopId) {
        throw new AppError(
          'variant jobs require stopId and variantId',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      const variant = await this.guidesModel.getVariantById(req, placeId, stopId, variantId);
      const stop = await this.guidesModel.getStopById(req, placeId, stopId);
      return [{ stop, variant }];
    }

    if (job.type === 'stop' || options.stopId) {
      const stopId = options.stopId ?? job.scopeStopId;
      if (!stopId) {
        throw new AppError('stop jobs require stopId', 400, AppError.CODES.VALIDATION_ERROR);
      }
      const stop = await this.guidesModel.getStopById(req, placeId, stopId);
      const variants = await this.guidesModel.getVariants(req, placeId, stopId);
      return variants.map((variant) => ({ stop, variant }));
    }

    const stops = await this.guidesModel.getStops(req, placeId);
    const targets = [];
    for (const stop of stops) {
      const variants = await this.guidesModel.getVariants(req, placeId, stop.id);
      for (const variant of variants) {
        targets.push({ stop, variant });
      }
    }
    return targets;
  }
}

module.exports = ProductionOrchestrationService;
