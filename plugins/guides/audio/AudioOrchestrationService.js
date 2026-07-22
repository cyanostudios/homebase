const { Logger } = require('@homebase/core');
const { AppError } = require('../../../server/core/errors/AppError');
const {
  ensureStorageProvidersRegistered,
} = require('../../../server/core/storage/registerDefaultAdapters');
const StorageProviderRegistry = require('../../../server/core/storage/StorageProviderRegistry');
const AudioProviderConfigResolver = require('./AudioProviderConfigResolver');
const { formatStorageRef, parseStorageRef } = require('./storageRef');
const { uploadAudioBuffer } = require('./uploadAudioBuffer');

function roundCost(value) {
  return Math.round(Number(value || 0) * 1e8) / 1e8;
}

/**
 * Accumulate TTS spend across regenerations on the same presentation audio row.
 * @param {object|null|undefined} previous
 * @param {object|null|undefined} generationCost
 */
function mergeCumulativeAudioCost(previous, generationCost) {
  if (!generationCost || generationCost.totalCost == null) {
    return previous ?? null;
  }
  const previousTotal = Number(previous?.totalCost) || 0;
  const generationTotal = Number(generationCost.totalCost) || 0;
  return {
    ...generationCost,
    lastGenerationCost: roundCost(generationTotal),
    totalCost: roundCost(previousTotal + generationTotal),
    estimated: generationCost.estimated !== false,
  };
}

/**
 * Snapshot of playable audio before a regenerate attempt.
 * Used to restore the previous file if TTS/upload fails.
 * @param {object|null|undefined} audio
 */
function snapshotPreviousAudio(audio) {
  if (!audio) return null;
  return {
    status: audio.status,
    storageRef: audio.storageRef ?? null,
    durationMs: audio.durationMs ?? null,
    mimeType: audio.mimeType ?? null,
    providerKey: audio.providerKey ?? null,
  };
}

function hasRestorableBlob(snapshot) {
  return Boolean(snapshot?.storageRef);
}

function restoredStatus(snapshot) {
  if (!snapshot) return 'failed';
  if (snapshot.status === 'stale') return 'stale';
  if (snapshot.status === 'ready' || snapshot.status === 'processing') return 'ready';
  // Keep playable statuses; otherwise prefer ready when a blob exists.
  if (hasRestorableBlob(snapshot)) return 'ready';
  return 'failed';
}

/** In-flight marker so cancel can restore stale vs ready after status was set to processing. */
const RESTORE_STATUS_PREFIX = '__hb_restore__:';

function encodeRestoreStatusHint(previous) {
  if (!hasRestorableBlob(previous)) return null;
  const status = previous.status === 'stale' ? 'stale' : 'ready';
  return `${RESTORE_STATUS_PREFIX}${status}`;
}

function decodeRestoreStatusHint(errorMessage) {
  const raw = String(errorMessage ?? '');
  if (!raw.startsWith(RESTORE_STATUS_PREFIX)) return null;
  const status = raw.slice(RESTORE_STATUS_PREFIX.length);
  return status === 'stale' || status === 'ready' ? status : null;
}

/**
 * Build a restore snapshot from the in-flight processing row (persisted hint + blob fields).
 * @param {object} audio
 */
function snapshotFromProcessingRow(audio) {
  if (!audio?.storageRef) return null;
  const hinted = decodeRestoreStatusHint(audio.errorMessage);
  return {
    status: hinted || 'ready',
    storageRef: audio.storageRef,
    durationMs: audio.durationMs ?? null,
    mimeType: audio.mimeType ?? null,
    providerKey: audio.providerKey ?? null,
  };
}

