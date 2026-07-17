# Workflow Runner (Framework v2.4)

Node.js implementation of [`docs/ai/workflow-runner.md`](../../docs/ai/workflow-runner.md).

**ADR:** [`docs/ai/adr/FRAMEWORK_WORKFLOW_RUNNER_IMPL.md`](../../docs/ai/adr/FRAMEWORK_WORKFLOW_RUNNER_IMPL.md)  
**Pivot 1 delegation:** [`docs/ai/adr/FRAMEWORK_PIVOT1_SUBAGENT_IMPL.md`](../../docs/ai/adr/FRAMEWORK_PIVOT1_SUBAGENT_IMPL.md)

## What it does

Automates the Workflow Engine loop: persist instance → parse Handover v1.0 → apply Orchestration Model §5 → emit Engine §10 commands.

**Does not** invoke Cursor agents. Emissions include:

- `Activate:` hint — manual `@.cursor/rules/role-<slug>.mdc` fallback
- `Delegate:` hint + `delegateSubagent` — TPM parent uses Task tool (Pivot 1; see `docs/ai/cursor-implementation.md`)

## CLI

```bash
npm run workflow-runner -- start --id wf-demo --type Framework --dod "Runner implemented"
npm run workflow-runner -- handover --id wf-demo --file path/to/handover.md
npm run workflow-runner -- resume --id wf-demo --decision "Approved"
npm run workflow-runner -- show --id wf-demo
```

**Acceptance test workflow** (Pivot 1):

```bash
npm run workflow-runner -- start --id wf-accept-delegator-01 \
  --type DelegatorAcceptance \
  --dod "SA→QA→Docs without manual @role"
```

## Artifact paths (gitignored)

| Path                                           | Purpose                                    |
| ---------------------------------------------- | ------------------------------------------ |
| `.workflow-runner/instances/<InstanceId>.json` | Instance state                             |
| `.workflow-runner/handovers/`                  | Handover fences per step                   |
| `.workflow-runner/artifacts/`                  | Output Contract snapshots for Task prompts |

## Library

```js
const { WorkflowRunner } = require('./tools/workflow-runner');
const runner = new WorkflowRunner();
runner.start({ InstanceId: 'wf-1', WorkflowType: 'BackendOnly', GateNA: ['Grind3'], DoD: ['…'] });
runner.onHandover('wf-1', rawHandoverMarkdown);
```

## Tests

```bash
npm run test:workflow-runner
```

Includes `subagent coverage` — asserts every non-TPM role in all `WORKFLOW_SEQUENCES` maps to a `delegateSubagent` via `ROLE_SLUGS`.
