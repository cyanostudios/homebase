// server/core/middleware/validation.js
// Input validation helpers using express-validator

const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation result middleware
 * Checks validation results and returns errors if any
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array(),
    });
  }
  next();
}

/**
 * Common validation rules
 */
const commonRules = {
  email: () =>
    body('email')
      .optional({ values: 'falsy' })
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address'),

  string: (field, min = 1, max = 255) =>
    body(field)
      .trim()
      .isLength({ min, max })
      .withMessage(`${field} must be between ${min} and ${max} characters`)
      .escape(),

  /**
   * Plain text (e.g. title) – no .escape(); stored and displayed as-is.
   * Use for fields rendered as text in React (React escapes on output).
   */
  plainString: (field, min = 1, max = 255) =>
    body(field)
      .trim()
      .isLength({ min, max })
      .withMessage(`${field} must be between ${min} and ${max} characters`),

  optionalString: (field, max = 255) =>
    body(field)
      .optional({ values: 'falsy' }) // Allow null, undefined, empty string
      .customSanitizer((value) => {
        // Convert null/undefined to empty string, otherwise return trimmed value
        return value === null || value === undefined ? '' : String(value).trim();
      })
      .isLength({ max })
      .withMessage(`${field} must not exceed ${max} characters`)
      .escape(),

  /**
   * Rich text / HTML content field – skips .escape() so HTML tags are preserved.
   * Client is responsible for sanitising output with DOMPurify before rendering.
   */
  htmlContent: (field, max = 100000) =>
    body(field)
      .optional({ values: 'falsy' })
      .customSanitizer((value) => {
        return value === null || value === undefined ? '' : String(value).trim();
      })
      .isLength({ max })
      .withMessage(`${field} must not exceed ${max} characters`),

  url: (field) => body(field).optional().isURL().withMessage(`${field} must be a valid URL`),

  /** Optional URL: allow null/undefined/empty and keep raw URL (no escaping). */
  optionalUrl: (field, max = 500) =>
    body(field)
      .optional({ values: 'falsy' })
      .customSanitizer((value) => {
        return value === null || value === undefined ? '' : String(value).trim();
      })
      .isLength({ max })
      .withMessage(`${field} must not exceed ${max} characters`)
      .isURL()
      .withMessage(`${field} must be a valid URL`),

  phone: (field) =>
    body(field)
      .optional({ values: 'falsy' })
      .matches(/^\+?[0-9\s\-()]+$/)
      .withMessage(`${field} must be a valid phone number`),

  number: (field, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    body(field)
      .optional()
      .isFloat({ min, max })
      .withMessage(`${field} must be a number between ${min} and ${max}`),

  integer: (field, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    body(field)
      .optional()
      .isInt({ min, max })
      .withMessage(`${field} must be an integer between ${min} and ${max}`),

  /** Optional integer: allow null/undefined/empty; when present must be in range. */
  optionalInteger: (field, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    body(field)
      .optional({ values: 'falsy' })
      .isInt({ min, max })
      .withMessage(`${field} must be an integer between ${min} and ${max}`),

  date: (field) =>
    body(field)
      .optional({ values: 'falsy' }) // Allow null, undefined, empty string
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null/undefined/empty
        }
        // Check if it's a valid ISO 8601 date
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
        if (!iso8601Regex.test(value)) {
          throw new Error(`${field} must be a valid ISO 8601 date`);
        }
        return true;
      })
      .customSanitizer((value) => {
        // Convert to Date object if not null/undefined/empty
        return value === null || value === undefined || value === '' ? null : new Date(value);
      }),

  /** Required date (ISO 8601). Use when DB column is NOT NULL. */
  requiredDate: (field) =>
    body(field)
      .notEmpty()
      .withMessage(`${field} is required`)
      .custom((value) => {
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
        if (!iso8601Regex.test(value)) {
          throw new Error(`${field} must be a valid ISO 8601 date`);
        }
        return true;
      })
      .customSanitizer((value) =>
        value === null || value === undefined || value === '' ? null : new Date(value),
      ),

  /** Optional date (ISO 8601). Use when DB column allows NULL. */
  optionalDate: (field) =>
    body(field)
      .optional({ values: 'falsy' })
      .custom((value) => {
        if (value === null || value === undefined || value === '') return true;
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
        if (!iso8601Regex.test(value)) {
          throw new Error(`${field} must be a valid ISO 8601 date`);
        }
        return true;
      }),

  enum: (field, values) =>
    body(field)
      .optional()
      .isIn(values)
      .withMessage(`${field} must be one of: ${values.join(', ')}`),

  /**
   * Optional enum: allow null/undefined/empty string; when present must be in allowed values.
   * Use for select fields where UI may send null to clear.
   */
  optionalEnum: (field, values) =>
    body(field)
      .optional({ values: 'falsy' })
      .isIn(values)
      .withMessage(`${field} must be one of: ${values.join(', ')}`),

  array: (field, max = 100) =>
    body(field)
      .optional({ values: 'falsy' }) // Allow null, undefined
      .custom((value) => {
        if (value === null || value === undefined) {
          return true; // Allow null/undefined
        }
        if (!Array.isArray(value)) {
          throw new Error(`${field} must be an array`);
        }
        if (value.length > max) {
          throw new Error(`${field} must have at most ${max} items`);
        }
        return true;
      }),

  requiredArray: (field, max = 100) => {
    return [
      body(field).custom((value, { req }) => {
        // Additional debug logging for DELETE requests
        // Check if field exists
        if (value === undefined || value === null) {
          throw new Error(`${field} is required`);
        }

        // Check if it's an array
        if (!Array.isArray(value)) {
          throw new Error(`${field} must be an array`);
        }

        // Check if array is not empty
        if (value.length === 0) {
          throw new Error(`${field} cannot be empty`);
        }

        // Check max length
        if (value.length > max) {
          throw new Error(`${field} must have at most ${max} items`);
        }

        return true;
      }),
    ];
  },

  id: (field = 'id') => param(field).isInt().withMessage(`${field} must be a valid integer`),

  requiredId: (field) => body(field).isInt().withMessage(`${field} must be a valid integer`),

  queryString: (field, max = 255) =>
    query(field)
      .optional()
      .trim()
      .isLength({ max })
      .withMessage(`${field} must not exceed ${max} characters`),
};

module.exports = {
  validateRequest,
  commonRules,
  body,
  param,
  query,
  validationResult,
};
