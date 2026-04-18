# Core Architecture Review for Cursor

This document is a focused architectural review of the current Homebase core/plugin orchestration layer.

It is intended for **careful cleanup and guardrails**, not large refactors.

The system is **not in production yet**, but the goal is still to avoid unnecessary churn.  
Only recommend changes that are:

- low risk
- high value
- easy to verify
- unlikely to break plugin behavior

Do **not** treat this as a rewrite plan.

---

## Review scope

Files reviewed:

### Core backend

- `plugin-loader.js`

### Core frontend

- `App.tsx` (thin entry; routes live in `core/app/AppRoutes.tsx`)
- `AppContext.tsx` (`client/src/core/api/AppContext.tsx`; memoized provider value)
- `pluginRegistry.ts`
- `panelHandlers.ts`
- `panelRendering.tsx`
- `PanelFooter.tsx`
- `PanelTitles.tsx`
- `routeMap.ts`
- `useGlobalNavigationGuard.tsx`
- `pluginSingular.ts`
- `pluginContract.ts`
- `Sidebar.tsx`
- `MainLayout.tsx`

---

## Executive summary

The current architecture is **fundamentally good**.

It has a clear plugin mindset:

- a registry-based frontend plugin model
- provider + hook + component composition
- centralized route/page resolution
- centralized panel handling
- reusable layout/shell components
- support for capability plugins like mail
- support for dynamic conventions across plugins

This is **not** a bad or fragile-by-default system.

However, it is built around a **convention-driven plugin architecture** rather than a fully explicit contract-driven one.

That is acceptable for the current phase, but it creates a few predictable risks:

- central files can accumulate plugin-specific exceptions
- naming conventions become part of the runtime API
- dynamic `window.submitXForm` / `window.cancelXForm` patterns are easy to break
- some legacy special-cases still live in core
- `App.tsx` is still the main pressure point for future complexity

### Recommendation

Do **not** do a large refactor now.

Instead:

1. keep the architecture
2. avoid adding more special cases to core
3. document the naming contracts more explicitly
4. make a few small safe cleanups
5. reserve larger refactors until a real pain point appears

---

## What is working well

### 1. Registry-based plugin composition is solid

`pluginRegistry.ts` is a strong foundation.

Each plugin declares:

- `name`
- `Provider`
- `hook`
- `panelKey`
- `components`
- `navigation`
- optional dashboard widget
- optional display prefix

This gives the application a real plugin structure instead of scattered wiring.

### Why this is good

- plugin discovery on the frontend is explicit
- providers are composed consistently
- list/form/view registration is easy to reason about
- navigation is centralized

### Recommendation

Keep this pattern.

Do not replace the registry with ad hoc imports or App-level manual wiring.

---

### 2. Core layout separation is good

`MainLayout.tsx`, `Sidebar.tsx`, and route mapping are clean and well separated.

This part of the system does **not** look overgrown.

### Why this is good

- page shell and detail panel behavior are clearly separated
- mobile/desktop differences are handled in layout, not plugin code
- routeMap is simple and understandable

### Recommendation

Treat layout and route mapping as stable.
Only change them for real UX needs.

---

### 3. Navigation guard is focused and appropriate

`useGlobalNavigationGuard.tsx` is small, understandable, and does one thing well:

- track unsaved changes checkers
- intercept navigation
- present discard confirmation

### Why this is good

- low cognitive load
- reusable across plugins
- no obvious over-engineering

### Recommendation

Leave this largely as-is.

---

### 4. Plugin capability direction is promising

`pluginContract.ts` shows the beginning of a contract-based direction, even though much of the system still depends on naming conventions.

The duplicate flow is a good example of:

- optional plugin capability
- explicit contract
- central handling without hardcoding all implementation details

### Recommendation

Use this as the preferred future direction for new cross-plugin behaviors.

---

## Main architectural tradeoff

The system is currently **half convention-based, half contract-based**.

That is the most important observation in this review.

### Convention-based parts

Examples:

- `saveX`
- `openXForView`
- `openXForEdit`
- `closeXPanel`
- `currentX`
- `isXPanelOpen`
- `window.submitXForm`
- `window.cancelXForm`

