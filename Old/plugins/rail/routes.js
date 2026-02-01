// plugins/rail/routes.js
const express = require('express');

function createRoutes(controller /*, requirePlugin */) {
  const router = express.Router();

  // POC: publika endpoints
  router.get('/announcements', (req, res) => controller.getAnnouncements(req, res));
  router.get('/stations', (req, res) => controller.getStations(req, res));

  return router;
}

module.exports = createRoutes;
