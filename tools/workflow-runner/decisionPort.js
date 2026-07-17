'use strict';

const { COMMANDS, defaultReworkTarget, ROLES } = require('./constants');
const { isNoneLike } = require('./handoverParser');
const { nextRoleOnContinue } = require('./workflowSequence');

/**
 * DecisionPort — Orchestration Model §5 (first match wins) + Engine §6 mapping.
 *
 * @param {object} instance Workflow Instance
 * @param {object} fields Parsed handover fields
 * @param {{ processDecision?: boolean }} [options]
 * @returns {DecisionResult}
 *
 * @typedef {object} DecisionResult
 * @property {string} command Engine command
 * @property {string} [pauseKind] 'User' | 'TPM'
 * @property {string} [pauseReason]
 * @property {string} [question]
 * @property {string} [activeRole]
 * @property {string} [reworkTarget]
 * @property {string} [returnGate]
 * @property {boolean} [clearReturnGate]
 * @property {string} [engineState]
 * @property {number} matrixRow
 */

function decide(instance, fields, options = {}) {
  const requiresUser = fields['Requires User Input'] === 'Yes';
  const workflowState = fields['Workflow State'];
  const status = fields.Status;
  const scopeChanges = fields['Scope Changes'];
  const blocking = fields['Blocking Decisions'];
  const currentRole = fields['Current Role'];
  const gateNA = instance._gateNASet;

  // Row 1
  if (requiresUser || workflowState === 'Awaiting User Decision') {
    return {
      command: COMMANDS.PAUSE,
      pauseKind: 'User',
      pauseReason: 'business',
      question: fields['User Decision'] !== 'N/A' ? fields['User Decision'] : fields.Reason,
      engineState: 'Paused',
      matrixRow: 1,
    };
  }

  // Row 2
  if (!isNoneLike(scopeChanges)) {
    return {
      command: COMMANDS.PAUSE,
      pauseKind: 'User',
      pauseReason: 'scope',
      question: `Scope changes require re-lock: ${formatList(scopeChanges)}`,
      engineState: 'Paused',
      matrixRow: 2,
    };
  }

  // Row 3
  if (workflowState === 'Complete') {
    return {
      command: COMMANDS.COMPLETE,
      engineState: 'Completed',
      activeRole: 'None',
      matrixRow: 3,
    };
  }

  // Row 4
  if (status === 'Rejected' || workflowState === 'Blocked' || !isNoneLike(blocking)) {
    const target = defaultReworkTarget(currentRole, options.citedReworkRole);
    return {
      command: COMMANDS.REWORK,
      engineState: 'Reworking',
      reworkTarget: target,
      returnGate: currentRole,
      activeRole: target,
      pauseReason: undefined,
      matrixRow: 4,
      reason: fields.Reason,
    };
  }

  // Row 5 / 6 — Needs Decision
  if (status === 'Needs Decision') {
    if (options.processDecision === true) {
      // Row 6: TPM-internal; caller must re-enter with updated context
      return {
        command: COMMANDS.PAUSE,
        pauseKind: 'TPM',
        pauseReason: 'process',
        question: fields.Reason,
        engineState: 'Paused',
        matrixRow: 6,
      };
    }
    // Prefer row 5 when classification unclear (Runner §8.5)
    return {
      command: COMMANDS.PAUSE,
      pauseKind: 'User',
      pauseReason: 'business',
      question: fields.Reason,
      engineState: 'Paused',
      matrixRow: 5,
    };
  }

  // Row 7
  if (
    status === 'Approved' &&
    workflowState === 'Passed' &&
    fields['Requires User Input'] === 'No' &&
    isNoneLike(blocking)
  ) {
    const returnGate =
      instance.EngineState === 'Reworking' && instance.ReturnGate ? instance.ReturnGate : null;

    const next = nextRoleOnContinue(instance.WorkflowType, gateNA, currentRole, returnGate);

    if (next.complete) {
      return {
        command: COMMANDS.COMPLETE,
        engineState: 'Completed',
        activeRole: 'None',
        clearReturnGate: true,
        matrixRow: 7,
      };
    }

    return {
      command: COMMANDS.CONTINUE,
      engineState: 'Running',
      activeRole: next.role,
      clearReturnGate: Boolean(returnGate),
      matrixRow: 7,
    };
  }

  // Row 8
  return {
    command: COMMANDS.PAUSE,
    pauseKind: 'TPM',
    pauseReason: 'ambiguous',
    question: `Ambiguous handover from ${currentRole}: Status=${status}; Workflow State=${workflowState}. ${fields.Reason}`,
    engineState: 'Paused',
    matrixRow: 8,
  };
}

/**
 * Decision for parse/validation failure — Runner §8.5 / matrix row 8.
 */
function decideParseFailure(errorMessage) {
  return {
    command: COMMANDS.PAUSE,
    pauseKind: 'TPM',
    pauseReason: 'parse',
    question: `Invalid Handover: ${errorMessage}`,
    engineState: 'Paused',
    matrixRow: 8,
  };
}

function formatList(value) {
  if (Array.isArray(value)) return value.join('; ');
  return String(value);
}

module.exports = {
  decide,
  decideParseFailure,
};
