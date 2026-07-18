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
const TranslationProviderRegistry = require('../providers/translation/TranslationProviderRegistry');
const {
  ensureTranslationProvidersRegistered,
} = require('../providers/translation/registerDefaultProviders');
const TextProviderConfigResolver = require('../providers/text/TextProviderConfigResolver');
const { listGeneratableTextProviderKeys } = require('../providers/text/registerDefaultProviders');
const { AIProviderRouter } = require('../../ai-providers/AIProviderRouter');
const SourcePackService = require('../sources/SourcePackService');

const DEFAULT_TEXT_PROVIDER = 'noop';
const DEFAULT_TRANSLATION_PROVIDER = 'noop';
const GUIDES_PLUGIN_KEY = 'guides';
const WORKER_BATCH_SIZE = Number(process.env.GUIDES_PRODUCTION_WORKER_BATCH_SIZE) || 5;
const IN_FLIGHT_ITEM_STATUSES = ['pending', 'queued', 'processing', 'awaiting_callback'];
const REGENERATABLE_REVIEW_STATUSES = ['pending_review', 'rejected'];
const VARIANT_PLAN_ORDER = { deep: 0, normal: 1, quick: 2 };
const DEEP_WAIT_RETRY_MS = 3_000;
const ALLOW_NOOP_TEXT =
  String(process.env.GUIDES_ALLOW_NOOP_TEXT || '')
    .trim()
    .toLowerCase() === '1' ||
  String(process.env.GUIDES_ALLOW_NOOP_TEXT || '')
    .trim()
    .toLowerCase() === 'true';

class ProductionOrchestrationService {
  /**
   * @param {import('../model')} guidesModel
   */
  constructor(guidesModel, options = {}) {
    this.guidesModel = guidesModel;
    this.jobModel = new ProductionJobModel();
    this.textProviderConfigResolver = new TextProviderConfigResolver();
    this.aiProviderRouter = new AIProviderRouter();
    this.sourcePackService = options.sourcePackService ?? new SourcePackService();
  }

