/**
 * Garments plugin-target adapter: allowlist, validate intake, map → createPerson.
 */
const { AppError } = require('../../../server/core/errors/AppError');

const PLUGIN_ID = 'garments';

const ALLOWLIST_KEYS = Object.freeze([
  'name',
  'shirtSize',
  'shortsSize',
  'socksSize',
  'jerseyNumber',
  'jerseyName',
  'initials',
  'comment',
]);

const ALLOWLIST = new Set(ALLOWLIST_KEYS);

const FIELD_MAX_LENGTH = Object.freeze({
  name: 255,
  shirtSize: 50,
  shortsSize: 50,
  socksSize: 50,
  jerseyNumber: 20,
  jerseyName: 100,
  initials: 20,
  comment: 2000,
});

/** Flat object only (root object + string leaves). */
const MAX_DEPTH = 1;
const MAX_KEYS = ALLOWLIST_KEYS.length;
const MAX_PAYLOAD_CHARS = 8000;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertMaxDepth(value, maxDepth, current = 0) {
  if (current > maxDepth) {
    throw new AppError('extra_data exceeds max depth', 400, AppError.CODES.VALIDATION_ERROR);
  }
  if (Array.isArray(value)) {
    throw new AppError('extra_data must be a flat object', 400, AppError.CODES.VALIDATION_ERROR);
  }
  if (isPlainObject(value)) {
    for (const child of Object.values(value)) {
      assertMaxDepth(child, maxDepth, current + 1);
    }
  }
}

/**
 * Validate extra_data against garments allowlist (+ optional intakeSchema required flags).
 * @returns {Record<string, string>} sanitized flat string map
 */
function validateExtraData(extraData, intakeSchema = null) {
  if (extraData === null || extraData === undefined) {
    throw new AppError('extra_data is required', 400, AppError.CODES.VALIDATION_ERROR);
  }
  if (!isPlainObject(extraData)) {
    throw new AppError('extra_data must be an object', 400, AppError.CODES.VALIDATION_ERROR);
  }

  assertMaxDepth(extraData, MAX_DEPTH);

  const keys = Object.keys(extraData);
  if (keys.length > MAX_KEYS) {
    throw new AppError('extra_data has too many keys', 400, AppError.CODES.VALIDATION_ERROR);
  }

  let approxChars = 0;
  const schemaKeys = Array.isArray(intakeSchema)
    ? new Set(intakeSchema.map((f) => f && f.key).filter(Boolean))
    : null;

  const sanitized = {};
  for (const key of keys) {
    if (!ALLOWLIST.has(key)) {
      throw new AppError(`Invalid extra_data key: ${key}`, 400, AppError.CODES.VALIDATION_ERROR);
    }
    if (schemaKeys && !schemaKeys.has(key)) {
      throw new AppError(
        `extra_data key not in intake schema: ${key}`,
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    const raw = extraData[key];
    if (raw === null || raw === undefined) {
      continue;
    }
    if (typeof raw !== 'string') {
      throw new AppError(
        `extra_data.${key} must be a string`,
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    const maxLen = FIELD_MAX_LENGTH[key] || 255;
    const trimmed = raw.trim().slice(0, maxLen);
    approxChars += trimmed.length;
    if (trimmed) {
      sanitized[key] = trimmed;
    }
  }

  if (approxChars > MAX_PAYLOAD_CHARS) {
    throw new AppError('extra_data exceeds size limit', 400, AppError.CODES.VALIDATION_ERROR);
  }

  if (Array.isArray(intakeSchema)) {
    for (const field of intakeSchema) {
      if (!field || !field.key) continue;
      if (!ALLOWLIST.has(field.key)) {
        throw new AppError(
          `Invalid intake schema key: ${field.key}`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      if (field.required === true) {
        const value = sanitized[field.key];
        if (!value) {
          throw new AppError(
            `extra_data.${field.key} is required`,
            400,
            AppError.CODES.VALIDATION_ERROR,
          );
        }
      }
    }
  }

  return sanitized;
}

function mapToPersonPayload(sanitizedExtraData) {
  return {
    name: sanitizedExtraData.name || '',
    shirtSize: sanitizedExtraData.shirtSize ?? null,
    shortsSize: sanitizedExtraData.shortsSize ?? null,
    socksSize: sanitizedExtraData.socksSize ?? null,
    jerseyNumber: sanitizedExtraData.jerseyNumber ?? null,
    jerseyName: sanitizedExtraData.jerseyName ?? null,
    initials: sanitizedExtraData.initials ?? null,
    comment: sanitizedExtraData.comment ?? null,
  };
}

/**
 * Create garment_list_person from validated extra_data.
 * @returns {Promise<{ person: object, entityId: string }>}
 */
async function createFromRequest(req, { targetListId, extraData, intakeSchema }) {
  const sanitized = validateExtraData(extraData, intakeSchema);
  if (!sanitized.name) {
    throw new AppError('extra_data.name is required', 400, AppError.CODES.VALIDATION_ERROR);
  }

  const listId = String(targetListId || '').trim();
  if (!listId) {
    throw new AppError(
      'plugin_target_id (list id) is required',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }

  const GarmentsModel = require('../../garments/model');
  const garmentsModel = new GarmentsModel();
  const person = await garmentsModel.createPerson(req, listId, mapToPersonPayload(sanitized));
  return {
    person,
    entityId: person?.id != null ? String(person.id) : null,
  };
}

/**
 * Filter intakeSchema to allowlisted keys (for branding / settings coerce).
 */
function filterIntakeSchema(intakeSchema) {
  if (!Array.isArray(intakeSchema)) return null;
  const filtered = intakeSchema
    .filter((f) => f && ALLOWLIST.has(f.key))
    .map((f) => {
      const out = { key: f.key };
      if (f.required === true) out.required = true;
      return out;
    });
  return filtered.length ? filtered : null;
}

module.exports = {
  PLUGIN_ID,
  ALLOWLIST_KEYS,
  ALLOWLIST,
  FIELD_MAX_LENGTH,
  MAX_DEPTH,
  MAX_KEYS,
  MAX_PAYLOAD_CHARS,
  validateExtraData,
  mapToPersonPayload,
  createFromRequest,
  filterIntakeSchema,
};