These are inferred dynamically using:

- `pluginSingular.ts`
- `panelHandlers.ts`
- `panelRendering.tsx`

### Contract-based parts

Examples:

- duplicate contract in `pluginContract.ts`
- explicit registry structure
- some plugin-specific helper hooks and contexts

### Why this matters

This architecture works **only if naming discipline stays strong**.

That is okay right now, but it means:

- the system is flexible
- the system is fast to extend
- the system is more weakly typed than it looks
- mistakes often become runtime problems instead of compile-time problems

### Recommendation

Do not rewrite this now.
Instead, stop it from drifting further toward hidden conventions.

---

## File-by-file assessment

## 1. `plugin-loader.js`

### Assessment

Good overall for current phase.

It:

- supports plugin discovery from filesystem
- verifies required files
- supports legacy and new initialization signatures
- builds a plugin context
- registers routes cleanly

### Good decisions

- backward compatibility exists
- context-based plugin initialization is a good direction
- route registration is straightforward
- plugin metadata is preserved

### Mild concern

It supports both:

- legacy signature
- new context signature

That is practical now, but it also means there are two backend plugin styles alive at once.

### Recommendation

Do not remove legacy support now.

Small improvement worth considering:

- add a clear TODO or deprecation note with target milestone
- optionally log legacy usage only once per plugin to keep logs clean

### Do not do now

- do not rewrite plugin loading
- do not force all plugins to migrate immediately

---

## 2. `App.tsx`

### Assessment

This is the biggest pressure point in the system.

It is not “bad”, but it is where future complexity will accumulate fastest.

### What is good

A lot has already been moved out:

- panel handlers
- panel rendering
- panel titles
- panel footer
- layout
- route mapping
- global navigation guard

This means `App.tsx` is not a raw mess.
It is acting as an orchestrator.

### What is risky

There are still many plugin-specific exceptions in `App.tsx`, especially around:

- `primaryAction`
- settings/list special-cases
- close handler special-cases
- quick update logic
- cross-plugin dialogs

This makes `App.tsx` the easiest place for future “just one more exception” logic to leak into.

### Recommendation

Do not refactor this heavily now.

But from now on:

- no new plugin-specific exceptions in `App.tsx` unless absolutely necessary
- prefer plugin contracts or helper modules for new behaviors
- treat `App.tsx` as orchestration only

### Small safe improvement

Extract the long `primaryAction` branching into a dedicated helper, e.g.:

- `core/actions/resolvePrimaryAction.ts`

This is low risk if done carefully because it is mostly logic relocation, not behavior change.

### Priority

Medium value, low-to-medium risk, optional now.

---

## 3. `AppContext.tsx`

### Assessment

Large, but still legitimate.

It currently holds:

- auth state
- global shared data
- panel coordination
- some cross-plugin navigation
- settings access
- data refresh

This is broad, but not clearly wrong yet.

### Good decisions

- auth is centralized
- panel coordination is centralized
- shared references are exposed through functions rather than random imports
- settings update path is reasonably contained

### Main concern

This file is close to becoming the default “put shared behavior here” bucket.

That is the main risk—not current correctness.

### Recommendation

Do not refactor `AppContext.tsx` now.

Hard rule going forward:
Only put something here if it is truly:

- global
- cross-plugin
- not better owned by a plugin or helper module

### Small safe improvement

Add a short developer comment section near exported context value saying:

- what belongs here
- what does not belong here

This is mostly a guardrail, not a code change.

### Do not do now

- do not split AppContext into many smaller contexts unless an actual maintenance problem appears
- do not move auth unless there is a strong reason

---

## 4. `pluginRegistry.ts`

### Assessment

Strong foundation.

### Good decisions

- explicit plugin registration
- clear plugin metadata
- consistent provider/hook/component structure
- good place to extend later

### Recommendation

Keep this as the main frontend plugin contract entrypoint.

### Small safe improvement

Consider exporting small helper types or comments that document expected naming conventions for:

- `panelKey`
- provider responsibilities
- list/form/view assumptions

This is a documentation improvement, not a structural one.

---

## 5. `panelHandlers.ts`

