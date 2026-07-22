// plugins/guides/validation.js
// Shared validation for routes (express-validator) and model (business logic).

const { body } = require('express-validator');
const { AppError } = require('../../server/core/errors/AppError');

const PLACE_LIFECYCLE_STATUSES = ['draft', 'active', 'archived'];
const MASTER_GUIDE_EDITORIAL_STATUSES = ['draft', 'in-progress', 'complete'];
const PUBLICATION_STATUSES = ['draft', 'ready', 'published'];
const STALENESS_STATUSES = ['fresh', 'stale'];
const APPROVAL_STATUSES = ['draft', 'pending_review', 'approved'];
const AUDIO_STATUSES = ['pending', 'processing', 'ready', 'failed', 'stale'];
const DEFAULT_SOURCE_LANGUAGE = 'en';
const DEFAULT_LIFECYCLE_STATUS = 'draft';
const DEFAULT_MASTER_GUIDE_EDITORIAL_STATUS = 'draft';
const DEFAULT_PUBLICATION_STATUS = 'draft';
const DEFAULT_STALENESS_STATUS = 'fresh';
const DEFAULT_APPROVAL_STATUS = 'draft';
const DEFAULT_AUDIO_STATUS = 'pending';
const DEFAULT_AUDIO_PROVIDER_KEY = 'noop';
const SOURCE_LANGUAGE_REGEX = /^[a-z]{2}(-[a-z]{2})?$/;

function parseSourceLanguage(value) {
  const trimmed = (value ?? DEFAULT_SOURCE_LANGUAGE).toString().trim().toLowerCase();
  if (!SOURCE_LANGUAGE_REGEX.test(trimmed)) {
    throw new AppError('Invalid source language code', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return trimmed.slice(0, 10);
}

function parseLifecycleStatus(value) {
  if (value === null || value === undefined || value === '') {
    return DEFAULT_LIFECYCLE_STATUS;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!PLACE_LIFECYCLE_STATUSES.includes(normalized)) {
    throw new AppError('Invalid lifecycle status', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return normalized;
}

function parseMasterGuideEditorialStatus(value) {
  if (value === null || value === undefined || value === '') {
    return DEFAULT_MASTER_GUIDE_EDITORIAL_STATUS;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!MASTER_GUIDE_EDITORIAL_STATUSES.includes(normalized)) {
    throw new AppError(
      'Invalid master guide editorial status',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  return normalized;
}

function sourceLanguageBodyRule() {
  return body('sourceLanguage')
    .optional({ values: 'falsy' })
    .custom((value) => {
      parseSourceLanguage(value);
      return true;
    })
    .withMessage('sourceLanguage must be a valid language code');
}

function masterGuideEditorialStatusBodyRule() {
  return body('masterGuideEditorialStatus')
    .optional({ values: 'falsy' })
    .custom((value) => {
      parseMasterGuideEditorialStatus(value);
      return true;
    })
    .withMessage('masterGuideEditorialStatus must be draft, in-progress, or complete');
}

function parsePublicationStatus(value) {
  if (value === null || value === undefined || value === '') {
    return DEFAULT_PUBLICATION_STATUS;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!PUBLICATION_STATUSES.includes(normalized)) {
    throw new AppError('Invalid publication status', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return normalized;
}

function parseStalenessStatus(value) {
  if (value === null || value === undefined || value === '') {
    return DEFAULT_STALENESS_STATUS;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!STALENESS_STATUSES.includes(normalized)) {
    throw new AppError('Invalid staleness status', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return normalized;
}

function parseApprovalStatus(value) {
  if (value === null || value === undefined || value === '') {
    return DEFAULT_APPROVAL_STATUS;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!APPROVAL_STATUSES.includes(normalized)) {
    throw new AppError('Invalid approval status', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return normalized;
}

function parseLanguage(value) {
  return parseSourceLanguage(value);
}

function parseAudioStatus(value) {
  if (value === null || value === undefined || value === '') {
    return DEFAULT_AUDIO_STATUS;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!AUDIO_STATUSES.includes(normalized)) {
    throw new AppError('Invalid audio status', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return normalized;
}

function parseProviderKey(value) {
  const { ensureAudioProvidersRegistered } = require('./audio/registerDefaultProviders');
  const AudioProviderRegistry = require('./audio/AudioProviderRegistry');
  ensureAudioProvidersRegistered();
  if (value === null || value === undefined || value === '') {
    const fromEnv = String(process.env.GUIDES_AUDIO_PROVIDER || DEFAULT_AUDIO_PROVIDER_KEY)
      .trim()
      .toLowerCase();
    if (!AudioProviderRegistry.has(fromEnv)) {
      return DEFAULT_AUDIO_PROVIDER_KEY;
    }
    return fromEnv;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!AudioProviderRegistry.has(normalized)) {
    throw new AppError('Invalid audio provider key', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return normalized;
}

function languageBodyRule(options = {}) {
  const rule = body('language');
  if (options.required) {
    return rule
      .exists({ checkFalsy: true })
      .custom((value) => {
        parseLanguage(value);
        return true;
      })
      .withMessage('language must be a valid language code');
  }
  return rule
    .optional({ values: 'falsy' })
    .custom((value) => {
      parseLanguage(value);
      return true;
    })
    .withMessage('language must be a valid language code');
}

function publicationStatusBodyRule() {
  return body('publicationStatus')
    .optional({ values: 'falsy' })
    .custom((value) => {
      parsePublicationStatus(value);
      return true;
    })
    .withMessage('publicationStatus must be draft, ready, or published');
}

module.exports = {
  PLACE_LIFECYCLE_STATUSES,
  MASTER_GUIDE_EDITORIAL_STATUSES,
  PUBLICATION_STATUSES,
  STALENESS_STATUSES,
  APPROVAL_STATUSES,
  AUDIO_STATUSES,
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_LIFECYCLE_STATUS,
  DEFAULT_MASTER_GUIDE_EDITORIAL_STATUS,
  DEFAULT_PUBLICATION_STATUS,
  DEFAULT_STALENESS_STATUS,
  DEFAULT_APPROVAL_STATUS,
  DEFAULT_AUDIO_STATUS,
  DEFAULT_AUDIO_PROVIDER_KEY,
  parseSourceLanguage,
  parseLifecycleStatus,
  parseMasterGuideEditorialStatus,
  parsePublicationStatus,
  parseStalenessStatus,
  parseApprovalStatus,
  parseLanguage,
  parseAudioStatus,
  parseProviderKey,
  sourceLanguageBodyRule,
  masterGuideEditorialStatusBodyRule,
  languageBodyRule,
  publicationStatusBodyRule,
};
