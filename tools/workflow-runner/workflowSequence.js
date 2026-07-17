'use strict';

const { WORKFLOW_SEQUENCES, ROLE_GATE, ROLES, GATE } = require('./constants');

/**
 * Normalize GateN/A to a Set of gate keys: Grind2 | Grind3 | Grind5.
 * Accepts array of strings, object map, or comma-separated string.
 * @param {string[] | Record<string, boolean> | string | null | undefined} gateNA
 * @returns {Set<string>}
 */
function normalizeGateNA(gateNA) {
  const set = new Set();
  if (!gateNA) return set;
  if (typeof gateNA === 'string') {
    gateNA
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((g) => set.add(normalizeGateKey(g)));
    return set;
  }
  if (Array.isArray(gateNA)) {
    gateNA.forEach((g) => set.add(normalizeGateKey(g)));
    return set;
  }
  if (typeof gateNA === 'object') {
    for (const [k, v] of Object.entries(gateNA)) {
      if (v) set.add(normalizeGateKey(k));
    }
  }
  return set;
}

function normalizeGateKey(g) {
  const s = String(g).replace(/\s+/g, '');
  if (/^grind\s*2$/i.test(s) || s === '2') return GATE.GRIND2;
  if (/^grind\s*3$/i.test(s) || s === '3') return GATE.GRIND3;
  if (/^grind\s*5$/i.test(s) || s === '5') return GATE.GRIND5;
  if (s === GATE.GRIND2 || s === GATE.GRIND3 || s === GATE.GRIND5) return s;
  return s;
}

function isRoleSkipped(role, gateNA) {
  const gate = ROLE_GATE[role];
  if (!gate) return false;
  return gateNA.has(gate);
}

/**
 * First specialist after leading TPM (or TPM close if none).
 * @param {string} workflowType
 * @param {Set<string>} gateNA
 * @returns {string} canonical role
 */
function firstAssignment(workflowType, gateNA) {
  const seq = WORKFLOW_SEQUENCES[workflowType];
  if (!seq) {
    throw new Error(`Unknown WorkflowType: ${workflowType}`);
  }
  for (let i = 0; i < seq.length; i++) {
    const role = seq[i];
    if (role === ROLES.TPM && i === 0) continue;
    if (isRoleSkipped(role, gateNA)) continue;
    if (role === ROLES.TPM) {
      // Closing TPM with no specialists → complete-ready
      return ROLES.TPM;
    }
    return role;
  }
  return ROLES.TPM;
}

/**
 * Next role after currentRole on Continue (Orchestration Model §8).
 * If ReturnGate is set (post-rework), prefer returning to that gate first.
 * @returns {{ role: string, complete: boolean }}
 */
function nextRoleOnContinue(workflowType, gateNA, currentRole, returnGate) {
  if (returnGate) {
    return { role: returnGate, complete: false };
  }

  const seq = WORKFLOW_SEQUENCES[workflowType];
  if (!seq) {
    throw new Error(`Unknown WorkflowType: ${workflowType}`);
  }

  let idx = -1;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === currentRole) {
      // Prefer the latest occurrence that is not the trailing TPM when current is mid-flow
      idx = i;
      if (currentRole !== ROLES.TPM) break;
      // If Current Role is TPM, take first TPM (start) only when looking for next after start — rare
    }
  }

  // If current is closing TPM or not found, treat as ready to complete
  if (idx < 0) {
    return { role: ROLES.TPM, complete: true };
  }

  // When Current Role is TPM and idx is 0 (start), walk forward; when last TPM, complete
  if (currentRole === ROLES.TPM && idx === seq.length - 1) {
    return { role: ROLES.TPM, complete: true };
  }

  for (let i = idx + 1; i < seq.length; i++) {
    const role = seq[i];
    if (isRoleSkipped(role, gateNA)) continue;
    if (role === ROLES.TPM) {
      return { role: ROLES.TPM, complete: true };
    }
    return { role, complete: false };
  }

  return { role: ROLES.TPM, complete: true };
}

module.exports = {
  normalizeGateNA,
  firstAssignment,
  nextRoleOnContinue,
  isRoleSkipped,
};
