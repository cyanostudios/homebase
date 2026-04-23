# App.tsx Refactor Guide for Cursor Agent

## Historical context (2026-04)

`client/src/App.tsx` is now a thin entry file. Most orchestration has moved to `client/src/core/app/` (`AppRoutes.tsx`, `AppContent.tsx`, `PluginProviders.tsx`).

Use this guide as historical guidance for decomposition patterns, but apply changes to current orchestration files first.

Use this guide to improve the current `App.tsx` structure **without unnecessary refactoring**.

This is **not** a rewrite.
This is **not** a cleanup for aesthetics.
This is a targeted structural improvement task.

The goal is to reduce risk in `App.tsx` by moving out **plugin-specific special logic** while keeping `App.tsx` as the orchestration layer.

---

## 1. Rules

1. Do **not** rewrite `App.tsx` from scratch.
2. Do **not** move code just to make the file shorter.
3. Do **not** change working behavior unless there is a clear reason.
4. Do **not** modify plugin behavior unless it is required to preserve current behavior.
5. Keep `App.tsx` responsible for:
   - top-level routes
   - providers
   - current page resolution
   - current plugin/panel orchestration
   - layout composition
6. Focus only on extracting logic that is:
   - plugin-specific
   - repetitive
   - conditional-heavy
   - likely to grow over time
7. If a function is already correctly separated into core helpers, leave it alone.
8. Make minimal, reversible changes.

---

## 2. Current architectural interpretation

The current structure is mostly sound.

Already separated and should generally remain separated:

- `panelHandlers.ts`
- `panelRendering.tsx`
- `PanelFooter.tsx`
- `PanelTitles.tsx`
- `routeMap.ts`
- `useGlobalNavigationGuard.tsx`
- layout files such as `MainLayout.tsx`

`App.tsx` should remain the application orchestrator.

The problem is not file size alone.
The problem is that `App.tsx` still contains several **plugin-specific exceptions and branching paths** that should not continue growing there.

---

## 3. Refactor objective

Refactor only enough to achieve this:

- `App.tsx` becomes more declarative
- plugin-specific special cases are moved out of `App.tsx`
- current functionality remains unchanged
- no broad contract rewrite is introduced

---

## 4. Main target areas

You must focus on these three areas only.

### Area A: primaryAction logic

The current `primaryAction` logic in `App.tsx` contains multiple plugin-specific branches for:

- contacts
- tasks
- slots
- matches
- estimates
- files
- mail
- pulses
- settings-like content views
- list vs settings mode exceptions

This is the best first extraction target.

### Area B: detail panel header button logic

The current header-right action logic contains mode-specific and plugin-specific branching such as:

- quick update cases
- item navigation conditions
- edit/update/close combinations
- plugin-specific quick edit behavior

Do not redesign this fully.
Only extract the decision logic from `App.tsx`.

### Area C: cross-plugin dialog orchestration

The current cross-plugin flows in `App.tsx` include:

- create task from note
- create slot from match

Do not replace the flows.
Do not change behavior.
Extract the orchestration code into clearly named helpers so `App.tsx` no longer contains long inline blocks.

---

## 5. Explicit non-goals

Do **not** do any of the following:

- do not change `AppContext.tsx`
- do not redesign plugin contracts globally
- do not replace naming-convention based plugin lookup
- do not replace `pluginRegistry.ts` structure
- do not introduce a new framework or state manager
- do not move all JSX into many tiny files
- do not alter routing behavior
- do not rewrite duplicate flow unless required by extraction
- do not touch auth flow
- do not touch `PluginProviders` unless required by typing

---

## 6. Files to read before changing anything

Read and understand these files first:

### Core app files

- `client/src/App.tsx`
- `client/src/core/pluginRegistry.ts`
- `client/src/core/pluginSingular.ts`

### Existing extracted helper files

- `client/src/core/handlers/panelHandlers.ts`
- `client/src/core/rendering/panelRendering.tsx`
- `client/src/core/ui/PanelFooter.tsx`
- `client/src/core/ui/PanelTitles.tsx`
- `client/src/core/routing/routeMap.ts`
- `client/src/hooks/useGlobalNavigationGuard.tsx`

### Supporting layout files

- `client/src/core/ui/MainLayout.tsx`
- `client/src/core/ui/Sidebar.tsx`

Do not code until these are read.

---

## 7. What to create

Create new helper files only if they directly remove plugin-specific branching from `App.tsx`.

Recommended structure:

- `client/src/core/app/getPrimaryAction.tsx`
- `client/src/core/app/getDetailPanelHeaderRight.tsx`
- `client/src/core/app/crossPluginDialogs.tsx`

Alternative naming is acceptable if:

