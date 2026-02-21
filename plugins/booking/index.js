// plugins/booking/index.js
// Public booking plugin - exposes slots for external booking without auth

const { Pool } = require('pg');
const BookingModel = require('./model');
const BookingController = require('./controller');
const createBookingRoutes = require('./routes');
const config = require('./plugin.config');
const ServiceManager = require('../../server/core/ServiceManager');

let bookingPool = null;

async function initBookingPool() {
  const userId = process.env.PUBLIC_BOOKING_USER_ID;

  if (!userId) {
    console.warn('⚠️  PUBLIC_BOOKING_USER_ID not set - public booking disabled');
    return null;
  }

  try {
    const tenantService = ServiceManager.get('tenant');
    const connectionString = await tenantService.getTenantConnection(parseInt(userId));

    const pool = new Pool({ connectionString });

    await pool.query('SELECT 1');
    console.log(`✅ Public booking pool initialized for user ${userId}`);

    return pool;
  } catch (error) {
    console.error('❌ Failed to initialize public booking pool:', error.message);
    return null;
  }
}

function initializeBookingPlugin(context) {
  const model = new BookingModel();
  const controller = new BookingController(model);

  initBookingPool()
    .then((pool) => {
      bookingPool = pool;
    })
    .catch((err) => {
      console.error('Failed to init booking pool:', err);
    });

  const bookingMiddleware = (req, res, next) => {
    req.bookingPool = bookingPool;
    next();
  };

  const express = require('express');
  const router = express.Router();

  router.use(bookingMiddleware);

  router.get('/slots', (req, res) => controller.getSlots(req, res));
  router.post('/slots/:id/book', (req, res) => controller.bookSlot(req, res));

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeBookingPlugin;
