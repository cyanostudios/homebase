// plugins/guides/audio/AudioOrchestrationService.js
const { Logger } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');
const {
  ensureStorageProvidersRegistered,
} = require('../../../server/core/storage/registerDefaultAdapters');
const StorageProviderRegistry = require('../../../server/core/storage/StorageProviderRegistry');
const AudioProviderRegistry = require('./AudioProviderRegistry');
const { ensureAudioProvidersRegistered } = require('./registerDefaultProviders');
const { formatStorageRef, parseStorageRef } = require('./storageRef');
const { uploadAudioBuffer } = require('./uploadAudioBuffer');

class AudioOrchestrationService {
  /**
   * @param {import('../model')} model
   */
  constructor(model) {
    this.model = model;
  }

  /**
   * @param {import('express').Request} req
   * @param {string|null|undefined} storageRef
   */
  async deleteStoredBlob(req, storageRef) {
    if (!storageRef) return;
    try {
      const { providerKey, externalFileId } = parseStorageRef(storageRef);
      ensureStorageProvidersRegistered();
      if (!StorageProviderRegistry.has(providerKey)) {
        Logger.warn('Storage provider not registered for audio delete', { providerKey });
        return;
      }
      const provider = StorageProviderRegistry.get(providerKey);
      await provider.delete(req, { externalFileId });
    } catch (error) {
      Logger.warn('Guide audio storage delete failed', { err: error?.message, storageRef });
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} stopId
   * @param {string} variantId
   */
  async generate(req, placeId, stopId, variantId) {
    const variant = await this.model.getVariantById(req, placeId, stopId, variantId);
    const presentationText = String(variant.presentationText ?? '').trim();
    if (!presentationText) {
      throw new AppError(
        'presentationText is required for audio generation',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }

    let audio = await this.model.getAudioIfExists(req, placeId, stopId, variantId);
    if (!audio) {
      audio = await this.model.createAudio(req, placeId, stopId, variantId, {});
    }

    if (audio.status === 'processing') {
      throw new AppError('Audio generation already in progress', 409, AppError.CODES.CONFLICT);
    }

    if (audio.storageRef) {
      await this.deleteStoredBlob(req, audio.storageRef);
    }

    await this.model.setAudioGenerationState(req, placeId, stopId, variantId, {
      status: 'processing',
      storageRef: null,
      durationMs: null,
      mimeType: null,
      errorMessage: null,
    });

    ensureAudioProvidersRegistered();
    const provider = AudioProviderRegistry.get(audio.providerKey);

    try {
      const result = await provider.generate(req, {
        variantPresentationId: variantId,
        presentationText,
        language: variant.language,
        variantType: variant.variantType,
      });

      if (result.status === 'processing') {
        return this.model.setAudioGenerationState(req, placeId, stopId, variantId, {
          status: 'processing',
          errorMessage: null,
        });
      }

      if (result.status === 'failed') {
        return this.model.setAudioGenerationState(req, placeId, stopId, variantId, {
          status: 'failed',
          storageRef: null,
          durationMs: null,
          mimeType: null,
          errorMessage: result.errorMessage ?? 'Audio generation failed',
        });
      }

      const buffer = result.audioBuffer;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new AppError(
          'Audio provider returned no audio data',
          500,
          AppError.CODES.DATABASE_ERROR,
        );
      }

      const mimeType = result.mimeType || 'audio/wav';
      const filename = `guide-audio-${variantId}-${Date.now()}.wav`;
      const uploaded = await uploadAudioBuffer(req, buffer, {
        filename,
        mimeType,
        variantId,
      });
      const storageRef = formatStorageRef(uploaded.providerKey, uploaded.externalFileId);

      return this.model.setAudioGenerationState(req, placeId, stopId, variantId, {
        status: 'ready',
        storageRef,
        durationMs: result.durationMs ?? null,
        mimeType,
        errorMessage: null,
      });
    } catch (error) {
      if (error instanceof AppError) {
        await this.model.setAudioGenerationState(req, placeId, stopId, variantId, {
          status: 'failed',
          storageRef: null,
          durationMs: null,
          mimeType: null,
          errorMessage: error.message || 'Audio generation failed',
        });
        throw error;
      }

      Logger.error('Guide audio generation failed', error, { placeId, stopId, variantId });
      await this.model.setAudioGenerationState(req, placeId, stopId, variantId, {
        status: 'failed',
        storageRef: null,
        durationMs: null,
        mimeType: null,
        errorMessage: 'Audio generation failed',
      });
      throw new AppError('Audio generation failed', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} stopId
   * @param {string} variantId
   */
  async cancel(req, placeId, stopId, variantId) {
    const audio = await this.model.getAudio(req, placeId, stopId, variantId);
    if (audio.status !== 'processing') {
      throw new AppError('Audio is not processing', 409, AppError.CODES.CONFLICT);
    }

    ensureAudioProvidersRegistered();
    const provider = AudioProviderRegistry.get(audio.providerKey);
    await provider.cancel(req, { variantPresentationId: variantId });

    return this.model.setAudioGenerationState(req, placeId, stopId, variantId, {
      status: 'pending',
      errorMessage: null,
    });
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} stopId
   * @param {string} variantId
   */
  async preview(req, placeId, stopId, variantId) {
    const audio = await this.model.getAudio(req, placeId, stopId, variantId);
    if (audio.status === 'processing') {
      throw new AppError('Audio is still processing', 409, AppError.CODES.CONFLICT);
    }
    if (audio.status !== 'ready' || !audio.storageRef) {
      throw new AppError('Audio is not ready for preview', 404, AppError.CODES.NOT_FOUND);
    }

    const { providerKey, externalFileId } = parseStorageRef(audio.storageRef);
    ensureStorageProvidersRegistered();
    if (!StorageProviderRegistry.has(providerKey)) {
      throw new AppError('Storage provider not available', 500, AppError.CODES.DATABASE_ERROR);
    }

    const provider = StorageProviderRegistry.get(providerKey);
    return {
      stream: await provider.download(req, { externalFileId }),
      mimeType: audio.mimeType || 'application/octet-stream',
    };
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} stopId
   * @param {string} variantId
   */
  async deleteWithBlob(req, placeId, stopId, variantId) {
    const audio = await this.model.getAudioIfExists(req, placeId, stopId, variantId);
    if (audio?.storageRef) {
      await this.deleteStoredBlob(req, audio.storageRef);
    }
    return this.model.deleteAudioRecord(req, placeId, stopId, variantId);
  }
}

module.exports = AudioOrchestrationService;
