// plugins/guides/production/ProductionOrchestrationService.js
const { Logger } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');
const { computeProductionFingerprint } = require('./fingerprint');
const { ProductionJobModel, ITEM_STEPS } = require('./ProductionJobModel');
const TextProviderRegistry = require('../providers/text/TextProviderRegistry');
const TranslationProviderRegistry = require('../providers/translation/TranslationProviderRegistry');
const { ensureTextProvidersRegistered } = require('../providers/text/registerDefaultProviders');
const {
  ensureTranslationProvidersRegistered,
} = require('../providers/translation/registerDefaultProviders');

const DEFAULT_STEPS = ['text_derivation'];
const DEFAULT_TEXT_PROVIDER = 'noop';
const DEFAULT_TRANSLATION_PROVIDER = 'noop';

class ProductionOrchestrationService {
  /**
   * @param {import('../model')} guidesModel
   */
  constructor(guidesModel) {
    this.guidesModel = guidesModel;
    this.jobModel = new ProductionJobModel();
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {{ type: string, stopId?: string, variantId?: string, steps?: string[], force?: boolean }} options
   */
  async startJob(req, placeId, options) {
    await this.guidesModel.getById(req, placeId);

    const job = await this.jobModel.createJob(req, placeId, {
      type: options.type,
      scopeStopId: options.stopId ?? null,
      scopeVariantId: options.variantId ?? null,
    });

    try {
      await this.jobModel.updateJobStatus(req, placeId, job.id, 'processing');
      await this._runJob(req, placeId, job, options);
      const updated = await this.jobModel.updateJobStatus(req, placeId, job.id, 'awaiting_review');
      const items = await this.jobModel.listJobItems(req, job.id);
      return { job: updated, items };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Production job failed';
      await this.jobModel.updateJobStatus(req, placeId, job.id, 'failed', {
        errorMessage: message,
      });
      if (error instanceof AppError) throw error;
      Logger.error('Production job failed', error, { placeId, jobId: job.id });
      throw new AppError('Production job failed', 500, AppError.CODES.DATABASE_ERROR);
    }
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
    if (!['pending', 'processing', 'awaiting_review'].includes(job.status)) {
      throw new AppError('Job cannot be cancelled', 400, AppError.CODES.VALIDATION_ERROR);
    }
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
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {{ id: string, type: string, scopeStopId?: string|null, scopeVariantId?: string|null }} job
   * @param {{ type: string, stopId?: string, variantId?: string, steps?: string[], force?: boolean }} options
   */
  async _runJob(req, placeId, job, options) {
    const steps = (options.steps ?? DEFAULT_STEPS).map((s) => String(s).trim().toLowerCase());
    for (const step of steps) {
      if (!ITEM_STEPS.includes(step)) {
        throw new AppError(
          `Invalid production step: ${step}`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
    }

    const targets = await this._resolveTargets(req, placeId, job, options);
    for (const target of targets) {
      for (const step of steps) {
        await this._runStep(req, placeId, job.id, target, step, Boolean(options.force));
      }
    }
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

  async _runStep(req, placeId, jobId, target, step, force) {
    const { stop, variant } = target;
    const providerKey =
      step === 'text_derivation'
        ? DEFAULT_TEXT_PROVIDER
        : step === 'translation'
          ? DEFAULT_TRANSLATION_PROVIDER
          : 'noop';

    const fingerprint = computeProductionFingerprint({
      canonicalNarrative: stop.canonicalNarrative,
      presentationText: variant.presentationText,
      variantType: variant.variantType,
      language: variant.language,
      step,
      providerKey,
      providerVersion: '1',
    });

    if (!force && (await this.jobModel.hasCompletedFingerprint(req, placeId, fingerprint))) {
      await this.jobModel.createJobItem(req, jobId, {
        stopId: stop.id,
        variantId: variant.id,
        step,
        status: 'skipped',
        fingerprint,
        providerKey,
        providerResult: null,
        errorMessage: 'Skipped duplicate fingerprint',
      });
      return;
    }

    if (step === 'text_derivation') {
      ensureTextProvidersRegistered();
      const provider = TextProviderRegistry.get(providerKey);
      const result = await provider.generate(req, {
        canonicalNarrative: stop.canonicalNarrative,
        variantType: variant.variantType,
        language: variant.language,
      });
      if (result.status !== 'ready') {
        await this.jobModel.createJobItem(req, jobId, {
          stopId: stop.id,
          variantId: variant.id,
          step,
          status: 'failed',
          fingerprint,
          providerKey,
          providerResult: null,
          errorMessage: result.errorMessage ?? 'Text derivation failed',
        });
        return;
      }
      await this.jobModel.createJobItem(req, jobId, {
        stopId: stop.id,
        variantId: variant.id,
        step,
        status: 'completed',
        fingerprint,
        providerKey,
        providerResult: { presentationText: result.presentationText },
      });
      return;
    }

    if (step === 'translation') {
      ensureTranslationProvidersRegistered();
      const provider = TranslationProviderRegistry.get(providerKey);
      const sourceLanguage = (await this.guidesModel.getById(req, placeId)).sourceLanguage;
      const result = await provider.translate(req, {
        presentationText: variant.presentationText ?? '',
        sourceLanguage,
        targetLanguage: variant.language,
      });
      if (result.status !== 'ready') {
        await this.jobModel.createJobItem(req, jobId, {
          stopId: stop.id,
          variantId: variant.id,
          step,
          status: 'failed',
          fingerprint,
          providerKey,
          providerResult: null,
          errorMessage: result.errorMessage ?? 'Translation failed',
        });
        return;
      }
      await this.jobModel.createJobItem(req, jobId, {
        stopId: stop.id,
        variantId: variant.id,
        step,
        status: 'completed',
        fingerprint,
        providerKey,
        providerResult: { translatedText: result.translatedText },
      });
      return;
    }

    await this.jobModel.createJobItem(req, jobId, {
      stopId: stop.id,
      variantId: variant.id,
      step,
      status: 'skipped',
      fingerprint,
      providerKey,
      providerResult: null,
      errorMessage: 'Audio step not implemented in batch v1',
    });
  }
}

module.exports = ProductionOrchestrationService;
