'use strict';

const { ROLE_SLUGS, COMMANDS } = require('./constants');

/**
 * ActivationPort — manual only (FR-8). Returns hint string; never invokes agents.
 * @param {string} role Canonical role name
 * @returns {string}
 */
function activateHint(role) {
  const slug = ROLE_SLUGS[role];
  if (!slug) {
    return `Activate: (unknown role ${role}) — manual only`;
  }
  return `Activate: @.cursor/rules/role-${slug}.mdc (manual)`;
}

/**
 * DelegationPort — subagent name for TPM Task delegation (Pivot 1).
 * Does not invoke agents; parallel to activateHint (manual @role fallback).
 * @param {string} role Canonical role name
 * @returns {{ hint: string, subagent: string | null }}
 */
function delegateHint(role) {
  const slug = ROLE_SLUGS[role];
  if (!slug) {
    return { hint: 'Delegate: (unknown role)', subagent: null };
  }
  return { hint: `Delegate: ${slug}`, subagent: slug };
}

function delegationFields(role) {
  const { hint, subagent } = delegateHint(role);
  return { delegateHint: hint, delegateSubagent: subagent };
}

/**
 * EmissionPort — Engine §10-equivalent text + structured fields (ADR I4).
 */
function emitStart(instance, firstRole, brief) {
  const text = [
    '[Workflow Engine: Start]',
    `InstanceId: ${instance.InstanceId}`,
    `WorkflowType: ${instance.WorkflowType}`,
    `Gate N/A: ${formatGateNA(instance.GateNA)}`,
    `Definition of Done: ${formatDoD(instance.DoD)}`,
    `First assignment → Role: ${firstRole}`,
    `Brief: ${brief || 'See Grind 1 Output Contract'}`,
    activateHint(firstRole),
    delegateHint(firstRole).hint,
  ].join('\n');

  return {
    InstanceId: instance.InstanceId,
    command: COMMANDS.START,
    EngineState: instance.EngineState,
    Role: firstRole,
    text,
    activateHint: activateHint(firstRole),
    ...delegationFields(firstRole),
  };
}

function emitContinue(instance, nextRole, lastFields, brief) {
  const text = [
    '[Workflow Engine: Continue]',
    `InstanceId: ${instance.InstanceId}`,
    'EngineState: Running',
    `Last Handover: Status=${lastFields.Status}; Workflow State=${lastFields['Workflow State']}; Current Role=${lastFields['Current Role']}`,
    `Next assignment → Role: ${nextRole}`,
    'Inputs to use: prior Output Contract + Handover only (not full chat)',
    `Brief: ${brief || 'Continue from prior Output Contract + Handover'}`,
    activateHint(nextRole),
    delegateHint(nextRole).hint,
  ].join('\n');

  return {
    InstanceId: instance.InstanceId,
    command: COMMANDS.CONTINUE,
    EngineState: 'Running',
    Role: nextRole,
    text,
    activateHint: activateHint(nextRole),
    ...delegationFields(nextRole),
  };
}

function emitRework(instance, decision, lastFields) {
  const target = decision.reworkTarget;
  const text = [
    '[Workflow Engine: Rework]',
    `InstanceId: ${instance.InstanceId}`,
    'EngineState: Reworking',
    `Rejected by: ${lastFields['Current Role']}`,
    `Reason: ${lastFields.Reason}`,
    `Rework target → Role: ${target}`,
    `Required fixes: ${lastFields.Reason}`,
    `Return gate after fix: ${decision.returnGate || lastFields['Current Role']}`,
    activateHint(target),
    delegateHint(target).hint,
  ].join('\n');

  return {
    InstanceId: instance.InstanceId,
    command: COMMANDS.REWORK,
    EngineState: 'Reworking',
    Role: target,
    ReturnGate: decision.returnGate,
    text,
    activateHint: activateHint(target),
    ...delegationFields(target),
  };
}

function emitPause(instance, decision) {
  const text = [
    '[Workflow Engine: Pause]',
    `InstanceId: ${instance.InstanceId}`,
    'EngineState: Paused',
    `PauseReason: ${decision.pauseReason || 'business'}`,
    `Question for user: ${decision.question || '(none)'}`,
    'Blocked until: User Decision recorded',
  ].join('\n');

  return {
    InstanceId: instance.InstanceId,
    command: COMMANDS.PAUSE,
    EngineState: 'Paused',
    PauseReason: decision.pauseReason,
    pauseKind: decision.pauseKind,
    question: decision.question,
    text,
  };
}

function emitResume(instance, userDecision, nextCommand) {
  const text = [
    '[Workflow Engine: Resume]',
    `InstanceId: ${instance.InstanceId}`,
    `User Decision: ${userDecision}`,
    `EngineState: ${instance.EngineState}`,
    `Next engine command: ${nextCommand}`,
  ].join('\n');

  return {
    InstanceId: instance.InstanceId,
    command: COMMANDS.RESUME,
    EngineState: instance.EngineState,
    UserDecision: userDecision,
    nextCommand,
    text,
  };
}

function emitComplete(instance) {
  const text = [
    '[Workflow Engine: Complete]',
    `InstanceId: ${instance.InstanceId}`,
    'EngineState: Completed',
    `WorkflowType: ${instance.WorkflowType}`,
    `Gates passed / N/A: ${formatGateNA(instance.GateNA)}`,
    'DoD: met',
    `Report to user: Workflow ${instance.InstanceId} completed`,
    'Release: not started (requires explicit user request)',
  ].join('\n');

  return {
    InstanceId: instance.InstanceId,
    command: COMMANDS.COMPLETE,
    EngineState: 'Completed',
    text,
  };
}

function emitDiagnostic(instanceId, message) {
  const text = `[Workflow Engine: Diagnostic]\nInstanceId: ${instanceId}\n${message}`;
  return {
    InstanceId: instanceId,
    command: 'Diagnostic',
    text,
  };
}

function formatGateNA(gateNA) {
  if (!gateNA || (Array.isArray(gateNA) && gateNA.length === 0)) return 'none';
  if (Array.isArray(gateNA)) return gateNA.join(', ');
  if (typeof gateNA === 'string') return gateNA || 'none';
  return JSON.stringify(gateNA);
}

function formatDoD(dod) {
  if (!dod) return '(none)';
  if (Array.isArray(dod)) return dod.map((d) => `- ${d}`).join(' ');
  return String(dod);
}

module.exports = {
  activateHint,
  delegateHint,
  delegationFields,
  emitStart,
  emitContinue,
  emitRework,
  emitPause,
  emitResume,
  emitComplete,
  emitDiagnostic,
};