- names are clear
- responsibilities are narrow
- files are not generic dumping grounds

Do not create more files than necessary.

---

## 8. Extraction plan

Follow this exact order.

### Phase 1: inventory only

Read all required files.
Return:

- files read
- target extraction points
- proposed new helper files
- no code changes yet

### Phase 2: extract primaryAction logic

Move only the decision logic for `primaryAction` out of `App.tsx`.

Requirements:

- preserve all current plugin-specific behavior
- preserve current use of `attemptNavigation`
- preserve current content view handling
- preserve settings/list special cases
- preserve current button label/icon/variant/onClick output

Recommended result:
A helper that receives enough inputs from `App.tsx` and returns either:

- `null`
- or a fully prepared primary action object

After extraction:

- `App.tsx` should only call the helper
- no behavior change

### Phase 3: extract detail panel header-right decision logic

Move only the decision-building logic for the panel header-right area out of `App.tsx`.

Requirements:

- preserve current mode behavior
- preserve quick edit/update behavior
- preserve item navigation behavior
- preserve edit/update/close button combinations
- preserve translation usage

Recommended result:
A helper that returns the header-right JSX or `undefined`.

After extraction:

- `App.tsx` should not contain long nested ternary/branch logic for header-right actions

### Phase 4: extract cross-plugin dialog helpers

Extract the action logic used by:

- note -> task flow
- match -> slot flow

Important:

- keep dialogs rendered from `App.tsx` if needed
- but move the long callback logic into reusable helper functions

You may:

- create pure helper functions
- or create small helper components
- but do not over-engineer

### Phase 5: cleanup only

After extraction:

- remove dead code
- remove no-longer-needed inline helpers
- keep behavior exactly the same
- do not introduce extra refactors

---

## 9. Required output shape for new helpers

### `getPrimaryAction`

Should accept the minimum required inputs, for example:

- current page
- current page plugin
- plugin contexts
- translation function
- navigation guard helper

Should return:

- `null`
- or `{ label, icon, onClick, variant? }`

### `getDetailPanelHeaderRight`

Should accept:

- current mode
- current plugin
- current plugin context
- current item
- handlers
- translation function

Should return:

- JSX element
- or `undefined`

### cross-plugin helpers

Should accept only the data required to execute the current behavior.
Avoid hidden dependencies where possible.

---

## 10. Constraints for the agent

### Preserve current behavior

This refactor is successful only if:

- no visible user behavior changes
- no route behavior changes
- no plugin panel behavior changes
- no unsaved-changes behavior changes

### Keep `App.tsx` in control

Even after extraction, `App.tsx` must still clearly show:

- provider composition
- route composition
- page orchestration
- layout rendering
- panel rendering orchestration

Do not hollow it out into a shell with no readable logic.

### Keep helpers focused

Each extracted helper must have one responsibility.
Do not create a new `appUtils.ts` dumping ground.

---

## 11. What to avoid during implementation

Do not do any of these:

- do not convert everything to a new contract system
- do not change plugin naming conventions
- do not move duplicate flow unless it is directly required
- do not add new plugin metadata fields unless absolutely necessary
- do not rewrite translation behavior
- do not change component props unless necessary
- do not refactor unrelated files “while you are there”

---

## 12. Suggested review criteria

After implementation, verify these questions:

1. Is `App.tsx` still the orchestrator?
2. Is `App.tsx` easier to read than before?
3. Did plugin-specific branching decrease?
4. Did we avoid changing behavior?
5. Are the new helper files clearly scoped?
6. Did we avoid touching `AppContext.tsx`?
7. Did we avoid introducing speculative abstractions?

If any answer is no, revise before finishing.

---

## 13. Final delivery format

When finished, return:

### Status

One of:

- `refactor completed`
- `blocked by file mismatch`
- `completed with minimal deviations`

### Files read

List them.

### Files created

List them.

### Files modified

List them.

### What was extracted

Describe exactly what moved out of `App.tsx`.

### What intentionally stayed in `App.tsx`

List what remains and why.

### Behavior confirmation

Confirm whether these stayed unchanged:

- routing
- provider composition
- primary action behavior
- detail panel behavior
- cross-plugin dialog behavior
- unsaved changes protection

Use:

- `confirmed`
- `not confirmed`

### Deviations

If none, write:

- `no deviations`

### Blockers

If none, write:

- `no blockers`

### Stop rule

After the report, stop.
Do not continue refactoring other files unless explicitly requested.

---

## 14. First action now

Do this first:

1. Read the required files
2. Identify the exact sections in `App.tsx` for:
   - primaryAction
   - detailPanelHeaderRight
   - cross-plugin dialog callbacks
3. Propose the minimum helper file set
4. Wait before making broader changes
