'use strict';

const { InstanceStore } = require('./InstanceStore');
const { parseHandover } = require('./handoverParser');
const { decide, decideParseFailure } = require('./decisionPort');
const {
  emitStart,
  emitContinue,
  emitRework,
  emitPause,
  emitResume,
  emitComplete,
  emitDiagnostic,
} = require('./emissionPort');
const { normalizeGateNA, firstAssignment } = require('./workflowSequence');
const { COMMANDS, WORKFLOW_SEQUENCES } = require('./constants');

/**
 * Workflow Runner — automates Engine loop (FR-1..FR-9).
 * ActivationPort is manual-only (hint embedded in emissions).
 */
class WorkflowRunner {
  /**
   * @param {{ store?: InstanceStore, storeRoot?: string }} [opts]
   */
  constructor(opts = {}) {
    this.store = opts.store || new InstanceStore(opts.storeRoot);
  }

  /**
   * Start — Runner §8.1
   * @param {{ InstanceId: string, WorkflowType: string, GateNA?: any, DoD?: any, brief?: string }} input
   */
  start(input) {
    const { InstanceId, WorkflowType, GateNA = [], DoD = [], brief } = input;
    if (!InstanceId) throw new Error('InstanceId is required');
    if (!WORKFLOW_SEQUENCES[WorkflowType]) {
      throw new Error(`Unknown WorkflowType: ${WorkflowType}`);
    }
    if (this.store.exists(InstanceId)) {
      throw new Error(`Instance already exists: ${InstanceId}`);
    }

    const gateNASet = normalizeGateNA(GateNA);
    const firstRole = firstAssignment(WorkflowType, gateNASet);

    const instance = {
      InstanceId,
      WorkflowType,
      EngineState: 'Running',
      ActiveRole: firstRole,
      GateNA: Array.from(gateNASet),
      DoD: Array.isArray(DoD) ? DoD : [String(DoD)],
      LastHandover: null,
      PauseReason: null,
      ReworkTarget: null,
      ReturnGate: null,
      LastCommand: COMMANDS.START,
      LastEmissionAt: new Date().toISOString(),
      HandoverFingerprint: null,
      LastEmissionText: null,
    };

    const emission = emitStart(instance, firstRole, brief);
    instance.LastEmissionText = emission.text;
    this.store.save(instance);

    return { instance, emission };
  }

  /**
   * On Handover — Runner §8.2
   * @param {string} instanceId
   * @param {string} rawHandover
   * @param {{ citedReworkRole?: string, processDecision?: boolean }} [options]
   */
  onHandover(instanceId, rawHandover, options = {}) {
    const instance = this.store.load(instanceId);
    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    if (instance.EngineState === 'Completed' || instance.EngineState === 'Cancelled') {
      const emission = emitDiagnostic(
        instanceId,
        `Rejected: EngineState=${instance.EngineState}; no advancement`,
      );
      return { instance, emission, advanced: false };
    }

    const parsed = parseHandover(rawHandover);
    if (!parsed.ok) {
      return this._applyDecision(instance, decideParseFailure(parsed.error), null, parsed.error);
    }

    // NFR-2 duplicate
    if (
      instance.HandoverFingerprint &&
      instance.HandoverFingerprint === parsed.fingerprint &&
      instance.LastEmissionText
    ) {
      return {
        instance,
        emission: {
          InstanceId: instanceId,
          command: instance.LastCommand,
          EngineState: instance.EngineState,
          text: instance.LastEmissionText,
          idempotent: true,
        },
        advanced: false,
        idempotent: true,
      };
    }

    instance.LastHandover = parsed.body;
    instance.HandoverFingerprint = parsed.fingerprint;
    instance._gateNASet = normalizeGateNA(instance.GateNA);

    const decision = decide(instance, parsed.fields, options);
    return this._applyDecision(instance, decision, parsed.fields);
  }

