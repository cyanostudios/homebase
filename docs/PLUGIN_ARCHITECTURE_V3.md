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
3.  **Consumers:** Plugins ask for capabilities by ID, without knowing *who* provides them.

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
    }
  });

  return () => unregisterAction('create-task-from-note');
}, [registerAction, unregisterAction]);
```

### 2. Consuming Actions (Consumer)

In `NoteContext.tsx`:
```tsx
const pluginActions = usePluginActions('note'); // Get actions relevant to 'note' entities

// Render them dynamically
{pluginActions.map(action => (
  <Button onClick={() => action.onClick(currentNote)}>
    {action.label}
  </Button>
))}
```

## Benefits

1.  **Decoupling:** `NoteContext` no longer needs to import `TaskContext`. It just imports `ActionContext` (Core).
2.  **Resilience:** If the Tasks plugin is disabled or fails to load, the "Create Task" button simply doesn't appear in Notes. No crashes.
3.  **Extensibility:** A new "Project" plugin can add "Create Project from Note" without touching the Notes plugin code.

## Best Practices

-   **Unregister:** Always return a cleanup function to unregister actions.
-   **Stable References:** Use `useCallback` for `onClick` handlers to prevent re-registration loops.
-   **Unique IDs:** Use descriptive IDs like `create-entity-from-source`.
