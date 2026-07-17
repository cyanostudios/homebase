# ADR: Workflow Runner Implementation (Framework v2.4)

**Status:** Accepted  
**Date:** 2026-07-16  
**Context:** Grind 1 Output Contract – Workflow Runner v2.4 Implementationsepic; locked SSOT [`workflow-runner.md`](../workflow-runner.md) + design ADR [`FRAMEWORK_WORKFLOW_RUNNER.md`](FRAMEWORK_WORKFLOW_RUNNER.md)

## Problem

The Runner SSOT defines abstract ports and a runtime algorithm but leaves runtime host, persistence medium, and delivery scope to the implementation epic. Backend cannot start without those decisions.

## Decision

### I1 — Runtime host

**Node.js CommonJS library** under [`tools/workflow-runner/`](../../../tools/workflow-runner/) with a thin CLI (`cli.js`).

| Chosen                                                  | Rejected                                                 |
| ------------------------------------------------------- | -------------------------------------------------------- |
| Pure Node module + CLI; Jest unit tests                 | Cursor hooks / skills / subagents as the decision engine |
| Library callable from scripts or future Cursor wrappers | External orchestrator / queue / HTTP service             |

**Rationale:** Determinism (NFR-1), testability, and ADR B4 (no product-bound activation). Core logic must not depend on Cursor. A future Cursor skill may _call_ the CLI; it must not reimplement DecisionPort.

### I2 — Persistence medium

**JSON files** at `.workflow-runner/instances/<InstanceId>.json` (workspace-local; gitignored).

| Chosen                  | Rejected                                                                |
| ----------------------- | ----------------------------------------------------------------------- |
| File JSON InstanceStore | In-memory only (fails NFR-3 across sessions)                            |
|                         | Database / Neon (unnecessary for framework tooling; Release Discipline) |
|                         | Chat notes (not machine-auditable)                                      |

Optional audit fields from Runner SSOT §6.1: `LastCommand`, `LastEmissionAt`, `HandoverFingerprint`. Implementation also stores `ReturnGate` (role that rejected) so Continue after rework returns to the same reviewing gate (Engine §9) without inventing routing.

### I3 — Delivery scope

**Full** — all ports in one delivery: InstanceStore, HandoverIngress, DecisionPort, EmissionPort, UserDecisionIngress, ActivationPort (manual hint only).

### I4 — Emission shape

EmissionPort returns a **structured object** (InstanceId, command, EngineState, Role / PauseReason / …) and a **text** body matching Engine §10 templates. Consumers (CLI stdout, tests) use the same fields.

### I5 — DecisionPort policy binding

DecisionPort implements Orchestration Model §5 top-to-bottom (first match wins). Workflow Type sequences are coded from Orchestration Model §7 as data used by Continue — not a second SSOT prose copy. Invalid / unparseable Handover → Pause — TPM (row 8 / Runner §8.5). `Status=Needs Decision` without an explicit process flag → Pause — User (prefer row 5).

## Backend / Frontend

| Layer        | Responsibility                                                                    |
| ------------ | --------------------------------------------------------------------------------- |
| **Backend**  | All of `tools/workflow-runner/` (ports, runner, CLI, tests). npm script optional. |
| **Frontend** | **N/A** — no UI.                                                                  |

## Reuse

- Engine §4 instance fields, §5 commands, §10 prompts
- Orchestration Model §5 matrix, §7–§8 sequences / rework targets
- Handover Contract §5–§8 parse rules
- Existing Jest (`jest.config.js`) — add `tools/workflow-runner` to roots

## Alternatives considered

1. **Cursor Skill as sole runner** — Rejected: harder to unit-test; risks schema/routing drift; conflicts with B4 spirit.
2. **DB-backed InstanceStore** — Rejected for this epic: overkill; involves prod/local DB concerns unnecessarily.
3. **MVP without Resume / Activation hint** — Rejected: DoD requires FR-6 and FR-8.

## Consequences

- Backend implements against this ADR + locked Runner SSOT; must not edit Framework SSOTs.
- `.workflow-runner/` gitignored; instance files stay local.
- Security reviews trust boundary of file store + CLI input validation.
- Docs update `cursor-implementation.md` to describe CLI wiring (manual activation unchanged).

## Risks

| Risk                                         | Mitigation                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| Matrix logic drifts from Orchestration Model | Tests mirror §5 rows; comments cite section; no prose duplication of gate tables |
| Path traversal via InstanceId                | Validate InstanceId to safe charset; resolve paths under store root only         |
| Accidental auto-activation                   | ActivationPort emits hint string only; no Cursor API calls                       |
