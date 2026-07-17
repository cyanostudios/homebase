'use strict';

/**
 * Canonical role names — Handover Contract §7.
 * Workflow Type sequences — Orchestration Model §7 (data for Continue; not a second SSOT prose).
 */

const ROLES = Object.freeze({
  TPM: 'Technical Project Manager',
  ARCHITECT: 'Solution Architect',
  DESIGNER: 'UI/UX Designer',
  BACKEND: 'Backend Developer',
  FRONTEND: 'Frontend Developer',
  QA: 'QA / Code Reviewer',
  SECURITY: 'Security Expert',
  DOCS: 'Documentation Specialist',
});

const ENGINE_STATES = Object.freeze([
  'NotStarted',
  'Running',
  'Paused',
  'Reworking',
  'Completed',
  'Cancelled',
]);

const COMMANDS = Object.freeze({
  START: 'Start',
  CONTINUE: 'Continue',
  REWORK: 'Rework',
  PAUSE: 'Pause',
  RESUME: 'Resume',
  COMPLETE: 'Complete',
});

const HANDOVER_STATUS = Object.freeze(['Approved', 'Rejected', 'Needs Decision']);
const WORKFLOW_STATES = Object.freeze(['Passed', 'Blocked', 'Awaiting User Decision', 'Complete']);

const HANDOVER_VERSION = '1.0';

/** Gate keys used in GateN/A (Grind 2 / 3 / 5). */
const GATE = Object.freeze({
  GRIND2: 'Grind2',
  GRIND3: 'Grind3',
  GRIND5: 'Grind5',
});

/**
 * Role → optional gate that may be N/A.
 * Orchestration Model §7 uses ? for optional gates.
 */
const ROLE_GATE = Object.freeze({
  [ROLES.ARCHITECT]: GATE.GRIND2,
  [ROLES.DESIGNER]: GATE.GRIND3,
  [ROLES.SECURITY]: GATE.GRIND5,
});

/**
 * Typical sequences from Orchestration Model §7.
 * Backend and Frontend both listed when type includes "and/or".
 * TPM appears at start (orchestrator) and end (close); Start skips leading TPM.
 */
const WORKFLOW_SEQUENCES = Object.freeze({
  FullFeature: [
    ROLES.TPM,
    ROLES.ARCHITECT,
    ROLES.DESIGNER,
    ROLES.BACKEND,
    ROLES.FRONTEND,
    ROLES.QA,
    ROLES.SECURITY,
    ROLES.DOCS,
    ROLES.TPM,
  ],
  BackendOnly: [
    ROLES.TPM,
    ROLES.ARCHITECT,
    ROLES.BACKEND,
    ROLES.QA,
    ROLES.SECURITY,
    ROLES.DOCS,
    ROLES.TPM,
  ],
  FrontendOnly: [
    ROLES.TPM,
    ROLES.ARCHITECT,
    ROLES.DESIGNER,
    ROLES.FRONTEND,
    ROLES.QA,
    ROLES.SECURITY,
    ROLES.DOCS,
    ROLES.TPM,
  ],
  ArchitectureOnly: [ROLES.TPM, ROLES.ARCHITECT, ROLES.TPM],
  Framework: [ROLES.TPM, ROLES.DOCS, ROLES.QA, ROLES.TPM],
  BugFix: [
    ROLES.TPM,
    ROLES.BACKEND,
    ROLES.FRONTEND,
    ROLES.QA,
    ROLES.SECURITY,
    ROLES.DOCS,
    ROLES.TPM,
  ],
  Hotfix: [ROLES.TPM, ROLES.BACKEND, ROLES.FRONTEND, ROLES.QA, ROLES.TPM],
  DocsOnly: [ROLES.TPM, ROLES.DOCS, ROLES.QA, ROLES.TPM],
  /** Acceptance test: SA → QA → Docs (Pivot 1 DelegatorAcceptance; not in orchestration-model SSOT). */
  DelegatorAcceptance: [ROLES.TPM, ROLES.ARCHITECT, ROLES.QA, ROLES.DOCS, ROLES.TPM],
});

const ROLE_SLUGS = Object.freeze({
  [ROLES.TPM]: 'technical-project-manager',
  [ROLES.ARCHITECT]: 'solution-architect',
  [ROLES.DESIGNER]: 'ui-ux-designer',
  [ROLES.BACKEND]: 'backend-developer',
  [ROLES.FRONTEND]: 'frontend-developer',
  [ROLES.QA]: 'qa-code-reviewer',
  [ROLES.SECURITY]: 'security-expert',
  [ROLES.DOCS]: 'documentation-specialist',
});

/**
 * Default rework targets — Orchestration Model §8.1 / Team Workflow §5.
 * Caller may override via handover context (cited role).
 */
function defaultReworkTarget(emittingRole, citedRole) {
  if (citedRole && Object.values(ROLES).includes(citedRole)) {
    return citedRole;
  }
  switch (emittingRole) {
    case ROLES.QA:
      return ROLES.BACKEND;
    case ROLES.SECURITY:
      return ROLES.BACKEND;
    case ROLES.DOCS:
      return ROLES.BACKEND;
    case ROLES.ARCHITECT:
      return ROLES.TPM;
    case ROLES.DESIGNER:
      return ROLES.ARCHITECT;
    default:
      return ROLES.BACKEND;
  }
}

module.exports = {
  ROLES,
  ENGINE_STATES,
  COMMANDS,
  HANDOVER_STATUS,
  WORKFLOW_STATES,
  HANDOVER_VERSION,
  GATE,
  ROLE_GATE,
  WORKFLOW_SEQUENCES,
  ROLE_SLUGS,
  defaultReworkTarget,
};
