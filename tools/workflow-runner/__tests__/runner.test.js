'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { WorkflowRunner } = require('../runner');
const { parseHandover } = require('../handoverParser');
const { decide } = require('../decisionPort');
const { normalizeGateNA, firstAssignment, nextRoleOnContinue } = require('../workflowSequence');
const { ROLES, COMMANDS, WORKFLOW_SEQUENCES } = require('../constants');
const { InstanceStore } = require('../InstanceStore');

function tmpStore() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wf-runner-'));
}

function handover(overrides = {}) {
  const fields = {
    Status: 'Approved',
    'Workflow State': 'Passed',
    'Current Role': ROLES.DOCS,
    Reason: 'Done',
    'Blocking Decisions': 'None',
    Deliverables: ['x'],
    Risks: 'None',
    'Scope Changes': 'None',
    'Requires User Input': 'No',
    'User Decision': 'N/A',
    'Handover Version': '1.0',
    ...overrides,
  };

  const deliverables = Array.isArray(fields.Deliverables)
    ? `Deliverables:\n${fields.Deliverables.map((d) => `  - ${d}`).join('\n')}`
    : `Deliverables: ${fields.Deliverables}`;

  const body = `\`\`\`handover
Status: ${fields.Status}
Workflow State: ${fields['Workflow State']}
Current Role: ${fields['Current Role']}
Reason: ${fields.Reason}
Blocking Decisions: ${fields['Blocking Decisions']}
${deliverables}
Risks: ${fields.Risks}
Scope Changes: ${fields['Scope Changes']}
Requires User Input: ${fields['Requires User Input']}
User Decision: ${fields['User Decision']}
Handover Version: ${fields['Handover Version']}
\`\`\``;

  return body;
}