  /**
   * UserDecisionIngress — Resume when Paused (FR-6 / §8.3)
   * @param {string} instanceId
   * @param {string} userDecision
   * @param {{ resumeHandover?: string, processDecision?: boolean }} [options]
   *   If resumeHandover provided, re-evaluate that handover after clearing pause.
   *   Otherwise clears pause and sets Running; operator should call onHandover next.
   */
  resume(instanceId, userDecision, options = {}) {
    const instance = this.store.load(instanceId);
    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }
    if (instance.EngineState !== 'Paused') {
      throw new Error(`Resume requires EngineState=Paused (got ${instance.EngineState})`);
    }

    instance.UserDecision = userDecision;
    instance.PauseReason = null;
    instance.EngineState = 'Running';

    if (options.resumeHandover) {
      // Clear fingerprint so the same body can be re-evaluated with new context
      instance.HandoverFingerprint = null;
      this.store.save(instance);

      const resumeEmission = emitResume(instance, userDecision, 're-evaluate');
      const result = this.onHandover(instanceId, options.resumeHandover, {
        processDecision: options.processDecision,
        citedReworkRole: options.citedReworkRole,
      });

      return {
        instance: result.instance,
        emission: result.emission,
        resumeEmission,
        advanced: result.advanced !== false,
      };
    }

    instance.LastCommand = COMMANDS.RESUME;
    instance.LastEmissionAt = new Date().toISOString();
    const emission = emitResume(instance, userDecision, 'await next Handover');
    instance.LastEmissionText = emission.text;
    this.store.save(instance);
    return { instance, emission, advanced: true };
  }

  /**
   * Cancel instance (user cancels).
   */
  cancel(instanceId, reason) {
    const instance = this.store.load(instanceId);
    if (!instance) throw new Error(`Instance not found: ${instanceId}`);
    instance.EngineState = 'Cancelled';
    instance.PauseReason = reason || 'user_cancels';
    instance.ActiveRole = 'None';
    instance.LastCommand = 'Cancel';
    instance.LastEmissionAt = new Date().toISOString();
    this.store.save(instance);
    return { instance };
  }

  _applyDecision(instance, decision, fields, parseError) {
    delete instance._gateNASet;

    if (decision.clearReturnGate) {
      instance.ReturnGate = null;
      instance.ReworkTarget = null;
    }

    instance.EngineState = decision.engineState || instance.EngineState;
    instance.LastCommand = decision.command;
    instance.LastEmissionAt = new Date().toISOString();

    let emission;

    switch (decision.command) {
      case COMMANDS.PAUSE:
        instance.PauseReason = decision.pauseReason || 'business';
        instance.EngineState = 'Paused';
        emission = emitPause(instance, decision);
        break;

      case COMMANDS.REWORK:
        instance.EngineState = 'Reworking';
        instance.ReworkTarget = decision.reworkTarget;
        instance.ReturnGate = decision.returnGate;
        instance.ActiveRole = decision.reworkTarget;
        emission = emitRework(instance, decision, fields);
        break;

      case COMMANDS.CONTINUE:
        instance.EngineState = 'Running';
        instance.ActiveRole = decision.activeRole;
        if (decision.clearReturnGate) {
          instance.ReturnGate = null;
          instance.ReworkTarget = null;
        }
        emission = emitContinue(instance, decision.activeRole, fields);
        break;

      case COMMANDS.COMPLETE:
        instance.EngineState = 'Completed';
        instance.ActiveRole = 'None';
        instance.ReturnGate = null;
        instance.ReworkTarget = null;
        emission = emitComplete(instance);
        break;

      default:
        emission = emitDiagnostic(
          instance.InstanceId,
          `Unhandled command ${decision.command}${parseError ? `: ${parseError}` : ''}`,
        );
    }

    instance.LastEmissionText = emission.text;
    this.store.save(instance);
    return { instance, emission, advanced: true, decision };
  }
}

module.exports = { WorkflowRunner };
