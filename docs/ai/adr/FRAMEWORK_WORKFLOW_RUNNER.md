# ADR: Workflow Runner (Framework v2.4)

**Status:** Accepted (design for SSOT; implementation out of scope)  
**Date:** 2026-07-16  
**Context:** Grind 1 Output Contract – Workflow Runner Spec (D1: spec-only epic; D2: engine-layer only, manual role activation)

## Problem

Workflow Engine (v2.3), Orchestration Model (v2.2), and Handover Contract (v1.0) define how TPM _manually_ runs a workflow. Automation of that engine loop was explicitly out of scope. A future implementation needs a normative **Runner** layer so it does not invent routing, change Stage Gates, or auto-activate roles.

## Decision

Introduce **Workflow Runner** as a new normative layer _above_ Workflow Engine:

| Layer      | Document                 | Responsibility                                                                            |
| ---------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| Signal     | `handover-contract.md`   | Envelope schema                                                                           |
| Policy     | `orchestration-model.md` | Decision matrix                                                                           |
| Engine     | `workflow-engine.md`     | Lifecycle, commands, prompts                                                              |
| **Runner** | `workflow-runner.md`     | Automate engine operation: persist instance, parse handover, invoke matrix, emit commands |
| Gates      | `team-workflow.md`       | Stage Gates (unchanged)                                                                   |

Runner **invokes** Engine + Orchestration Model; it must not duplicate or alter their rules.

### Locked decisions (B1–B4)

| ID     | Decision                                                                                                                                                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1** | New SSOT file [`docs/ai/workflow-runner.md`](../workflow-runner.md). Do **not** fold Runner into `workflow-engine.md` — Engine remains the manual/operator spec; Runner is the automation operator of that engine.                  |
| **B2** | Framework version **v2.4** – Workflow Runner (spec).                                                                                                                                                                                |
| **B3** | Instance fields remain those in Engine §4 (normative). Persistence **medium** (chat notes, file, DB, etc.) is **non-normative** in v2.4 — only that the logical record exists and is auditable. Implementation epic chooses medium. |
| **B4** | Spec may define **abstract ports** (ingress, decision, emission, manual activation). Must **not** select Cursor hooks/skills/subagents or any product integration. Activation port is explicitly **manual** (D2).                   |

### Functional shape

1. **Start** — create Workflow Instance; emit Engine §10.1.
2. On each Handover — parse `handover` fence (v1.0); apply Orchestration Model §5; map to Engine command; update instance; emit §10.x.
3. **Pause** — stop until User Decision; then **Resume**.
4. **Rework** — set `ReworkTarget`; return to same reviewing gate after fix (Engine §9).
5. **Complete** — DoD check; close instance.
6. Never call role activation — only emit assignment text with manual activate hint.

### Backend / Frontend

**N/A** — Framework documentation only. No application code in this epic.

### Reuse

- Engine §4 instance, §5 commands, §10 prompts
- Orchestration Model §5 matrix, §7–§8 next-role / rework
- Handover Contract §5–§8 fields and serialization

### Alternatives considered

1. **Extend `workflow-engine.md` only** — Rejected: mixes manual operator duties with automation operator; harder to keep v2.3 “no auto” status clear.
2. **Full auto-activation in Runner** — Rejected by Grind 1 D2 and Engine/Orchestration out-of-scope.
3. **External orchestrator service now** — Rejected: D1 is spec-only; Engine §11 already excludes external integration in v2.3.

## Consequences

- Documentation Specialist publishes `workflow-runner.md` + CHANGELOG v2.4 + additive cross-links.
- Implementation remains a **separate** epic after this SSOT is QA-approved.
- Security review deferred to implementation epic (no runtime in v2.4).
- Specialist role Output Contracts and Handover Version `1.0` remain unchanged.

## Risks

| Risk                              | Mitigation                                       |
| --------------------------------- | ------------------------------------------------ |
| Runner duplicates matrix rows     | Normative: reference Orchestration Model §5 only |
| Spec too vague for implementation | FR/NFR + abstract ports + error behavior in SSOT |
| Scope creep to auto-activation    | D2 + Activation port = manual only               |
