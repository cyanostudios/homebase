const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { body, commonRules, validateRequest } = require('../../server/core/middleware/validation');

const SCHEDULE_COLORS = ['green', 'blue', 'red', 'purple', 'orange', 'teal', 'white'];
const EVENT_TYPES = ['recurring', 'date_based'];
const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function createScheduleRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((_name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res, next) => controller.getAll(req, res, next));

  router.get('/:id', gate, commonRules.id('id'), validateRequest, (req, res, next) =>
    controller.getById(req, res, next),
  );

  router.post(
    '/',
    gate,
    csrfProtection,
    commonRules.plainString('name', 1, 255),
    body('color')
      .optional({ values: 'falsy' })
      .isIn(SCHEDULE_COLORS)
      .withMessage(`color must be one of: ${SCHEDULE_COLORS.join(', ')}`),
    validateRequest,
    (req, res, next) => controller.create(req, res, next),
  );

  router.put(
    '/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.plainString('name', 1, 255),
    body('color')
      .optional({ values: 'falsy' })
      .isIn(SCHEDULE_COLORS)
      .withMessage(`color must be one of: ${SCHEDULE_COLORS.join(', ')}`),
    validateRequest,
    (req, res, next) => controller.update(req, res, next),
  );

  router.delete(
    '/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res, next) => controller.delete(req, res, next),
  );

  router.post(
    '/:scheduleId/events',
    gate,
    csrfProtection,
    commonRules.id('scheduleId'),
    commonRules.plainString('title', 1, 255),
    body('event_type')
      .optional({ values: 'falsy' })
      .isIn(EVENT_TYPES)
      .withMessage(`event_type must be one of: ${EVENT_TYPES.join(', ')}`),
    body('day')
      .optional({ values: 'falsy' })
      .isIn(WEEK_DAYS)
      .withMessage(`day must be one of: ${WEEK_DAYS.join(', ')}`),
    body('event_date')
      .optional({ values: 'falsy' })
      .isISO8601({ strict: true })
      .withMessage('event_date must be a valid date'),
    body('start_time').optional({ values: 'falsy' }).isString().isLength({ max: 10 }),
    body('end_time').optional({ values: 'falsy' }).isString().isLength({ max: 10 }),
    body('location').optional({ values: 'falsy' }).isString().isLength({ max: 255 }),
    body('team_id').optional({ nullable: true }).isInt({ min: 1 }),
    validateRequest,
    (req, res, next) => controller.createEvent(req, res, next),
  );

  router.put(
    '/:scheduleId/events/:eventId',
    gate,
    csrfProtection,
    commonRules.id('scheduleId'),
    commonRules.id('eventId'),
    commonRules.plainString('title', 1, 255),
    body('event_type')
      .optional({ values: 'falsy' })
      .isIn(EVENT_TYPES)
      .withMessage(`event_type must be one of: ${EVENT_TYPES.join(', ')}`),
    body('day')
      .optional({ values: 'falsy' })
      .isIn(WEEK_DAYS)
      .withMessage(`day must be one of: ${WEEK_DAYS.join(', ')}`),
    body('event_date')
      .optional({ values: 'falsy' })
      .isISO8601({ strict: true })
      .withMessage('event_date must be a valid date'),
    body('start_time').optional({ values: 'falsy' }).isString().isLength({ max: 10 }),
    body('end_time').optional({ values: 'falsy' }).isString().isLength({ max: 10 }),
    body('location').optional({ values: 'falsy' }).isString().isLength({ max: 255 }),
    body('team_id').optional({ nullable: true }).isInt({ min: 1 }),
    validateRequest,
    (req, res, next) => controller.updateEvent(req, res, next),
  );

  router.delete(
    '/:scheduleId/events/:eventId',
    gate,
    csrfProtection,
    commonRules.id('scheduleId'),
    commonRules.id('eventId'),
    validateRequest,
    (req, res, next) => controller.deleteEvent(req, res, next),
  );

  return router;
}

module.exports = createScheduleRoutes;