  /**
   * Enqueue a production job; worker processes asynchronously.
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {{ type: string, stopId?: string, variantId?: string, phases?: string[], steps?: string[], checkpointMode?: string, force?: boolean, languages?: string[] }} options
   */
  async startJob(req, placeId, options) {
    await this.guidesModel.getById(req, placeId);

    const readiness = await this.aiProviderRouter.checkReadiness(req, {
      pluginKey: GUIDES_PLUGIN_KEY,
      generatableProviderKeys: listGeneratableTextProviderKeys(),
    });
    if (!readiness.ready) {
      const code = readiness.failure?.code || 'provider_not_configured';
      throw new AppError('AI provider is not ready for generation', 422, code);
    }

    if (
      !ALLOW_NOOP_TEXT &&
      String(readiness.providerKey || '')
        .trim()
        .toLowerCase() === 'noop'
    ) {
      throw new AppError('AI provider is not ready for generation', 422, 'provider_not_configured');
    }

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
    return { job, items, usageSummary: null };
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
    const providerKey = item.providerKey || (await this._providerKeyForStep(req, item.step));
    const providerVersion =
      item.providerVersion || (await this._providerVersionForStep(req, item.step, providerKey));
    const fingerprint = this._computeFingerprintForTarget({
      step: item.step,
      stop,
      variant,
      place,
      providerKey,
      providerVersion,
      regenerateNonce: item.id,
      sourcePackFingerprint: job.jobOptions?.sourcePack?.combinedText
        ? String(job.jobOptions.sourcePack.combinedText).slice(0, 500)
        : null,
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
    return { job, items, usageSummary: this._buildUsageSummary(items, job) };
  }

  async listJobs(req, placeId) {
    const jobs = await this.jobModel.listJobs(req, placeId);
    return jobs;
  }

  /**
   * Derived usage summary for completed text_derivation items on a job (latest job scope).
   * @param {Array<object>} items
   * @param {object|null} [job]
   */
  _buildUsageSummary(items, job = null) {
    const completed = (items || []).filter(
      (item) =>
        item.status === 'completed' &&
        item.step === 'text_derivation' &&
        item.providerResult?.usage,
    );

    const sources = this._summarizeSourcePack(job?.jobOptions?.sourcePack);

    if (!completed.length && !sources) return null;

    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let latencyMs = 0;
    let totalCost = 0;
    let currency = null;
    let provider = null;
    let model = null;
    let estimated = true;

    for (const item of completed) {
      const usage = item.providerResult.usage;
      const cost = item.providerResult.cost;
      inputTokens += Number(usage.inputTokens ?? usage.promptTokens ?? 0) || 0;
      outputTokens += Number(usage.outputTokens ?? usage.completionTokens ?? 0) || 0;
      totalTokens += Number(usage.totalTokens ?? 0) || 0;
      latencyMs += Number(usage.latencyMs ?? item.providerResult.latencyMs ?? 0) || 0;
      if (!provider && usage.provider) provider = usage.provider;
      if (!model && usage.model) model = usage.model;
      if (cost) {
        totalCost += Number(cost.totalCost ?? 0) || 0;
        currency = cost.currency || currency;
        estimated = cost.estimated !== false;
      }
    }

    return {
      provider: provider || completed[0]?.providerKey || null,
      model: model || null,
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs,
      estimatedCost:
        currency != null
          ? { currency, totalCost: Math.round(totalCost * 1e8) / 1e8, estimated }
          : null,
      sources,
    };
  }

  /**
   * @param {object|null|undefined} pack
   */
  _summarizeSourcePack(pack) {
    if (!pack || typeof pack !== 'object') return null;
    const sources = Array.isArray(pack.sources) ? pack.sources : [];
    if (!sources.length && !Array.isArray(pack.excerpts)) return null;
    return {
      fetchedAt: pack.fetchedAt ?? null,
      placeDisplayName: pack.placeDisplayName ?? null,
      sources: sources.map((s) => ({
        sourceKey: s.sourceKey,
        status: s.status,
        excerptCount: Array.isArray(s.excerpts) ? s.excerpts.length : 0,
        errorMessage: s.errorMessage ?? null,
        attribution: s.attribution ?? null,
      })),
      excerptCount: Array.isArray(pack.excerpts) ? pack.excerpts.length : 0,
    };
  }

  /**
   * Build placeContext subset for text prompts from a guide place snapshot.
   * @param {object} placeGuide
   */
  _buildPlaceContext(placeGuide) {
    const place = placeGuide?.place;
    if (!place) {
      if (placeGuide?.displayName || placeGuide?.geographicReference) {
        return {
          displayName: placeGuide.displayName || placeGuide.geographicReference || null,
          formattedAddress: null,
          countryCode: null,
          adminArea: null,
          locality: null,
          coordinates: null,
          placeTypes: [],
        };
      }
      return null;
    }
    return {
      displayName: place.displayName || placeGuide.displayName || null,
      formattedAddress: place.formattedAddress || null,
      countryCode: place.countryCode || null,
      adminArea: place.adminArea || null,
      locality: place.locality || null,
      coordinates: place.coordinates || null,
      placeTypes: Array.isArray(place.placeTypes) ? place.placeTypes : [],
    };
  }

  /**
   * @param {object} placeGuide
   * @returns {import('../sources/ContentSource').PlaceQuery}
   */
  _buildPlaceQuery(placeGuide) {
    const ctx = this._buildPlaceContext(placeGuide) || {};
    return {
      ...ctx,
      language: placeGuide?.sourceLanguage || 'en',
    };
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
    sourcePackFingerprint,
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
      sourcePackFingerprint: sourcePackFingerprint ?? null,
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

    if (step === 'text_derivation' && !options.sourcePack) {
      const pack = await this.sourcePackService.buildPack(this._buildPlaceQuery(place));
      await this.jobModel.mergeJobOptions(req, job.id, { sourcePack: pack });
      job.jobOptions = { ...options, sourcePack: pack };
      await this.jobModel.appendEvent(req, job.id, 'source_research_completed', {
        excerptCount: pack.excerpts?.length ?? 0,
        sources: (pack.sources || []).map((s) => ({
          sourceKey: s.sourceKey,
          status: s.status,
          excerptCount: Array.isArray(s.excerpts) ? s.excerpts.length : 0,
        })),
      });
    }

    const targets = await this._resolveTargetsForPhase(req, job.placeId, job, options);
    const orderedTargets = [...targets].sort((a, b) => {
      const ao = VARIANT_PLAN_ORDER[a.variant?.variantType] ?? 9;
      const bo = VARIANT_PLAN_ORDER[b.variant?.variantType] ?? 9;
      return ao - bo;
    });

    for (const target of orderedTargets) {
      await this._planStepItem(req, job, target, step, force, place);
    }

    await this.jobModel.appendEvent(req, job.id, 'phase_started', {
      phaseIndex: job.currentPhaseIndex,
      step,
    });
  }

  async _planStepItem(req, job, target, step, force, place) {
    const { stop, variant } = target;
    const providerKey = await this._providerKeyForStep(req, step);
    if (
      step === 'text_derivation' &&
      !ALLOW_NOOP_TEXT &&
      String(providerKey).toLowerCase() === 'noop'
    ) {
      throw new AppError(
        'No generatable text provider is configured',
        422,
        'provider_not_configured',
      );
    }
    const providerVersion = await this._providerVersionForStep(req, step, providerKey);
    const sourcePackFingerprint = job.jobOptions?.sourcePack?.combinedText
      ? String(job.jobOptions.sourcePack.combinedText).slice(0, 500)
      : null;

    const fingerprint = this._computeFingerprintForTarget({
      step,
      stop,
      variant,
      place,
      providerKey,
      providerVersion,
      sourcePackFingerprint,
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
      if (
        !ALLOW_NOOP_TEXT &&
        String(item.providerKey || DEFAULT_TEXT_PROVIDER).toLowerCase() === 'noop'
      ) {
        await this.jobModel.updateJobItem(req, item.id, {
          status: 'failed',
          errorMessage: 'Noop text provider is not allowed for production',
          failureCode: 'provider_not_configured',
        });
        return;
      }

      const placeGuide = await this.guidesModel.getById(req, job.placeId);
      const sourcePack = job.jobOptions?.sourcePack ?? null;
      const sourcePackText = sourcePack?.combinedText ? String(sourcePack.combinedText).trim() : '';

      let sourceDeepText = null;
      if (variant.variantType !== 'deep') {
        const deepWait = await this._resolveDeepDependency(req, job, item);
        if (deepWait.action === 'wait') {
          await this.jobModel.updateJobItem(req, item.id, {
            status: 'pending',
            retryAfter: new Date(Date.now() + DEEP_WAIT_RETRY_MS).toISOString(),
            errorMessage: 'Waiting for deep variant',
          });
          return;
        }
        if (deepWait.action === 'fail') {
          await this.jobModel.updateJobItem(req, item.id, {
            status: 'failed',
            errorMessage: deepWait.errorMessage || 'Deep variant failed',
            failureCode: 'content_input_invalid',
          });
          return;
        }
        sourceDeepText = deepWait.sourceDeepText || null;
      }

      const narrative = String(stop.canonicalNarrative ?? '').trim();
      if (!narrative && !sourcePackText && !sourceDeepText) {
        await this.jobModel.updateJobItem(req, item.id, {
          status: 'failed',
          errorMessage: 'No research excerpts and no canonical narrative — cannot generate text',
          failureCode: 'content_input_invalid',
        });
        return;
      }

      const provider = await this.textProviderConfigResolver.createProvider(
        req,
        item.providerKey || DEFAULT_TEXT_PROVIDER,
      );
      const result = await provider.generate(req, {
        canonicalNarrative: narrative || null,
        variantType: variant.variantType,
        language: variant.language,
        placeContext: this._buildPlaceContext(placeGuide),
        sourcePackText: sourcePackText || null,
        sourceDeepText: sourceDeepText || null,
      });
      if (result.status === 'retry') {
        await this.jobModel.updateJobItem(req, item.id, {
          status: 'pending',
          retryAfter: new Date(Date.now() + (result.retryAfterMs ?? 30000)).toISOString(),
          errorMessage: result.errorMessage ?? 'Rate limited — retry scheduled',
          failureCode: result.failureCode ?? 'provider_rate_limited',
        });
        return;
      }
      if (result.status !== 'ready') {
        await this.jobModel.updateJobItem(req, item.id, {
          status: 'failed',
          errorMessage: result.errorMessage ?? 'Text derivation failed',
          failureCode: result.failureCode ?? 'provider_unknown_error',
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

  /**
   * Wait for / use completed deep sibling when summarizing normal/quick.
   * @returns {Promise<{ action: 'proceed'|'wait'|'fail', sourceDeepText?: string|null, errorMessage?: string }>}
   */
  async _resolveDeepDependency(req, job, item) {
    const siblings = await this.jobModel.listJobItems(req, job.id);
    let deepItem = null;
    for (const sibling of siblings) {
      if (sibling.id === item.id) continue;
      if (sibling.stopId !== item.stopId) continue;
      if (sibling.step !== 'text_derivation') continue;
      if (sibling.phaseIndex !== item.phaseIndex) continue;
      const siblingVariant = await this.guidesModel.getVariantById(
        req,
        job.placeId,
        sibling.stopId,
        sibling.variantId,
      );
      if (siblingVariant?.variantType === 'deep') {
        deepItem = sibling;
        break;
      }
    }

    if (!deepItem) {
      return { action: 'proceed', sourceDeepText: null };
    }

    if (deepItem.status === 'failed' || deepItem.status === 'cancelled') {
      return {
        action: 'fail',
        errorMessage: deepItem.errorMessage || 'Deep variant failed',
      };
    }

    if (deepItem.status === 'completed') {
      const text = deepItem.providerResult?.presentationText;
      if (!text) {
        return { action: 'fail', errorMessage: 'Deep variant produced no text' };
      }
      return { action: 'proceed', sourceDeepText: String(text) };
    }

    if (deepItem.status === 'skipped') {
      return { action: 'proceed', sourceDeepText: null };
    }

    return { action: 'wait' };
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

  async _providerKeyForStep(req, step) {
    if (step === 'text_derivation') {
      return this.textProviderConfigResolver.getPreferredProviderKey(req);
    }
    if (step === 'translation') return DEFAULT_TRANSLATION_PROVIDER;
    return 'noop';
  }

  async _providerVersionForStep(req, step, providerKey) {
    if (step === 'text_derivation') {
      return this.textProviderConfigResolver.getProviderVersion(req, providerKey);
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
