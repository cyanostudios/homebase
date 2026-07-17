# Handover Contract

Single source of truth for the shared, machine-readable handover envelope used by all AI Team Framework roles.

**Framework:** AI Team Framework v2.1 – adoption in roles  
**Handover Version (schema):** `1.0`  
**Status:** Adopted in all role docs (`docs/ai/roles/*`) and Cursor rules (`.cursor/rules/role-*.mdc`)

This document is the single source of truth for the Handover Contract schema. Adoption into roles does **not** change Team Workflow, Stage Gates, role authorities, or introduce automatic orchestration.

## 1. Purpose

Every role ends its work with the **same** structured Handover Contract so that:

- the next human (or future orchestrator) can parse outcome without reading full chat history;
- routing stays centralized in Team Workflow (owned by Technical Project Manager today, a central orchestrator later);
- the contract schema can evolve without breaking future automation (`Handover Version`).

## 2. Relation to Output Contract

| Concept               | Scope                                     | Owner of content                                          |
| --------------------- | ----------------------------------------- | --------------------------------------------------------- |
| **Output Contract**   | Role-specific deliverable fields          | Each role (defined in that role’s Cursor rule / role doc) |
| **Handover Contract** | Shared envelope after the Output Contract | This document                                             |

Handover Contract is an **additive envelope**. It comes **after** the role’s Output Contract. It does not replace or merge role-specific Output Contract fields.

The v1 communicative line `Överlämning:\n<role>` remains unchanged. Roles emit Handover Contract **after** Output Contract; they do **not** set `Next Role` in the envelope.

## 3. No Next Role

There is **no** `Next Role` field.

A single role must never decide which role activates next. That responsibility belongs to the **Technical Project Manager** as central orchestrator, using [orchestration-model.md](orchestration-model.md) together with [team-workflow.md](team-workflow.md) (Stage Gates and role order).

Distributing next-role choice to each role risks skipped gates, inconsistent judgments, and fragmented workflow logic.

## 4. Status vs Workflow State

Both fields are mandatory. They are **not** interchangeable.

| Field              | Meaning                              |
| ------------------ | ------------------------------------ |
| **Status**         | Result of the _current role’s_ work  |
| **Workflow State** | What should happen to the _workflow_ |

`Workflow State` does **not** replace `Status`.

## 5. Field reference (Handover Version 1.0)

All roles use exactly this structure. Every field is mandatory. Use `None` or `N/A` where specified when there is nothing to report.

| Field                   | Allowed values / type                                           | Notes                                               |
| ----------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| **Status**              | `Approved` \| `Rejected` \| `Needs Decision`                    | Outcome of the current role’s work                  |
| **Workflow State**      | `Passed` \| `Blocked` \| `Awaiting User Decision` \| `Complete` | Workflow continuation signal (see §6)               |
| **Current Role**        | Canonical role name (see §7)                                    | Role that produced this handover                    |
| **Reason**              | Short text                                                      | Why Status / Workflow State were set                |
| **Blocking Decisions**  | List, or `None`                                                 | Decisions that block progress                       |
| **Deliverables**        | List                                                            | References to Output Contract and other artifacts   |
| **Risks**               | List, or `None`                                                 | Known risks from this turn                          |
| **Scope Changes**       | List, or `None`                                                 | Scope changes identified this turn                  |
| **Requires User Input** | `Yes` \| `No`                                                   | Whether the user must act before workflow continues |
| **User Decision**       | Text if Requires User Input = `Yes`; otherwise `N/A`            | Captures or points to the needed decision           |
| **Handover Version**    | Schema version string; current: `1.0`                           | Versions the contract schema, not the Framework     |

### Explicitly excluded

- **Next Role** — never present in this contract (see §3).

## 6. Workflow State values

