# Mentions and Cross-Plugin UI

**Last Updated:** July 2026

This document describes the core @-mention system, cross-plugin navigation patterns, and how plugins link to each other without tight coupling.

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

| Prop          | Type                                           | Description                         |
| ------------- | ---------------------------------------------- | ----------------------------------- |
| `value`       | `string`                                       | Current text value                  |
| `onChange`    | `(value: string, mentions: Mention[]) => void` | Called when text or mentions change |
| `placeholder` | `string` (optional)                            | Placeholder text                    |
| `rows`        | `number` (optional)                            | Textarea rows (default 12)          |
| `className`   | `string` (optional)                            | Additional CSS classes              |

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

| Prop             | Type                                     | Description                                                                           |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `content`        | `string`                                 | Full text content                                                                     |
| `mentions`       | `Mention[]`                              | Array of mentions (position, length, contactId, contactName)                          |
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

AppContext provides getters so **ContactView** can show related entities without each view calling plugin APIs directly:

| Getter                           | Data source                                 | Notes                                                      |
| -------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `getNotesForContact`             | API fetch                                   | —                                                          |
| `getTasksForContact`             | `AppContext` tasks (from `syncSharedTasks`) | Assigned via `assignedToIds` (fallback `assignedTo`)       |
| `getTasksWithMentionsForContact` | `AppContext` tasks                          | Mention-based                                              |
| `getSlotsForContact`             | `AppContext` slots (from `syncSharedSlots`) | `filterSlotsForContact` — primary `contact_id` or mentions |

`ContactView` main column order: **Contact content** → **Properties** → **Addresses** → **Contact persons**, then related plugin cards in **sidebar nav order** (category then `navigation.order`): Notes → Tasks → Teams → Matches → Slots → Estimates. Cards render when the plugin is enabled and there is at least one related row:

| Card      | Plugin gate | Data source                                                                                       | Open                                                                                                                                                        |
| --------- | ----------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notes     | `notes`     | `getNotesForContact`                                                                              | Name → `AssignmentQuickInfoDialog`; Open → `navigate('/notes/…')` after `closeContactPanel()` (provider also hardens `openNoteForView` cross-route)         |
| Tasks     | `tasks`     | `getTasksForContact` (`assignedToIds`, fallback `assignedTo`)                                     | `navigate('/tasks/…')` after `closeContactPanel()`                                                                                                          |
| Teams     | `teams`     | `listTeamAssignmentsForContact(teams, contactId)` over `responsibles` (role + series-team badges) | `navigate('/teams/…')` after `closeContactPanel()`                                                                                                          |
| Matches   | `matches`   | `getMatchesForContact`                                                                            | `openMatchForView` after `closeContactPanel()`                                                                                                              |
| Slots     | `slots`     | `getSlotsForContact`                                                                              | `navigate('/slots/…')` after `closeContactPanel()`                                                                                                          |
| Estimates | `estimates` | `getEstimatesForContact`                                                                          | Name → `AssignmentQuickInfoDialog`; Open → `navigate('/estimates/…')` after `closeContactPanel()` (provider also hardens `openEstimateForView` cross-route) |

Name click on assignment rows (teams/tasks/slots/notes/estimates) opens `AssignmentQuickInfoDialog` (preview + Open).

**Private contacts (PII):** For `contactType === 'private'`, ContactView/Form show **personal number** (not organization number); F-tax is hidden; tax rate is forced to `0` on save via `applyContactTypeFieldRules`. Personal number is tenant-visible PII by design.

**Notes `NoteView`:** mentioned contacts render under note content (and attachments), not in the sidebar. Name / `@`-mention opens shared `ContactQuickInfoDialog` (copy email/phone + Open contact → `navigate('/contacts/…')`). TeamView’s `ResponsibleContactDialog` wraps the same dialog.

`SlotsProvider` syncs its list via `syncSharedSlots` whenever `slots` changes. **MatchView** reads related slots from `useSlotsContext().slots` filtered by `match_id` (no separate `GET /api/slots`).

To avoid type mismatches (e.g. numeric vs string IDs from the API), comparisons use string normalization:

- `String(mention.contactId) === String(contactId)`

This is applied in the AppContext implementations of these getters so that cross-plugin lists remain correct regardless of ID representation.

## Entity quick-info popup (required pattern)

When the user clicks a **linked entity** from another context (contact, team, task, slot, match, request, schedule slot, etc.), do **not** navigate straight into that entity’s detail panel.

