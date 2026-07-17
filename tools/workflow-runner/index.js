'use strict';

/**
 * Public API for Workflow Runner (Framework v2.4 implementation).
 * Spec: docs/ai/workflow-runner.md
 * ADR: docs/ai/adr/FRAMEWORK_WORKFLOW_RUNNER_IMPL.md
 */

const { WorkflowRunner } = require('./runner');
const { InstanceStore } = require('./InstanceStore');
const { parseHandover } = require('./handoverParser');
const { decide, decideParseFailure } = require('./decisionPort');
const emissionPort = require('./emissionPort');
const constants = require('./constants');
const workflowSequence = require('./workflowSequence');

module.exports = {
  WorkflowRunner,
  InstanceStore,
  parseHandover,
  decide,
  decideParseFailure,
  emissionPort,
  constants,
  workflowSequence,
};
