# Plugin Architecture V3: The Action Registry

**Last Updated:** February 2026

The V3 architecture introduces the **Action Registry** pattern to solve the problem of circular dependencies between plugins (e.g., Notes needing Tasks, and Tasks needing Notes).

## The Problem

In V2, plugins often imported each other's contexts directly:

```ts
// ❌ Circular Dependency Risk
import { useTasks } from '@/plugins/tasks/context/TaskContext';
```

If `TaskContext` also imported `NoteContext`, the app would crash or behave unpredictably due to initialization order issues.

## The Solution: Action Registry (`ActionContext`)

The `ActionContext` acts as a neutral "marketplace" in the Core layer.

1.  **Core:** Provides the registry methods (`registerAction`, `getActions`).
2.  **Providers:** Plugins register their capabilities when they mount.
3.  **Consumers:** Plugins ask for capabilities by ID, without knowing _who_ provides them.

### 1. Registering an Action (Provider)

In `TaskContext.tsx`:

```tsx
const { registerAction, unregisterAction } = usePluginActions();

useEffect(() => {
  // "I can create a task from a note"
  registerAction({
    id: 'create-task-from-note',
    pluginName: 'task',
    label: 'Create Task',
    icon: CheckSquare,
    variant: 'secondary',
    order: 10,
    onClick: (note) => {
      // Logic to open task panel with note data
    },
  });

  return () => unregisterAction('create-task-from-note');
}, [registerAction, unregisterAction]);
```

### 2. Consuming Actions (Consumer)

In `NoteContext.tsx`:

```tsx
const pluginActions = usePluginActions('note'); // Get actions relevant to 'note' entities

// Render them dynamically
{
  pluginActions.map((action) => (
    <Button onClick={() => action.onClick(currentNote)}>{action.label}</Button>
  ));
}
```

## Benefits

1.  **Decoupling:** `NoteContext` no longer needs to import `TaskContext`. It just imports `ActionContext` (Core).
2.  **Resilience:** If the Tasks plugin is disabled or fails to load, the "Create Task" button simply doesn't appear in Notes. No crashes.
3.  **Extensibility:** A new "Project" plugin can add "Create Project from Note" without touching the Notes plugin code.

## Plugin independence (optional plugins per user)

Different users can have different plugin sets (e.g. only contacts, or contacts + notes). Core and cross-plugin views must not crash when a plugin is missing.

### Capability gating

- **AppContext** exposes data and navigation only for active plugins: `loadData()` fetches from the API only for plugins in `user.plugins`; otherwise it uses empty arrays. The getters `getNotesForContact`, `getTasksForContact`, `getTasksWithMentionsForContact`, and `getEstimatesForContact` return empty arrays when the corresponding plugin is not enabled (no direct API calls for disabled plugins).
- **Cross-plugin views** (e.g. ContactView) must not import other plugins directly (no `useNotes`, `useTasks`, `useEstimates`). They use only `useApp()` and check for both data and the relevant capability (`openNoteForView`, `openTaskForView`, `openEstimateForView`) before rendering sections like "Note mentions" or "Task mentions".

### Navigation registration

Plugins (notes, tasks, estimates) register their "open for view" function with AppContext when they mount, via `registerNotesNavigation`, `registerTasksNavigation`, and `registerEstimatesNavigation`. Use a **stable callback** (e.g. a ref bridge: store the real handler in a ref, register a wrapper that calls `ref.current`) so that registration does not trigger setState in AppContext during render. That avoids React warnings ("Cannot update a component while rendering another") and unnecessary re-renders.

### Settings plugin (always-on)

- **Settings** is implemented as a normal plugin (`plugins/settings` on the server, `client/src/plugins/settings` on the client) but is **always active**: it is not gated by `user_plugin_access`. The backend injects `settings` into `user.plugins` in auth responses (login, signup, GET /me); the frontend treats Settings as enabled in nav and search even if missing from `user.plugins`.
- **API:** User settings and activity log are served by the settings plugin at `/api/settings` (GET/PUT all or per category) and `/api/settings/activity-log` (GET with query params). Core no longer mounts separate settings or activity-log routes.
- **Panel flow:** Settings uses the same plugin panel flow as other plugins (List = category list, Form = Profile/Preferences/ActivityLog wrapper). There is no `currentPage === 'settings'` special case in App.

### Other behaviour

- **ActivityLogForm:** Restore for notes is only offered when `user?.plugins?.includes('notes')`; otherwise the user sees a message that the notes plugin is required.
- **Server:** All plugin routes that should be gated (including OAuth callbacks such as the files plugin cloud callback) use `requirePlugin` so that users without access to that plugin receive 403. The settings plugin uses `requireAuth` only (no plugin-access check).

## Best Practices

- **Unregister:** Always return a cleanup function to unregister actions.
- **Stable References:** Use `useCallback` for `onClick` handlers to prevent re-registration loops.
- **Unique IDs:** Use descriptive IDs like `create-entity-from-source`.