Instead: open a **quick-info popup** first. The user confirms with an explicit Open action (or closes without leaving the current view).

This is the standard for new and updated cross-links. Follow it in all future UI work.

### Why

- Avoids accidental context switches from dense lists and related cards.
- Lets the user skim key fields (and copy contact details when relevant) before committing to navigation.
- Keeps list/detail chrome stable until the user chooses Open.

### Interaction contract

| Step         | Behaviour                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| 1. Trigger   | Click on the entity **name** / title / `@`-mention (not the inline status/priority controls).              |
| 2. Popup     | Centred `AlertDialog` with title, optional badges, short detail rows.                                      |
| 3. Secondary | **Close** — `t('common.close')` (not Cancel). Dismisses without navigation.                                |
| 4. Primary   | **Open …** — closes the dialog, then navigates / opens the target (see Cross-plugin URL navigation below). |

Optional: a separate row action (e.g. “Open team”) may still navigate immediately; name click still opens quick-info.

### Implementation checklist

1. Prefer an existing `*QuickInfoDialog` for that entity type; only add a new one if none fits.
2. Use `AlertDialog` + primary `ExternalLink` Open button (same layout as `MatchQuickInfoDialog`).
3. Keep preview fields short (identity + a few meta rows). No full edit forms inside the popup.
4. For contacts: use shared [`ContactQuickInfoDialog`](../client/src/plugins/contacts/components/ContactQuickInfoDialog.tsx) (mailto/tel + copy + Open contact). Wrappers (e.g. `ResponsibleContactDialog`) may add badges only.
5. After Open: close the current panel when leaving the plugin, then `navigate('/plugin/…')` (or the provider’s cross-plugin open helper). Do not rely on `openXForView` alone across routes.
6. External website links in contact fields: `target="_blank"` + `rel="noopener noreferrer"`.

### Existing dialogs (reuse these)

| Dialog                      | Entity                     | Used from (examples)                                       |
| --------------------------- | -------------------------- | ---------------------------------------------------------- |
| `ContactQuickInfoDialog`    | Contact                    | `NoteView` mentions, `ResponsibleContactDialog` (TeamView) |
| `AssignmentQuickInfoDialog` | Team / task / slot preview | `ContactView` related cards                                |
| `MatchQuickInfoDialog`      | Match                      | `TeamMatchesSection`                                       |
| `RequestQuickInfoDialog`    | Request                    | `TeamRequestsSection` (Teams plugin)                       |
| `ScheduleSlotDetailDialog`  | Schedule slot              | Schedule grid / list slot click                            |

### Anti-patterns

- Clicking a related name jumps straight to another plugin’s detail view.
- Using **Cancel** as the dismiss label on quick-info (use **Close**).
- Duplicating a full contact quick-info UI instead of wrapping `ContactQuickInfoDialog`.
- Putting destructive or save actions in the quick-info footer (Open + Close only).

## Cross-plugin URL navigation

When opening an item in **another** plugin (e.g. Teams → match, match badge → team, Schedule → team), do **not** rely on `openXForView` alone if the user is on a different route.

### Why `useItemUrl` is not enough

[`useItemUrl`](../client/src/core/hooks/useItemUrl.ts) only updates the URL when already on that plugin's base path:

```ts
if (window.location.pathname.startsWith(basePath)) {
  navigate(`${basePath}/${slug}`);
}
```

Calling `openTeamForView(team)` from `/matches/...` sets panel state but leaves the URL on `/matches`. `AppContent` then closes the team panel (URL mismatch) and the user sees the matches list.

### Correct pattern

Navigate to the target plugin URL; URL-sync in `AppContent` opens the panel:

```ts
import { useNavigate } from 'react-router-dom';
import { buildSlug } from '@/core/utils/slugUtils';

navigate(`/teams/${buildSlug(team, teams, 'name')}`);
```

For matches, slug field is typically `` `${home_team}-vs-${away_team}` `` (see `matchSlugNameField` in `MatchProvider`).

**Provider helpers** may wrap this: e.g. `openMatchForView` / `openNoteForView` / `openEstimateForView` check `pathname.startsWith('/plugin')` and navigate cross-plugin when false.

### Examples in codebase