class AudioOrchestrationService {
  /**
   * @param {import('../model')} model
   * @param {{ audioProviderConfigResolver?: AudioProviderConfigResolver }} [options]
   */
  constructor(model, options = {}) {
    this.model = model;
    this.audioProviderConfigResolver =
      options.audioProviderConfigResolver ?? new AudioProviderConfigResolver();
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
   * Restore previous playable audio after a failed regenerate, or mark failed when none exists.
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} language
   * @param {string} providerKey
   * @param {ReturnType<typeof snapshotPreviousAudio>} previous
   * @param {string|null|undefined} errorMessage
   */
  async restorePreviousOrFail(req, placeId, language, providerKey, previous, errorMessage) {
    if (hasRestorableBlob(previous)) {
      return this.model.setAudioGenerationState(req, placeId, language, {
        status: restoredStatus(previous),
        providerKey: previous.providerKey || providerKey,
        storageRef: previous.storageRef,
        durationMs: previous.durationMs,
        mimeType: previous.mimeType,
        errorMessage: null,
      });
    }

    return this.model.setAudioGenerationState(req, placeId, language, {
      status: 'failed',
      providerKey,
      storageRef: null,
      durationMs: null,
      mimeType: null,
      errorMessage: errorMessage || 'Audio generation failed',
    });
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} language
   */
  async generate(req, placeId, language) {
    const presentation = await this.model.getPresentationByLanguage(req, placeId, language);
    const presentationText = String(presentation.presentationText ?? '').trim();
    if (!presentationText) {
      throw new AppError(
        'presentationText is required for audio generation',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    if (presentation.approvalStatus !== 'approved') {
      throw new AppError(
        'presentation must be approved before audio generation',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }

    const providerKey = await this.audioProviderConfigResolver.getPreferredProviderKey(req);

    let audio = await this.model.getAudioIfExists(req, placeId, language);
    if (!audio) {
      audio = await this.model.createAudio(req, placeId, language, { providerKey });
    }

    if (audio.status === 'processing') {
      throw new AppError('Audio generation already in progress', 409, AppError.CODES.CONFLICT);
    }

    const previous = snapshotPreviousAudio(audio);

    // Mark processing but keep the previous blob until the new upload succeeds.
    // Persist restore hint in error_message so cancel can restore stale vs ready.
    await this.model.setAudioGenerationState(req, placeId, language, {
      status: 'processing',
      providerKey,
      storageRef: previous?.storageRef ?? null,
      durationMs: previous?.durationMs ?? null,
      mimeType: previous?.mimeType ?? null,
      errorMessage: encodeRestoreStatusHint(previous),
    });

    const provider = await this.audioProviderConfigResolver.createProvider(req, providerKey);

    try {
      const result = await provider.generate(req, {
        presentationId: presentation.id,
        presentationText,
        language: presentation.language,
      });

      if (result.status === 'processing') {
        return this.model.setAudioGenerationState(req, placeId, language, {
          status: 'processing',
          providerKey,
          storageRef: previous?.storageRef ?? null,
          durationMs: previous?.durationMs ?? null,
          mimeType: previous?.mimeType ?? null,
          errorMessage: encodeRestoreStatusHint(previous),
        });
      }

      if (result.status === 'failed') {
        const message = result.errorMessage || 'Audio generation failed';
        await this.restorePreviousOrFail(req, placeId, language, providerKey, previous, message);
        throw new AppError(message, 502, AppError.CODES.SERVICE_UNAVAILABLE);
      }

      const buffer = result.audioBuffer;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        const message = 'Audio provider returned no audio data';
        await this.restorePreviousOrFail(req, placeId, language, providerKey, previous, message);
        throw new AppError(message, 502, AppError.CODES.SERVICE_UNAVAILABLE);
      }

      const mimeType = result.mimeType || 'audio/wav';
      const extension = mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : 'wav';
      const filename = `${presentation.id}-${Date.now()}.${extension}`;
      const uploaded = await uploadAudioBuffer(req, buffer, {
        filename,
        mimeType,
        presentationId: presentation.id,
      });
      const storageRef = formatStorageRef(uploaded.providerKey, uploaded.externalFileId);
      const existingAudio = await this.model.getAudioIfExists(req, placeId, language);
      const cost = mergeCumulativeAudioCost(existingAudio?.cost, result.cost);

      const ready = await this.model.setAudioGenerationState(req, placeId, language, {
        status: 'ready',
        providerKey,
        storageRef,
        durationMs: result.durationMs ?? null,
        mimeType,
        errorMessage: null,
        cost,
      });

      // Only delete the previous blob after the new one is committed.
      if (previous?.storageRef && previous.storageRef !== storageRef) {
        await this.deleteStoredBlob(req, previous.storageRef);
      }

      return ready;
    } catch (error) {
      if (error instanceof AppError) {
        // Provider-failure path already restored; other AppErrors may need restore.
        if (error.code !== AppError.CODES.SERVICE_UNAVAILABLE) {
          await this.restorePreviousOrFail(
            req,
            placeId,
            language,
            providerKey,
            previous,
            error.message,
          );
        }
        throw error;
      }

      Logger.error('Guide audio generation failed', error, { placeId, language });
      await this.restorePreviousOrFail(
        req,
        placeId,
        language,
        providerKey,
        previous,
        'Audio generation failed',
      );
      throw new AppError('Audio generation failed', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} language
   */
  async cancel(req, placeId, language) {
    // preserveRestoreHint: transformAudioRow strips __hb_restore__: for API clients;
    // cancel needs the raw hint to restore stale vs ready.
    const audio = await this.model.getAudio(req, placeId, language, {
      preserveRestoreHint: true,
    });
    if (audio.status !== 'processing') {
      throw new AppError('Audio is not processing', 409, AppError.CODES.CONFLICT);
    }

    const provider = await this.audioProviderConfigResolver.createProvider(req, audio.providerKey);
    await provider.cancel(req, { presentationId: audio.presentationId });

    const previous = snapshotFromProcessingRow(audio);
    if (hasRestorableBlob(previous)) {
      return this.restorePreviousOrFail(req, placeId, language, audio.providerKey, previous, null);
    }

    return this.model.setAudioGenerationState(req, placeId, language, {
      status: 'pending',
      errorMessage: null,
    });
  }

  /**
   * @param {import('express').Request} req
   * @param {string} placeId
   * @param {string} language
   */
  async preview(req, placeId, language) {
    const audio = await this.model.getAudio(req, placeId, language);
    if (audio.status === 'processing') {
      // Allow preview of the previous file while a regenerate is in progress.
      if (!audio.storageRef) {
        throw new AppError('Audio is still processing', 409, AppError.CODES.CONFLICT);
      }
    } else {
      const playable = audio.status === 'ready' || audio.status === 'stale';
      if (!playable || !audio.storageRef) {
        throw new AppError('Audio is not ready for preview', 404, AppError.CODES.NOT_FOUND);
      }
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
   * @param {string} language
   */
  async deleteWithBlob(req, placeId, language) {
    const audio = await this.model.getAudioIfExists(req, placeId, language);
    if (!audio) {
      throw new AppError('Audio not found', 404, AppError.CODES.NOT_FOUND);
    }
    if (audio.storageRef) {
      await this.deleteStoredBlob(req, audio.storageRef);
    }
    return this.model.deleteAudioRecord(req, placeId, language);
  }
}

module.exports = AudioOrchestrationService;
