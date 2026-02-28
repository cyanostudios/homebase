# Plan: Knappar och ikoner – konsekvent shadcn/Radix-mönster

**Syfte:** Göra knappar konsekventa och följa shadcn/Radix best practice (ikon som children, inte prop).

**Status:** Plan genomgången – alla filer, BulkActionBar, template, ContentHeader, MainLayout inkluderade.

---

## 1. Nuläge (full inventering)

### Button-komponent
- **Fil:** `client/src/components/ui/button.tsx`
- Har `icon?: LucideIcon` – avvikelse från vanlig shadcn-Button
- `gap-2` mellan children – fungerar för ikon + text

### BulkActionBar – REDAN KORREKT
- **Fil:** `client/src/core/ui/BulkActionBar.tsx`
- Använder **inte** `icon`-prop på Button
- Rendera redan: `{Icon && <Icon className="w-4 h-4" />}{action.label}` som children
- **Ingen ändring behövs**

### ContentHeader
- **Fil:** `client/src/core/ui/ContentHeader.tsx`
- Två ikon-props: `icon` (titel) och `actionIcon` (knapp)
- `icon` renderas direkt: `<Icon className="..." />` – inte Button, ingen ändring
- `actionIcon` skickas till Button: `icon={ActionIcon}` – **måste ändras** till children

### MainLayout
- **Fil:** `client/src/core/ui/MainLayout.tsx`
- Skickar `contentIcon` och `contentActionIcon` till ContentHeader
- ContentHeader använder dem – endast action-knappen (via ContentHeader) påverkas

### Template (plugin-frontend-template)
- **Filer:** `templates/plugin-frontend-template/components/YourItemList.tsx`, `YourItemForm.tsx`
- **Import:** `@/core/ui/Button` – kan vara fel path (Button finns i `@/components/ui/button`)
- **YourItemList.tsx:** 4 st `icon=` på Button (rad 102, 166, 171, 202)
- **YourItemForm.tsx:** Inga icon (knappar utan ikon)
- **Åtgärd:** Migrera icon + verifiera/korrigera import-path

### homebase-V3.X
- Parallel mapp med egen `client/src` – många `icon=` på Button
- Om den används i build: samma migrering gäller
- Om legacy/ej använd: utelämna

---

## 2. Fullständig fillista – client/src (alla icon= på Button)

| # | Fil | icon= | Beskrivning |
|---|-----|-------|-------------|
| 1 | core/ui/PanelFooter.tsx | 12 | Footer: X, Check, Trash2, Copy, Icon (dynamisk), Download, Edit |
| 2 | core/ui/SettingsFooter.tsx | 3 | X, Check |
| 3 | core/ui/ContentHeader.tsx | 1 | actionIcon till Button – ändra till children |
| 4 | core/ui/ImportWizard.tsx | 2 | ChevronRight, CheckCircle2 (undefined vid loading) |
| 5 | core/ui/LoginComponent.tsx | 1 | LogIn / UserPlus |
| 6 | core/ui/clock/ClockDisplay.tsx | 3 | Settings, X |
| 7 | plugins/contacts/ContactList.tsx | 9 | FolderPlus, Grid3x3, ListIcon, Upload, Plus, Pencil, Trash2 |
| 8 | plugins/contacts/ContactForm.tsx | 4 | Plus, Trash2 |
| 9 | plugins/files/FileList.tsx | 15 | Grid3x3, List, FolderPlus, ListPlus, Move, Trash2, Settings, Cloud, Plus, Pencil |
| 10 | plugins/notes/NoteList.tsx | 3 | Grid3x3, ListIcon, Upload |
| 11 | plugins/notes/NoteView.tsx | 2 | Download, CheckSquare |
| 12 | plugins/tasks/TaskList.tsx | 3 | Grid3x3, ListIcon, Upload |
| 13 | plugins/estimates/EstimateList.tsx | 2 | Grid3x3, ListIcon |
| 14 | plugins/estimates/EstimateForm.tsx | 3 | Plus, Copy, Trash2 |
| 15 | plugins/estimates/EstimateActions.tsx | 4 | Share, Download, CopyIcon, Check |
| 16 | plugins/invoices/InvoicesForm.tsx | 3 | Plus, Copy, Trash2 |
| 17 | plugins/invoices/InvoiceActions.tsx | 3 | Share, Download, Check/Copy |
| 18 | plugins/orders/OrdersList.tsx | 5 | Download, Trash2, RefreshCw |
| 19 | plugins/inspection/InspectionList.tsx | 1 | Plus |
| 20 | plugins/inspection/SendModal.tsx | 1 | UserPlus |
| 21 | plugins/mail/MailSettingsForm.tsx | 1 | Send |
| 22 | plugins/channels/ChannelsList.tsx | 1 | Download |
| 23 | core/widgets/pomodoro/PomodoroTimer.tsx | 16 | Play, Pause, Settings, X, RotateCcw, SkipForward |
| 24 | core/widgets/time-tracking/TimeTrackingWidget.tsx | 8 | Play, Square, RotateCcw, Settings, X |

