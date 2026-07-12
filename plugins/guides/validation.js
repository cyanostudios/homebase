// plugins/guides/validation.js
// Shared validation for routes (express-validator) and model (business logic).

const { body } = require('express-validator');
const { AppError } = require('../../server/core/errors/AppError');

const { ensureAudioProvidersRegistered } = require('./audio/registerDefaultProviders');
const AudioProviderRegistry = require('./audio/AudioProviderRegistry');

const AUDIO_STATUSES = ['pending', 'processing', 'ready', 'failed', 'stale'];
const DEFAULT_AUDIO_STATUS = 'pending';
const DEFAULT_PROVIDER_KEY = 'noop';
const PLACE_LIFECYCLE_STATUSES = ['draft', 'active', 'archived'];
const MASTER_GUIDE_EDITORIAL_STATUSES = ['draft', 'in-progress', 'complete'];
const GUIDE_STOP_EDITORIAL_STATUSES = MASTER_GUIDE_EDITORIAL_STATUSES;
const VARIANT_TYPES = ['quick', 'normal', 'deep'];
const PUBLICATION_STATUSES = ['draft', 'ready', 'published'];
const STALENESS_STATUSES = ['fresh', 'stale'];
const DEFAULT_SOURCE_LANGUAGE = 'sv';
const DEFAULT_LIFECYCLE_STATUS = 'draft';
const DEFAULT_MASTER_GUIDE_EDITORIAL_STATUS = 'draft';
const DEFAULT_PUBLICATION_STATUS = 'draft';
const DEFAULT_STALENESS_STATUS = 'fresh';
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

function parseGuideStopEditorialStatus(value) {
  if (value === null || value === undefined || value === '') {
    return DEFAULT_MASTER_GUIDE_EDITORIAL_STATUS;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!GUIDE_STOP_EDITORIAL_STATUSES.includes(normalized)) {
    throw new AppError('Invalid guide stop editorial status', 400, AppError.CODES.VALIDATION_ERROR);
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

function guideStopEditorialStatusBodyRule() {
  return body('editorialStatus')
    .optional({ values: 'falsy' })
    .custom((value) => {
      parseGuideStopEditorialStatus(value);
      return true;
    })
    .withMessage('editorialStatus must be draft, in-progress, or complete');
}

function parseVariantType(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!VARIANT_TYPES.includes(normalized)) {
    throw new AppError('Invalid variant type', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return normalized;
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

function parseLanguage(value) {
  return parseSourceLanguage(value);
}

function variantTypeBodyRule(options = {}) {
  const rule = body('variantType');
  if (options.required) {
    return rule
      .exists({ checkFalsy: true })
      .custom((value) => {
        parseVariantType(value);
        return true;
      })
      .withMessage('variantType must be quick, normal, or deep');
  }
  return rule
    .optional({ values: 'falsy' })
    .custom((value) => {
      parseVariantType(value);
      return true;
    })
    .withMessage('variantType must be quick, normal, or deep');
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
  ensureAudioProvidersRegistered();
  const normalized = String(value ?? DEFAULT_PROVIDER_KEY)
    .trim()
    .toLowerCase();
  if (!AudioProviderRegistry.has(normalized)) {
    throw new AppError('Invalid audio provider', 400, AppError.CODES.VALIDATION_ERROR);
  }
  return normalized.slice(0, 50);
}

function audioStatusBodyRule() {
  return body('status')
    .optional({ values: 'falsy' })
    .custom((value) => {
      parseAudioStatus(value);
      return true;
    })
    .withMessage('status must be pending, processing, ready, failed, or stale');
}

function providerKeyBodyRule() {
  return body('providerKey')
    .optional({ values: 'falsy' })
    .custom((value) => {
      parseProviderKey(value);
      return true;
    })
    .withMessage('providerKey must be a registered audio provider');
}

module.exports = {
  PLACE_LIFECYCLE_STATUSES,
  MASTER_GUIDE_EDITORIAL_STATUSES,
  GUIDE_STOP_EDITORIAL_STATUSES,
  VARIANT_TYPES,
  PUBLICATION_STATUSES,
  STALENESS_STATUSES,
  AUDIO_STATUSES,
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_LIFECYCLE_STATUS,
  DEFAULT_MASTER_GUIDE_EDITORIAL_STATUS,
  DEFAULT_PUBLICATION_STATUS,
  DEFAULT_STALENESS_STATUS,
  DEFAULT_AUDIO_STATUS,
  DEFAULT_PROVIDER_KEY,
  parseSourceLanguage,
  parseLifecycleStatus,
  parseMasterGuideEditorialStatus,
  parseGuideStopEditorialStatus,
  parseVariantType,
  parsePublicationStatus,
  parseStalenessStatus,
  parseLanguage,
  parseAudioStatus,
  parseProviderKey,
  sourceLanguageBodyRule,
  masterGuideEditorialStatusBodyRule,
  guideStopEditorialStatusBodyRule,
  variantTypeBodyRule,
  languageBodyRule,
  publicationStatusBodyRule,
  audioStatusBodyRule,
  providerKeyBodyRule,
};
