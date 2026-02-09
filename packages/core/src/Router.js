// packages/core/src/Router.js
// Router utilities for plugins

const express = require('express');

/**
 * Router utilities for creating plugin routes
 */
class Router {
  /**
   * Create a new Express router for plugin
   * @returns {Object} Express router
   */
  static create() {
    return express.Router();
  }

  /**
   * Create error handler middleware
   * @param {Function} handler - Async route handler
   * @returns {Function} Express middleware
   */
  static asyncHandler(handler) {
    return (req, res, next) => {
      Promise.resolve(handler(req, res, next)).catch(next);
    };
  }

  /**
   * Create validation middleware
   * @param {Object} schema - Validation schema
   * @returns {Function} Express middleware
   */
  static validate(schema) {
    return (req, res, next) => {
      const { error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map((d) => d.message),
        });
      }
      next();
    };
  }

  /**
   * Create pagination middleware
   * @returns {Function} Express middleware
   */
  static paginate() {
    return (req, res, next) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      req.pagination = {
        page,
        limit,
        offset,
      };

      // Helper to send paginated response
      res.paginate = (data, total) => {
        res.json({
          data,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
          },
        });
      };

      next();
    };
  }

  /**
   * Create response helpers middleware
   * @returns {Function} Express middleware
   */
  static responseHelpers() {
    return (req, res, next) => {
      // Success response
      res.success = (data, message = 'Success') => {
        res.json({
          success: true,
          message,
          data,
        });
      };

      // Error response
      res.error = (message, statusCode = 400, details = null) => {
        res.status(statusCode).json({
          success: false,
          error: message,
          details,
        });
      };

      next();
    };
  }
}

module.exports = Router;
