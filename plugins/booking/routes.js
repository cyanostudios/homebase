// plugins/booking/routes.js
// Public routes - no authentication required

const express = require('express');
const router = express.Router();

function createBookingRoutes(controller) {
  router.get('/slots', (req, res) => controller.getSlots(req, res));

  router.post('/slots/:id/book', (req, res) => controller.bookSlot(req, res));

  return router;
}

module.exports = createBookingRoutes;
