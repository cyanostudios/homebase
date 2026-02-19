# Mentions and Cross-Plugin UI

**Last Updated:** February 2026

This document describes the core @-mention system and how plugins use it for rich text that references contacts. All mention logic lives in core; plugins consume core components and provide callbacks for navigation.

## Mention type

The shared type is defined in [client/src/core/types/mention.ts](client/src/core/types/mention.ts):

```ts
export interface Mention {
  contactId: string;
  contactName: string;
  position: number;
  length: number;
  companyName?: string;
}
```

Plugins store this shape (e.g. `note.mentions`, `task.mentions`) and pass it to core components.

## Core components

### MentionTextarea

**Location:** [client/src/core/ui/MentionTextarea.tsx](client/src/core/ui/MentionTextarea.tsx)

Used in forms where the user can @-mention contacts (e.g. note body, task description).

**Props:**

| Prop         | Type                                    | Description                          |
| ------------ | --------------------------------------- | ------------------------------------ |
| `value`      | `string`                                | Current text value                   |
| `onChange`   | `(value: string, mentions: Mention[]) => void` | Called when text or mentions change  |
| `placeholder`| `string` (optional)                      | Placeholder text                      |
| `rows`       | `number` (optional)                     | Textarea rows (default 12)            |
| `className`  | `string` (optional)                      | Additional CSS classes                |

**Behaviour:**

- Fetches `/api/contacts` on mount for the suggestion list.
- Typing `@` opens a dropdown of contacts; filtering by name (and company) is supported.
- Enter or Tab inserts the selected mention; Arrow Up/Down and Escape work as expected.
- `onChange` receives the updated text and the extracted `Mention[]` (position/length/contactId/contactName). The plugin should persist both.

Plugins use this component without importing any other plugin; they only need core and the contacts API.

### MentionContent

**Location:** [client/src/core/ui/MentionContent.tsx](client/src/core/ui/MentionContent.tsx)

Used in view/detail panels to render text with mentions as clickable or grayed-out segments.

**Props:**

| Prop             | Type                              | Description                                                                 |
| ---------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `content`        | `string`                          | Full text content                                                           |
| `mentions`       | `Mention[]`                       | Array of mentions (position, length, contactId, contactName)                |
| `onMentionClick` | `(contactId: string) => void` (optional) | Called when the user clicks an active (existing) mention. Omit to show non-clickable. |

**Behaviour:**

- Fetches `/api/contacts` to determine which mentions still exist.
- Segments the content into text and mention spans. Active mentions are styled (e.g. blue, clickable); deleted contacts are shown grayed (e.g. “(deleted contact)”).
- If `onMentionClick` is provided and the user clicks an active mention, the callback is invoked with `contactId`. The plugin is responsible for closing its own panel and opening the contact (e.g. via `closeNotePanel()` and `openContactForView(contact)`).

## Plugin usage

- **NoteForm / TaskForm:** Import `MentionTextarea` from `@/core/ui/MentionTextarea`. Use `value`, `onChange(value, mentions)`, and optional `placeholder` / `rows` / `className`. Store `mentions` with the entity (note/task).
- **NoteView / TaskView:** Import `MentionContent` from `@/core/ui/MentionContent`. Pass `content`, `mentions` (e.g. `note.mentions` or `task.mentions`), and `onMentionClick`. The callback should refresh data if needed, fetch the contact, close the current panel, and open the contact view (e.g. using `useContacts().openContactForView`).

No plugin should implement its own mention input or rendering logic; use these core components only.

## Cross-plugin matching (AppContext)

AppContext provides `getNotesForContact(contactId)` and `getTasksWithMentionsForContact(contactId)` so that ContactView can show “Note mentions” and “Task mentions” for a contact. To avoid type mismatches (e.g. numeric vs string IDs from the API), comparisons use string normalization:

- `String(mention.contactId) === String(contactId)`

This is applied in the AppContext implementations of these getters so that cross-plugin lists remain correct regardless of ID representation.

## See also

- [CORE_ARCHITECTURE_V2.md](CORE_ARCHITECTURE_V2.md) – AppContext and cross-plugin data
- [FRONTEND_PLUGIN_GUIDE_V2.md](FRONTEND_PLUGIN_GUIDE_V2.md) – Using core mention components in a plugin