| Value                    | Meaning                                                                         |
| ------------------------ | ------------------------------------------------------------------------------- |
| `Passed`                 | Workflow may continue according to Team Workflow                                |
| `Blocked`                | Workflow cannot continue (e.g. blocking decision or rejection requiring rework) |
| `Awaiting User Decision` | Workflow waits on a user decision                                               |
| `Complete`               | Workflow for the task is finished                                               |

## 7. Canonical Current Role values

Use exactly these strings for `Current Role`:

- `Technical Project Manager`
- `Solution Architect`
- `UI/UX Designer`
- `Backend Developer`
- `Frontend Developer`
- `QA / Code Reviewer`
- `Security Expert`
- `Documentation Specialist`

## 8. Serialization

Emit the Handover Contract as a fenced block with language tag `handover` and fixed YAML-style keys so future automation can parse without NLP:

````markdown
```handover
Status: Approved
Workflow State: Passed
Current Role: QA / Code Reviewer
Reason: Quality gate passed; no blocking defects.
Blocking Decisions: None
Deliverables:
  - QA Output Contract (this turn)
  - Test run summary
Risks: None
Scope Changes: None
Requires User Input: No
User Decision: N/A
Handover Version: 1.0
```
````

## 9. Routing inputs (for TPM / future orchestrator)

The role does **not** choose the next role. TPM or orchestrator reads at least:

- `Current Role`
- `Status`
- `Workflow State`
- `Blocking Decisions`
- `Requires User Input`

…and then decides the next step using the **Orchestration Model** ([orchestration-model.md](orchestration-model.md)) operated through the **Workflow Engine** ([workflow-engine.md](workflow-engine.md)), which applies [team-workflow.md](team-workflow.md) Stage Gates and the task’s Workflow Type. Automated operation of that engine loop is defined in [workflow-runner.md](workflow-runner.md) (Framework v2.4). Roles never set `Next Role`.

## 10. No automatic activation

This contract is machine-readable so that orchestration can be automated later. In Framework v2.2:

- emitting a Handover Contract does **not** auto-activate the next role;
- Stage Gates and team-workflow gate definitions are unchanged;
- **routing policy** is defined in [orchestration-model.md](orchestration-model.md); schema remains Handover Version `1.0`.

## 11. Handover Version compatibility

`Handover Version` versions the **contract schema** (this document). It is distinct from the Framework changelog version (e.g. Framework v2.0).

| Change type                                                                                  | Version bump       | Rule                                               |
| -------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------- |
| Clarification only (no field/enum change)                                                    | None               | Keep `1.0`                                         |
| Additive optional field or additive enum value with documented default                       | Minor (e.g. `1.1`) | Parsers must ignore unknown keys until adopted     |
| Rename, remove, change meaning of existing field/enum, or add required field without default | Major (e.g. `2.0`) | Document migration in [CHANGELOG.md](CHANGELOG.md) |

Every emitted Handover Contract must include `Handover Version`. Current schema value: **`1.0`**.

## 12. Normative example

```handover
Status: Approved
Workflow State: Passed
Current Role: QA / Code Reviewer
Reason: Quality gate passed; no blocking defects.
Blocking Decisions: None
Deliverables:
  - QA Output Contract (this turn)
  - Test run summary
Risks: None
Scope Changes: None
Requires User Input: No
User Decision: N/A
Handover Version: 1.0
```

## 13. Related documents

- [orchestration-model.md](orchestration-model.md) — TPM routing policy (Framework v2.2)
- [workflow-engine.md](workflow-engine.md) — TPM Workflow Engine lifecycle and prompts (Framework v2.3)
- [workflow-runner.md](workflow-runner.md) — automated engine operator (Framework v2.4)
- [team-workflow.md](team-workflow.md) — Stage Gates and role order (routing source of truth for gates)
- [cursor-implementation.md](cursor-implementation.md) — Output Contract and Cursor realization principles
- [CHANGELOG.md](CHANGELOG.md) — Framework version history
- Role docs under [roles/](roles/) — role-specific Output Contracts