**Total:** ~100 icon= på Button i client/src

---

## 3. Steg för genomförande

### Steg 1: ContentHeader
- Ändra action-knappen från `icon={ActionIcon}` till:
  ```tsx
  {actionIcon && <ActionIcon className="h-4 w-4" />}
  {actionLabel}
  ```

### Steg 2: Migrera alla Button med icon till children
- Mönster: `icon={X}` → `<X className="h-4 w-4" />` före children
- Särfall ImportWizard: `icon={isImporting ? undefined : CheckCircle2}` → villkorlig ikon som child

### Steg 3: PanelFooter – detailFooterActions
- Redan korrekt mönster i koden – använd `icon={Icon}`. Efter Button-migrering måste PanelFooter ändras till:
  ```tsx
  <Button ...>
    <Icon className="h-4 w-4" />
    {action.label}
  </Button>
  ```
- Export-knappar: samma mönster med Download

### Steg 4: Ta bort icon-prop från Button
- `client/src/components/ui/button.tsx` – ta bort icon från props och render

### Steg 5: Template
- `templates/plugin-frontend-template/components/YourItemList.tsx` – migrera 4 icon= till children
- Verifiera import: `@/core/ui/Button` → troligen `@/components/ui/button` (lowercase)

### Steg 6: UI_AND_UX_STANDARDS_V3.md
- Uppdatera alla exempel med icon= till children-mönster
- Lägg till regel: "Ikoner i knappar: children, inte prop. h-4 w-4."

### Steg 7: Verifiering
- [ ] `npx tsc --noEmit`
- [ ] `npm run lint:errors`
- [ ] `rg "icon=\{" client/src templates` → 0 träffar
- [ ] BulkActionBar – fortfarande OK (ändrar inget)
- [ ] Manuell test: footer, toolbar, list-actions, widgets

---

## 4. Särfall

| Särfall | Hantering |
|---------|-----------|
| ImportWizard `icon={undefined}` | Villkorlig child: `{!isImporting && <CheckCircle2 className="h-4 w-4" />}` |
| Button utan text (ikon-bara) | `<Button><Settings className="h-4 w-4" /></Button>` |
| PanelFooter dynamisk Icon | `const Icon = action.icon;` sedan `<Icon className="h-4 w-4" />` |

---

## 5. Ordning (breakar inget)

1. Migrera alla anrop (ContentHeader, PanelFooter, alla plugins, widgets)
2. Migrera template
3. Ta bort icon-prop från Button
4. Uppdatera UI_AND_UX-dokument
5. Verifiera

---

## 6. Uppskattad effort

- ContentHeader: 5 min  
- PanelFooter: 15 min  
- ~25 filer client/src: 1,5–2 h  
- Template: 15 min  
- Button + dokument: 15 min  
- Verifiering: 20 min  

**Totalt:** ~2,5–3 h
