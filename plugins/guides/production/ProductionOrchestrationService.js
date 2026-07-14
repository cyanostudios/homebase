// plugins/guides/production/ProductionOrchestrationService.js
const { Logger } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');
const { computeProductionFingerprint } = require('./fingerprint');
const { ProductionJobModel, ITEM_STEPS, DEFAULT_PHASES } = require('./ProductionJobModel');
const TextProviderRegistry = require('../providers/text/TextProviderRegistry');
const TranslationProviderRegistry = require('../providers/translation/TranslationProviderRegistry');
const { ensureTextProvidersRegistered } = require('../providers/text/registerDefaultProviders');
const {
  ensureTranslationProvidersRegistered,
} = require('../providers/translation/registerDefaultProviders');

const DEFAULT_TEXT_PROVIDER = 'noop';
const DEFAULT_TRANSLATION_PROVIDER = 'noop';
const WORKER_BATCH_SIZE = Number(process.env.GUIDES_PRODUCTION_WORKER_BATCH_SIZE) || 5;

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
   * @param {{ type: string, stopId?: string, variantId?: string, steps?: string[], force?: boolean }} options
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

    const steps = this._normalizeSteps(options.steps);
    const job = await this.jobModel.createJob(req, placeId, {
      type: options.type,
      scopeStopId: options.stopId ?? null,
      scopeVariantId: options.variantId ?? null,
      phases: steps,
      jobOptions: {
        type: options.type,
        stopId: options.stopId ?? null,
        variantId: options.variantId ?? null,
        steps,
        force: Boolean(options.force),
      },
      queuedAt: new Date().toISOString(),
    });

    const items = await this.jobModel.listJobItems(req, job.id);
    return { job, items };
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} jobId
   */
  async approveJob(req, placeId, jobId) {
    const job = await this.jobModel.getJobById(req, placeId, jobId);
    if (job.status !== 'awaiting_review') {
      throw new AppError(
        'Only jobs awaiting review can be approved',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }

    const items = await this.jobModel.listJobItems(req, jobId);
    for (const item of items) {
      if (item.status !== 'completed' || !item.providerResult) continue;
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
    }

    const updated = await this.jobModel.updateJobStatus(req, placeId, jobId, 'completed');
    const refreshedItems = await this.jobModel.listJobItems(req, jobId);
    return { job: updated, items: refreshedItems };
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
    const claimedJob = await this.jobModel.claimPendingJob(req);
    if (claimedJob) {
      try {
        await this._planJob(req, claimedJob);
        await this.jobModel.updateJobStatus(req, claimedJob.placeId, claimedJob.id, 'processing');
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

  async _evaluateProcessingJobs(req) {
    const jobs = await this.jobModel.listJobsByStatus(req, 'processing');
    for (const job of jobs) {
      const inFlight = await this.jobModel.countInFlightItems(req, job.id);
      if (inFlight > 0) continue;

      const summary = await this.jobModel.summarizeJobItems(req, job.id);
      const phases = Array.isArray(job.phases) ? job.phases : DEFAULT_PHASES;
      const reviewPhase = phases[job.currentPhaseIndex] ?? phases[0] ?? 'text_derivation';

      if (summary.total === 0) {
        await this.jobModel.updateJobStatus(req, job.placeId, job.id, 'failed', {
          errorMessage: 'No production targets',
        });
        continue;
      }

      if (summary.reviewable > 0) {
        await this.jobModel.updateJobStatus(req, job.placeId, job.id, 'awaiting_review', {
          reviewPhase,
        });
        continue;
      }

      if (summary.failed > 0) {
        await this.jobModel.updateJobStatus(req, job.placeId, job.id, 'failed', {
          errorMessage: 'All production items failed',
        });
        continue;
      }

      await this.jobModel.updateJobStatus(req, job.placeId, job.id, 'completed');
    }
  }

  async _planJob(req, job) {
    const options = job.jobOptions ?? {};
    const steps = this._normalizeSteps(options.steps ?? job.phases);
    const force = Boolean(options.force);
    const targets = await this._resolveTargets(req, job.placeId, job, options);

    for (const target of targets) {
      for (const step of steps) {
        await this._planStepItem(req, job, target, step, force);
      }
    }

    await this.jobModel.appendEvent(req, job.id, 'phase_started', {
      phaseIndex: job.currentPhaseIndex,
      steps,
    });
  }

  async _planStepItem(req, job, target, step, force) {
    const { stop, variant } = target;
    const providerKey = this._providerKeyForStep(step);
    const providerVersion = this._providerVersionForStep(step, providerKey);

    const fingerprint = computeProductionFingerprint({
      canonicalNarrative: stop.canonicalNarrative,
      presentationText: variant.presentationText,
      variantType: variant.variantType,
      language: variant.language,
      step,
      providerKey,
      providerVersion,
    });

    if (!force && (await this.jobModel.hasCompletedFingerprint(req, job.placeId, fingerprint))) {
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
      if (result.status !== 'ready') {
        await this.jobModel.updateJobItem(req, item.id, {
          status: 'failed',
          errorMessage: result.errorMessage ?? 'Text derivation failed',
        });
        return;
      }
      await this.jobModel.updateJobItem(req, item.id, {
        status: 'completed',
        providerResult: { presentationText: result.presentationText },
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

  _normalizeSteps(steps) {
    const normalized = (steps ?? DEFAULT_PHASES).map((s) => String(s).trim().toLowerCase());
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

  _providerKeyForStep(step) {
    if (step === 'text_derivation') return DEFAULT_TEXT_PROVIDER;
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