### Assessment

Useful and clever, but one of the more fragile files.

It depends heavily on:

- inferred function names
- singular/plural naming
- `window.submitXForm`
- `window.cancelXForm`

### Why this is fragile

If a plugin deviates slightly from conventions, runtime behavior breaks quietly.

### Recommendation

Do not replace this now.

But do two things:

#### A. Document the runtime naming contract clearly

The system depends on names like:

- `saveX`
- `openXForEdit`
- `openXForView`
- `closeXPanel`
- `submitXForm`
- `cancelXForm`

This should be written down in one place for plugin authors.

#### B. Add safer debug warnings

Where practical, warn more clearly when expected functions are missing.
Warnings already exist in some places; keep and improve that pattern.

### Small safe improvement

Create a small utility with named constant patterns or helper comments, instead of duplicating naming assumptions across files.

No large behavioral rewrite needed now.

---

## 6. `panelRendering.tsx`

### Assessment

This file is simple and useful, but weakly typed.

It dynamically creates:

- view props
- form props

based on plugin names.

### Good

- reduces repeated boilerplate
- keeps panel rendering centralized

### Risk

- plugin prop assumptions are not enforced strongly
- runtime mismatch is possible

### Recommendation

Leave architecture as-is.

### Small safe improvement

Add lightweight runtime guards:

- if `ViewComponent` or `FormComponent` is missing when expected, log a clear warning
- avoid silent rendering failure

### Optional future direction

Long-term, move toward an explicit plugin render contract.
Do not do that now.

---

## 7. `PanelFooter.tsx`

### Assessment

Fine overall.

This file is focused and small.

### Observation

It still contains a few plugin-specific assumptions around settings behavior and close handler wrapping.

### Recommendation

No urgent changes.

### Small safe improvement

Add a short comment that the footer intentionally supports:

- settings-only footer mode
- no-footer mode for create/edit/view where forms handle actions inline

This is mostly to reduce future confusion.

---

## 8. `PanelTitles.tsx`

### Assessment

This is the clearest legacy hotspot.

It still contains:

- hardcoded handling for `import`
- a partially centralized title/subtitle system
- a mixed model between plugin-driven and core-driven title behavior

### Why this matters

This file shows where old core special-cases linger.

### Recommendation

Do not refactor heavily now.

### Small safe improvement

Remove or isolate legacy `import` logic if that plugin is gone or obsolete.

If `import` is still active, at minimum mark it as legacy more clearly.

This is one of the easiest files to clean safely later.

### Important note

If building new plugins like `ingest`, do **not** repeat the old `import` pattern here.

---

## 9. `routeMap.ts`

### Assessment

Good.
Clear and low-risk.

### Recommendation

Keep as-is.

Only update when real routes change.

---

## 10. `useGlobalNavigationGuard.tsx`

### Assessment

Good and appropriately small.

### Recommendation

Keep as-is.

### Small safe improvement

If desired, make the warning message configurable in the future.
Not needed now.

---

## 11. `pluginSingular.ts`

### Assessment

Simple and important.

This is core infrastructure for the naming-convention architecture.

### Risk

If plugin names get more varied, singularization rules may become a subtle source of bugs.

### Recommendation

Keep it.

### Small safe improvement

Add a short comment in plugin author docs:

- plugin names should be chosen with this singularization system in mind

Do not over-engineer pluralization logic now.

---

## 12. `pluginContract.ts`

### Assessment

Very good direction.

### Recommendation

Use this pattern for future optional plugin capabilities.

Examples of future explicit contracts that may be better than convention-only behavior:

- quick actions
- primary action override
- settings view handling
- view title/subtitle contract
- duplicate behavior
- panel close handling

Do not force a full migration now.
Just prefer contracts for new capability patterns.

---

## 13. `Sidebar.tsx`

### Assessment

Good.
Well structured and easy to understand.

### Recommendation

Keep as-is.

No refactor needed.

---

## 14. `MainLayout.tsx`

### Assessment

Good.
Clean separation of layout responsibilities.

### Recommendation

Keep as-is.

No meaningful architectural concerns here.

---

## Prioritized recommendations