describe('handoverParser', () => {
  test('parses valid fenced handover', () => {
    const result = parseHandover(handover());
    expect(result.ok).toBe(true);
    expect(result.fields.Status).toBe('Approved');
    expect(result.fingerprint).toHaveLength(64);
  });

  test('rejects wrong version', () => {
    const result = parseHandover(handover({ 'Handover Version': '2.0' }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unsupported Handover Version/);
  });

  test('rejects missing fence without Status', () => {
    const result = parseHandover('hello');
    expect(result.ok).toBe(false);
  });

  test('rejects invalid Status', () => {
    const result = parseHandover(handover({ Status: 'Maybe' }));
    expect(result.ok).toBe(false);
  });
});

describe('workflowSequence', () => {
  test('Framework first role is Documentation Specialist', () => {
    const gateNA = normalizeGateNA([]);
    expect(firstAssignment('Framework', gateNA)).toBe(ROLES.DOCS);
  });

  test('BackendOnly skips Architect when Grind2 N/A', () => {
    const gateNA = normalizeGateNA(['Grind2', 'Grind5']);
    expect(firstAssignment('BackendOnly', gateNA)).toBe(ROLES.BACKEND);
  });

  test('Continue from Docs in Framework goes to QA', () => {
    const gateNA = normalizeGateNA([]);
    const next = nextRoleOnContinue('Framework', gateNA, ROLES.DOCS, null);
    expect(next).toEqual({ role: ROLES.QA, complete: false });
  });

  test('DelegatorAcceptance first specialist is Solution Architect', () => {
    const gateNA = normalizeGateNA([]);
    expect(firstAssignment('DelegatorAcceptance', gateNA)).toBe(ROLES.ARCHITECT);
  });

  test('DelegatorAcceptance Continue SA to QA to Docs', () => {
    const gateNA = normalizeGateNA([]);
    expect(nextRoleOnContinue('DelegatorAcceptance', gateNA, ROLES.ARCHITECT, null)).toEqual({
      role: ROLES.QA,
      complete: false,
    });
    expect(nextRoleOnContinue('DelegatorAcceptance', gateNA, ROLES.QA, null)).toEqual({
      role: ROLES.DOCS,
      complete: false,
    });
    expect(nextRoleOnContinue('DelegatorAcceptance', gateNA, ROLES.DOCS, null)).toEqual({
      role: ROLES.TPM,
      complete: true,
    });
  });

  test('Continue with ReturnGate returns to reviewing gate', () => {
    const gateNA = normalizeGateNA([]);
    const next = nextRoleOnContinue('Framework', gateNA, ROLES.BACKEND, ROLES.QA);
    expect(next).toEqual({ role: ROLES.QA, complete: false });
  });
});

describe('subagent coverage', () => {
  test('all non-TPM roles in all WorkflowSequences have delegateSubagent', () => {
    const { delegationFields } = require('../emissionPort');
    Object.entries(WORKFLOW_SEQUENCES).forEach(([type, seq]) => {
      seq
        .filter((role) => role !== ROLES.TPM)
        .forEach((role) => {
          const { delegateSubagent } = delegationFields(role);
          expect(delegateSubagent).not.toBeNull();
          expect(delegateSubagent).toBeTruthy();
        });
    });
  });
});

describe('decisionPort matrix', () => {
  const baseInstance = {
    WorkflowType: 'Framework',
    EngineState: 'Running',
    _gateNASet: normalizeGateNA([]),
  };

  test('row 7 Continue', () => {
    const d = decide(baseInstance, {
      Status: 'Approved',
      'Workflow State': 'Passed',
      'Current Role': ROLES.DOCS,
      'Requires User Input': 'No',
      'Blocking Decisions': 'None',
      'Scope Changes': 'None',
      Reason: 'ok',
    });
    expect(d.matrixRow).toBe(7);
    expect(d.command).toBe(COMMANDS.CONTINUE);
    expect(d.activeRole).toBe(ROLES.QA);
  });

  test('row 1 Pause User', () => {
    const d = decide(baseInstance, {
      Status: 'Approved',
      'Workflow State': 'Awaiting User Decision',
      'Current Role': ROLES.DOCS,
      'Requires User Input': 'Yes',
      'Blocking Decisions': 'None',
      'Scope Changes': 'None',
      'User Decision': 'Pick A or B?',
      Reason: 'need user',
    });
    expect(d.matrixRow).toBe(1);
    expect(d.command).toBe(COMMANDS.PAUSE);
    expect(d.pauseKind).toBe('User');
  });

  test('row 4 Rework', () => {
    const d = decide(baseInstance, {
      Status: 'Rejected',
      'Workflow State': 'Blocked',
      'Current Role': ROLES.QA,
      'Requires User Input': 'No',
      'Blocking Decisions': 'None',
      'Scope Changes': 'None',
      Reason: 'tests failed',
    });
    expect(d.matrixRow).toBe(4);
    expect(d.command).toBe(COMMANDS.REWORK);
    expect(d.reworkTarget).toBe(ROLES.BACKEND);
    expect(d.returnGate).toBe(ROLES.QA);
  });

  test('row 3 Complete', () => {
    const d = decide(baseInstance, {
      Status: 'Approved',
      'Workflow State': 'Complete',
      'Current Role': ROLES.TPM,
      'Requires User Input': 'No',
      'Blocking Decisions': 'None',
      'Scope Changes': 'None',
      Reason: 'done',
    });
    expect(d.matrixRow).toBe(3);
    expect(d.command).toBe(COMMANDS.COMPLETE);
  });

  test('row 5 Needs Decision defaults to Pause User', () => {
    const d = decide(baseInstance, {
      Status: 'Needs Decision',
      'Workflow State': 'Passed',
      'Current Role': ROLES.DOCS,
      'Requires User Input': 'No',
      'Blocking Decisions': 'None',
      'Scope Changes': 'None',
      Reason: 'unclear',
    });
    expect(d.matrixRow).toBe(5);
    expect(d.pauseKind).toBe('User');
  });
});

describe('InstanceStore security', () => {
  test('rejects path-like InstanceId', () => {
    const store = new InstanceStore(tmpStore());
    expect(() => store.filePath('../evil')).toThrow(/Invalid InstanceId/);
  });

  test('rejects empty InstanceId', () => {
    const store = new InstanceStore(tmpStore());
    expect(() => store.filePath('')).toThrow(/Invalid InstanceId/);
  });
});

describe('WorkflowRunner integration', () => {
  let storeRoot;
  let runner;

  beforeEach(() => {
    storeRoot = tmpStore();
    runner = new WorkflowRunner({ storeRoot });
  });

  afterEach(() => {
    fs.rmSync(storeRoot, { recursive: true, force: true });
  });

  test('Start → Continue path (normative example Framework)', () => {
    const { instance, emission } = runner.start({
      InstanceId: 'wf-2026-07-16-01',
      WorkflowType: 'Framework',
      GateNA: [],
      DoD: ['Runner SSOT implemented'],
      brief: 'Implement runner',
    });
    expect(instance.EngineState).toBe('Running');
    expect(instance.ActiveRole).toBe(ROLES.DOCS);
    expect(emission.command).toBe(COMMANDS.START);
    expect(emission.text).toContain(
      'Activate: @.cursor/rules/role-documentation-specialist.mdc (manual)',
    );
    expect(emission.text).toContain('Delegate: documentation-specialist');
    expect(emission.delegateSubagent).toBe('documentation-specialist');
    expect(emission.delegateHint).toBe('Delegate: documentation-specialist');

    const cont = runner.onHandover(
      'wf-2026-07-16-01',
      handover({
        'Current Role': ROLES.DOCS,
        Reason: 'Runner SSOT published; CHANGELOG and cross-links updated.',
      }),
    );
    expect(cont.emission.command).toBe(COMMANDS.CONTINUE);
    expect(cont.instance.ActiveRole).toBe(ROLES.QA);
    expect(cont.emission.text).toContain('[Workflow Engine: Continue]');
    expect(cont.emission.delegateSubagent).toBe('qa-code-reviewer');
    expect(cont.emission.delegateHint).toBe('Delegate: qa-code-reviewer');
  });

  test('DelegatorAcceptance Start emission delegates to solution-architect', () => {
    const { emission } = runner.start({
      InstanceId: 'wf-delegator-acc',
      WorkflowType: 'DelegatorAcceptance',
      DoD: ['SA→QA→Docs without manual @role'],
    });
    expect(emission.Role).toBe(ROLES.ARCHITECT);
    expect(emission.delegateSubagent).toBe('solution-architect');
    expect(emission.text).toContain('Delegate: solution-architect');
  });

  test('idempotent duplicate handover (NFR-2)', () => {
    runner.start({
      InstanceId: 'wf-dup',
      WorkflowType: 'Framework',
      DoD: ['x'],
    });
    const raw = handover({ 'Current Role': ROLES.DOCS });
    const first = runner.onHandover('wf-dup', raw);
    expect(first.advanced).toBe(true);
    const second = runner.onHandover('wf-dup', raw);
    expect(second.idempotent).toBe(true);
    expect(second.advanced).toBe(false);
    expect(second.emission.text).toBe(first.emission.text);
  });

  test('invalid handover → Pause TPM (FR-9)', () => {
    runner.start({
      InstanceId: 'wf-bad',
      WorkflowType: 'Framework',
      DoD: ['x'],
    });
    const result = runner.onHandover('wf-bad', '```handover\nStatus: Approved\n```');
    expect(result.emission.command).toBe(COMMANDS.PAUSE);
    expect(result.instance.EngineState).toBe('Paused');
    expect(result.emission.text).toMatch(/Invalid Handover/);
  });

  test('Rework then Continue returns to same reviewing gate (FR-7)', () => {
    runner.start({
      InstanceId: 'wf-rework',
      WorkflowType: 'Framework',
      DoD: ['x'],
    });
    // Docs passes → QA
    runner.onHandover('wf-rework', handover({ 'Current Role': ROLES.DOCS }));
    // QA rejects
    const rework = runner.onHandover(
      'wf-rework',
      handover({
        Status: 'Rejected',
        'Workflow State': 'Blocked',
        'Current Role': ROLES.QA,
        Reason: 'Missing tests',
      }),
    );
    expect(rework.emission.command).toBe(COMMANDS.REWORK);
    expect(rework.instance.EngineState).toBe('Reworking');
    expect(rework.instance.ReturnGate).toBe(ROLES.QA);
    expect(rework.instance.ActiveRole).toBe(ROLES.BACKEND);

    // Backend fixes and passes → back to QA (not past to TPM)
    const after = runner.onHandover(
      'wf-rework',
      handover({
        'Current Role': ROLES.BACKEND,
        Reason: 'Tests added',
      }),
    );
    expect(after.emission.command).toBe(COMMANDS.CONTINUE);
    expect(after.instance.ActiveRole).toBe(ROLES.QA);
    expect(after.instance.ReturnGate).toBeNull();
  });

  test('Pause then Resume (FR-6)', () => {
    runner.start({
      InstanceId: 'wf-pause',
      WorkflowType: 'Framework',
      DoD: ['x'],
    });
    const paused = runner.onHandover(
      'wf-pause',
      handover({
        'Requires User Input': 'Yes',
        'Workflow State': 'Awaiting User Decision',
        'Current Role': ROLES.DOCS,
        'User Decision': 'Ship docs now?',
        Reason: 'Need confirmation',
      }),
    );
    expect(paused.instance.EngineState).toBe('Paused');

    const resumed = runner.resume('wf-pause', 'Yes, continue');
    expect(resumed.instance.EngineState).toBe('Running');
    expect(resumed.emission.command).toBe(COMMANDS.RESUME);
  });

  test('Completed instance rejects further handover', () => {
    runner.start({
      InstanceId: 'wf-done',
      WorkflowType: 'ArchitectureOnly',
      GateNA: [],
      DoD: ['ADR'],
    });
    // Architect completes workflow
    runner.onHandover(
      'wf-done',
      handover({
        'Current Role': ROLES.ARCHITECT,
        'Workflow State': 'Complete',
        Status: 'Approved',
      }),
    );
    const again = runner.onHandover('wf-done', handover({ 'Current Role': ROLES.ARCHITECT }));
    expect(again.advanced).toBe(false);
    expect(again.emission.command).toBe('Diagnostic');
  });

  test('emission includes required fields (FR-5)', () => {
    const { emission } = runner.start({
      InstanceId: 'wf-emit',
      WorkflowType: 'DocsOnly',
      GateNA: ['Grind2'],
      DoD: ['docs'],
    });
    expect(emission.InstanceId).toBe('wf-emit');
    expect(emission.command).toBe(COMMANDS.START);
    expect(emission.EngineState).toBe('Running');
    expect(emission.Role).toBe(ROLES.DOCS);
  });
});
