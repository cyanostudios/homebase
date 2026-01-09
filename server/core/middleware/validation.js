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
  email: () => body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  
  string: (field, min = 1, max = 255) =>
    body(field)
      .trim()
      .isLength({ min, max })
      .withMessage(`${field} must be between ${min} and ${max} characters`)
      .escape(),
  
  optionalString: (field, max = 255) =>
    body(field)
      .optional()
      .trim()
      .isLength({ max })
      .withMessage(`${field} must not exceed ${max} characters`)
      .escape(),
  
  url: (field) =>
    body(field)
      .optional()
      .isURL()
      .withMessage(`${field} must be a valid URL`),
  
  phone: (field) =>
    body(field)
      .optional()
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
  
  date: (field) =>
    body(field)
      .optional()
      .isISO8601()
      .withMessage(`${field} must be a valid ISO 8601 date`)
      .toDate(),
  
  enum: (field, values) =>
    body(field)
      .optional()
      .isIn(values)
      .withMessage(`${field} must be one of: ${values.join(', ')}`),
  
  array: (field, max = 100) =>
    body(field)
      .optional()
      .isArray({ max })
      .withMessage(`${field} must be an array with at most ${max} items`),
  
  id: (field = 'id') => param(field).isInt().withMessage(`${field} must be a valid integer`),
  
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
