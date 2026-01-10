// packages/core/src/index.js
// Main entry point for @homebase/core SDK

const Logger = require('./Logger');
const Database = require('./Database');
const Context = require('./Context');
const Router = require('./Router');

/**
 * @homebase/core - Plugin SDK
 *
 * Stable interfaces for building Homebase plugins.
 * Plugins should ONLY import from this package, never directly from server internals.
 *
 * @example
 * const { Logger, Database, Context, Router } = require('@homebase/core');
 *
 * const logger = Logger.get();
 * const db = Database.get(req);
 * const userId = Context.getUserId(req);
 * const router = Router.create();
 */

module.exports = {
  Logger,
  Database,
  Context,
  Router,
};