| From                                       | To           | Implementation                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContactView` Notes card                   | Note         | Name → `AssignmentQuickInfoDialog`; Open → `navigate('/notes/…')` after `closeContactPanel()`                                                                                                                                                                                                                                 |
| `ContactView` Estimates card               | Estimate     | Same pattern → `navigate('/estimates/…')`                                                                                                                                                                                                                                                                                     |
| `ContactView` Teams card                   | Team         | Name → `AssignmentQuickInfoDialog`; Open / dialog CTA → `navigate('/teams/…')` after `closeContactPanel()`                                                                                                                                                                                                                    |
| `ContactView` Tasks card                   | Task         | Same pattern → `navigate('/tasks/…')`                                                                                                                                                                                                                                                                                         |
| `ContactView` Slots card                   | Slot         | Same pattern → `navigate('/slots/…')`                                                                                                                                                                                                                                                                                         |
| `NoteView` mentioned contact / `@` mention | Contact      | `ContactQuickInfoDialog`; Open → `navigate('/contacts/…')` after `closeNotePanel()`                                                                                                                                                                                                                                           |
| `ResponsibleContactDialog` (TeamView)      | Contact      | Wraps `ContactQuickInfoDialog` → `navigate('/contacts/…')`                                                                                                                                                                                                                                                                    |
| `TeamMatchesSection`                       | Match        | Name → `MatchQuickInfoDialog`; Open → `openMatchForView` (cross-plugin navigate). Tab UI: home/away groups vs upcoming-by-date chips; side classification uses Matches settings `defaultHomeTeam` (prefix + space; see product changelog 2026-08-10).                                                                         |
| `TeamMatchStatsSection`                    | Match        | Team detail tab `statistics` (after Matches). Loads `GET /api/matches/by-team/:id`, aggregates with `computeMatchStats` + `MatchSideSplitSection`. Requires `defaultHomeTeam`.                                                                                                                                                |
| `SeriesTeamsSection`                       | Contact      | Series-team rows show responsible contact name badges (from `useContacts`); whole-team assignees (`seriesTeam` empty) appear on every row with `seriesTeamAll` label. Read-only display (no quick-info/open in this section). Teams **list** reuses the same badge helpers via `TeamSeriesTeamBadges` (table column + cards). |
| `MatchesStatisticsView`                    | Match        | In-plugin statistics content view (`matchesContentView === 'statistics'`). Club + per-team W/D/L (year × home/away) via client `matchStats.ts`. Requires non-empty Matches settings `defaultHomeTeam` for any result aggregates (fail-closed). Per-team rows need `team_id`; side rule same prefix as Teams matches tab.      |
| `TeamRequestsSection`                      | Request      | Name → `RequestQuickInfoDialog`; Open → `openRequestForView`. **Overview** (`compact`): only open statuses (`not started` / `in progress`) via `isOpenRequestStatus` — completed/cancelled hidden. **Requests tab** (non-compact): all statuses. UX filter only (not authorization).                                          |
| `RequestView` team field                   | Team         | Name → `AssignmentQuickInfoDialog`; Open → `navigate('/teams/…')` after `closeRequestPanel()`                                                                                                                                                                                                                                 |
| `MatchTeamBadge`                           | Team         | `navigate('/teams/…')`                                                                                                                                                                                                                                                                                                        |
| Schedule slot click                        | Slot detail  | `ScheduleSlotDetailDialog` (preview; navigate to team / edit from dialog)                                                                                                                                                                                                                                                     |
| `ScheduleList` “go to team” from slot UI   | Team         | Requires `teamId` → `navigate('/teams/…')`                                                                                                                                                                                                                                                                                    |
| `PlanView` slot click                      | Team or edit | With `teamId` → `/teams/…`; without (plan event) → open edit dialog if unlocked                                                                                                                                                                                                                                               |
| Schedule grid pencil / copy icons          | Schedule     | In-plugin only: edit or copy dialog (`mode: 'edit' \| 'copy'`); no cross-plugin navigate                                                                                                                                                                                                                                      |

Use `attemptNavigation()` from `useGlobalNavigationGuard` when unsaved changes may be open.

## See also

- [CORE_ARCHITECTURE_V2.md](CORE_ARCHITECTURE_V2.md) – AppContext and cross-plugin data
- [PLUGIN_DEVELOPMENT_STANDARDS_V2.md](PLUGIN_DEVELOPMENT_STANDARDS_V2.md) – Plugin conventions (incl. mentions guidance)
- [UI_AND_UX_STANDARDS_V3.md](UI_AND_UX_STANDARDS_V3.md) – List/toolbar and detail chrome
- This doc § **Entity quick-info popup** – required pattern before navigating to a linked entity
