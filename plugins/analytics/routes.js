const express = require('express');
const { query } = require('express-validator');

const { validateRequest } = require('../../server/core/middleware/validation');

function createAnalyticsRoutes(controller, context) {
  const router = express.Router();
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin('analytics');

  const filtersValidation = [
    query('status').optional().trim().isLength({ max: 50 }),
    query('channel')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .matches(/^[a-z0-9_-]+(?::[a-z0-9_-]+)?$/i)
      .withMessage('channel must match "<channel>" or "<channel>:<market>"'),
    query('channelInstanceId').optional().isInt({ min: 1 }),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ];

  router.get('/overview', gate, filtersValidation, validateRequest, (req, res) =>
    controller.overview(req, res),
  );

  router.get(
    '/summary',
    gate,
    [
      ...filtersValidation,
      query('granularity')
        .optional()
        .isIn(['day', 'week', 'month'])
        .withMessage('granularity must be one of: day, week, month'),
    ],
    validateRequest,
    (req, res) => controller.summary(req, res),
  );

  router.get(
    '/timeseries',
    gate,
    [
      ...filtersValidation,
      query('granularity')
        .optional()
        .isIn(['day', 'week', 'month'])
        .withMessage('granularity must be one of: day, week, month'),
    ],
    validateRequest,
    (req, res) => controller.timeSeries(req, res),
  );

  router.get(
    '/status-distribution',
    gate,
    [
      ...filtersValidation,
      query('granularity')
        .optional()
        .isIn(['day', 'week', 'month'])
        .withMessage('granularity must be one of: day, week, month'),
    ],
    validateRequest,
    (req, res) => controller.statusDistribution(req, res),
  );

  router.get('/customer-segments', gate, filtersValidation, validateRequest, (req, res) =>
    controller.customerSegments(req, res),
  );

  router.get('/channels', gate, filtersValidation, validateRequest, (req, res) =>
    controller.channels(req, res),
  );

  router.get(
    '/top-products',
    gate,
    [...filtersValidation, query('limit').optional().isInt({ min: 1, max: 100 })],
    validateRequest,
    (req, res) => controller.topProducts(req, res),
  );

  router.get(
    '/drilldown/orders',
    gate,
    [
      ...filtersValidation,
      query('sku').optional().trim().isLength({ max: 255 }),
      query('limit').optional().isInt({ min: 1, max: 200 }),
      query('offset').optional().isInt({ min: 0 }),
    ],
    validateRequest,
    (req, res) => controller.drilldownOrders(req, res),
  );

  router.get(
    '/export/top-products.csv',
    gate,
    [...filtersValidation, query('limit').optional().isInt({ min: 1, max: 1000 })],
    validateRequest,
    (req, res) => controller.exportTopProductsCsv(req, res),
  );

  return router;
}

module.exports = createAnalyticsRoutes;