## Priority 1: Do not add more special cases to `App.tsx`

This is the highest-value rule.

### Action

When adding new plugin behavior:

- prefer plugin contracts
- prefer helper modules
- prefer plugin-owned logic
- avoid direct new `if (plugin.name === ...)` branches in `App.tsx`

### Reason

This file is currently under control, but it is the easiest place for future complexity to pile up.

---

## Priority 2: Write down the naming conventions explicitly

This is cheap and high value.

### Action

Create a short internal doc that explains the runtime naming contract for plugin contexts and forms.

It should include:

- `isXPanelOpen`
- `currentX`
- `saveX`
- `deleteX`
- `closeXPanel`
- `openXForView`
- `openXForEdit`
- `submitXForm`
- `cancelXForm`

### Reason

Much of the architecture depends on this.
Right now, the conventions are discoverable in code but not explicit enough.

---

## Priority 3: Isolate legacy `import` behavior

Low risk, worthwhile cleanup later.

### Action

Review `PanelTitles.tsx` and any other remaining central legacy logic for `import`.

If safe:

- isolate it
- label it clearly
- or remove it if unused

### Reason

New plugins should not copy that pattern.

---

## Priority 4: Prefer explicit contracts for new capabilities

This is the right evolution path.

### Action

When introducing new optional cross-plugin features, add contract types similar to `DuplicateContract` instead of inventing more implicit naming-based core behavior.

### Reason

This gradually reduces hidden coupling without large refactors.

---

## Suggested low-risk changes

These are safe enough to consider now.

### Change 1

Create a short developer document:

- `docs/PLUGIN_RUNTIME_CONVENTIONS.md`

Include:

- naming conventions used by core
- required context function names
- form submit/cancel window hooks
- singular/plural naming expectations

**Risk:** very low  
**Value:** high

---

### Change 2

Extract `primaryAction` logic from `App.tsx` into a helper module.

Possible file:

- `client/src/core/actions/resolvePrimaryAction.ts`

Keep behavior identical.
This is a move-only refactor.

**Risk:** low if unchanged behavior  
**Value:** medium-high

---

### Change 3

Add clearer warnings in dynamic handler/render paths.

Examples:

- missing open/edit/save function
- missing form submit/cancel registration
- missing component in registry where expected

**Risk:** low  
**Value:** medium

---

### Change 4

Mark `import` handling in `PanelTitles.tsx` as legacy and do not extend it.

If safe, isolate it behind a helper or comment block.

**Risk:** low  
**Value:** medium

---

## Changes not recommended right now

Do **not** do these unless a real problem appears.

### 1. Do not rewrite the plugin system into strict typed contracts everywhere

That is too much churn for current value.

### 2. Do not split `AppContext.tsx` aggressively

It is large, but not yet clearly harmful.

### 3. Do not remove legacy backend plugin support yet

That should be a deliberate migration later.

### 4. Do not replace naming conventions with a new abstraction layer immediately

The current system works.
Just stop making it more implicit.

### 5. Do not move lots of logic into core for convenience

Especially not new plugin-specific behavior.

---

## Guidance for future work

When building new plugins or capabilities, follow these rules:

### Rule 1

If behavior is plugin-specific, keep it in the plugin.

### Rule 2

If behavior is cross-plugin but optional, prefer an explicit plugin contract.

### Rule 3

If behavior is only needed by one plugin right now, do not centralize it early.

### Rule 4

Do not add more naming magic unless it clearly reduces complexity.

### Rule 5

Do not add more plugin exceptions to `App.tsx` unless there is no reasonable alternative.

---

## Final conclusion

The system is in a **good enough state to keep building on**.

There are no major red flags in the reviewed files.

The architecture is:

- coherent
- intentional
- plugin-oriented
- reasonably extensible

The main risk is not current breakage.
The main risk is **gradual complexity accumulation in core orchestration files**, especially `App.tsx`, plus overreliance on undocumented naming conventions.

### Final recommendation

Proceed without large refactors.

Do only these kinds of changes now:

- documentation of conventions
- small helper extractions
- light legacy cleanup
- better warnings

That gives the best balance between:

- stability
- development speed
- future maintainability
