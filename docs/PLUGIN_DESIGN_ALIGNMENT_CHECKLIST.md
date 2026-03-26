# Plugin Design Alignment Checklist

**Referensplugin:** `slots` (primär), `notes` och `tasks` (sekundära)  
**Princip:** Kopiera exakt. Ta bort gammal kod. Inga workarounds.

## Official Template Rule

- New plugins must be generated from:
  - `templates/plugin-frontend-template`
  - `templates/plugin-backend-template`
- The templates are now the source of truth for Contract v2 panel wiring.
- Integration steps are tracked in `NEW_PLUGIN_INTEGRATION_CHECKLIST.md`.

---

## 0. Överordnade regler

- **Kopiera koden – gissa aldrig.** Öppna referensfilen (`SlotView.tsx`, `SlotsContext.tsx` etc.) och kopiera strukturen. Ändra bara plugin-specifika namn och fält.
- **Ta bort gammal kod omedelbart.** Om en implementation ersätts av en ny – ta bort den gamla. Lämna inga döda block, kommenterade-bort grenar eller "backward compat"-hacks som inte längre behövs.
- **Inga workarounds.** Om något inte fungerar: hitta och åtgärda rotorsaken. Lägg inte till extra guards, flags eller omvägar runt ett problem utan att förstå varför det uppstår.
- **End-to-end alltid.** En UX-förändring som berör data (t.ex. ny relation, nytt fält) måste uppdatera migration + model + routes + API + types + context + list + view + form + export. Ingen delvis implementation skickas.

---

## 1. Deep-link URL-synk (Context)

**Referens:** `NoteContext.tsx`, `TaskContext.tsx`, `SlotsContext.tsx`

### Vad som är korrekt

URL-synken kopplas mot `location.pathname` (från `useLocation()`), **inte** mot `[data]`-arrayen. En ref (`*DeepLinkPathSyncedRef`) säkerställer att samma pathname bara öppnar panelen en gång.

```tsx
// ✅ RÄTT – i *Context.tsx
import { useLocation } from 'react-router-dom';

const location = useLocation();
const myPluginDeepLinkPathSyncedRef = useRef<string | null>(null);

useEffect(() => {
  if (items.length === 0) return;
  const segments = location.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'my-plugin') return;
  const slug = segments[1] ?? '';
  if (!slug) {
    myPluginDeepLinkPathSyncedRef.current = location.pathname;
    return;
  }
  const pathKey = location.pathname;
  if (myPluginDeepLinkPathSyncedRef.current === pathKey) return;
  const item = resolveSlug(slug, items, 'title');
  myPluginDeepLinkPathSyncedRef.current = pathKey;
  if (item) {
    openMyPluginForViewRef.current(item as MyPlugin);
  }
}, [location.pathname, items]);
```

### Vad som är fel

```tsx
// ❌ FEL – triggas vid varje listuppdatering, t.ex. efter duplicering
const didOpenFromUrlRef = useRef(false);
useEffect(() => {
  if (didOpenFromUrlRef.current || items.length === 0) return;
  // ...
  if (item) {
    didOpenFromUrlRef.current = true; // ❌ sätts till true en gång – sen aldrig mer
    openMyPluginForViewRef.current(item);
  }
}, [items]); // ❌ [items] som dependency kör effekten varje gång listan ändras
```

**Konsekvens av felet:** När listan uppdateras (t.ex. duplicering prepends en rad) körs effekten igen, anropar `openXForView` igen, vilket nollställer `recentlyDuplicatedId` och den gröna raden försvinner.

### Checklist

- [ ] `useLocation` importerat i context
- [ ] `const location = useLocation()` deklarerat i Provider
- [ ] Deep-link-effekten beror på `[location.pathname, items]`
- [ ] En ref (`*DeepLinkPathSyncedRef`) med `string | null` används
- [ ] Gammal `didOpenFromUrlRef`-logik **raderad**

---

## 2. QuickActionsCard (View)

**Referens:** `SlotView.tsx` (funktion `SlotQuickActionsCard`), `NoteView.tsx` (funktion `NoteQuickActionsCard`), `TaskView.tsx` (funktion `TaskQuickActionsCard`)

### Exakt komponentstruktur

```tsx
// ✅ RÄTT – kopiera detta mönster
const PLUGIN_DETAIL_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';
const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';

function MyPluginQuickActionsCard({
  item,
  onEdit,
  onDeleteClick,
  onDuplicate,
  getDuplicateConfig,
}) {
  const { t } = useTranslation();
  const canDuplicate = Boolean(getDuplicateConfig(item));

  return (
    <Card padding="none" className={PLUGIN_DETAIL_CARD_CLASS}>
      <DetailSection
        title={t('myPlugin.quickActions')}
        icon={Zap}
        iconPlugin="my-plugin"
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1.5">
          {/* Edit – blå ikon (om pluginet har edit-läge) */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Edit
                {...props}
                className={cn(props.className, 'text-blue-600 dark:text-blue-400')}
              />
            )}
            className={quickActionButtonClass}
            onClick={() => onEdit(item)}
          >
            {t('common.edit')}
          </Button>

          {/* Delete – röd ikon, röd hover */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Trash2
                {...props}
                className={cn(props.className, 'text-red-600 dark:text-red-400')}
              />
            )}
            className="h-9 justify-start rounded-md px-3 text-xs hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={onDeleteClick}
          >
            {t('common.delete')}
          </Button>

          {/* Duplicate – grön ikon, visas bara om getDuplicateConfig returnerar värde */}
          {canDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={(props) => (
                <Copy
                  {...props}
                  className={cn(props.className, 'text-green-600 dark:text-green-400')}
                />
              )}
              className={quickActionButtonClass}
              onClick={() => onDuplicate(item)}
            >
              {t('common.duplicate')}
            </Button>
          )}

          {/* Extra actions (detailFooterActions) – om pluginet stöder det */}
          {Array.isArray(detailFooterActions) &&
            detailFooterActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={(props) => (
                    <Icon
                      {...props}
                      className={cn(props.className, getActionIconColorClass(action.id))}
                    />
                  )}
                  disabled={action.disabled}
                  className={cn(quickActionButtonClass, 'disabled:opacity-50', action.className)}
                  onClick={() => action.onClick(item)}
                >
                  {action.label}
                </Button>
              );
            })}
        </div>
      </DetailSection>
    </Card>
  );
}
```

### Ikonfärger

| Åtgärd       | Ikon-CSS                               | Hover CSS                                  |
| ------------ | -------------------------------------- | ------------------------------------------ |
| Edit         | `text-blue-600 dark:text-blue-400`     | `hover:bg-muted`                           |
| Delete       | `text-red-600 dark:text-red-400`       | `hover:bg-red-50 dark:hover:bg-red-950/30` |
| Duplicate    | `text-green-600 dark:text-green-400`   | `hover:bg-muted`                           |
| Send message | `text-violet-600 dark:text-violet-400` | `hover:bg-muted`                           |
| Send email   | `text-red-600 dark:text-red-400`       | `hover:bg-muted`                           |

### Checklist

- [ ] `QuickActionsCard` är en separat `function`-komponent (inte inlines i `return`)
- [ ] Korrekt ikonfärg per åtgärd (se tabell ovan)
- [ ] Delete-knappen har röd hover-bakgrund
- [ ] `canDuplicate` räknas från `getDuplicateConfig(item)`
- [ ] `onDuplicate` → `setShowDuplicateDialog(true)` (öppnar dialog, anropar **inte** `executeDuplicate` direkt)
- [ ] Inga fullbredds grå action-rader, inga `variant="default"` knappar

---

## 3. ExportOptionsCard (View)

**Referens:** `NoteView.tsx` (funktion `NoteExportOptionsCard`), `TaskView.tsx` (funktion `TaskExportOptionsCard`)

```tsx
function MyPluginExportOptionsCard({ item, exportFormats, onExportItem }) {
  const { t } = useTranslation();
  if (!Array.isArray(exportFormats) || exportFormats.length === 0) return null;

  const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';
  const exportLabelByFormat: Record<ExportFormat, string> = {
    txt: t('common.exportTxt'),
    csv: t('common.exportCsv'),
    pdf: t('common.exportPdf'),
  };

  return (
    <Card padding="none" className={PLUGIN_DETAIL_CARD_CLASS}>
      <DetailSection
        title={t('myPlugin.exportOptions')}
        icon={Download}
        iconPlugin="my-plugin"
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1.5">
          {exportFormats.map((format) => (
            <Button
              key={format}
              type="button"
              variant="ghost"
              size="sm"
              icon={Download}
              className={quickActionButtonClass}
              onClick={() => onExportItem(format, item)}
            >
              {exportLabelByFormat[format]}
            </Button>
          ))}
        </div>
      </DetailSection>
    </Card>
  );
}
```

### Checklist

- [ ] `ExportOptionsCard` är en separat komponent
- [ ] Returnerar `null` om `exportFormats` är tom
- [ ] Alla formatsträngar hämtas från i18n (`common.exportTxt` etc.)
- [ ] Ikonen är `Download` (inte `FileText` eller liknande)

---

## 4. DuplicateDialog – komplett kopiering

**Referens:** `SlotView.tsx`, `NoteContext.tsx`, `SlotsContext.tsx`

### 4.1 Context-sidan

```tsx
// ✅ RÄTT – i *Context.tsx

// State
const [recentlyDuplicatedMyPluginId, setRecentlyDuplicatedMyPluginId] = useState<string | null>(
  null,
);

// Nollställ vid öppning av annan/ny post
const openMyPluginForView = useCallback(
  (item: MyPlugin) => {
    setRecentlyDuplicatedMyPluginId(null); // alltid nollställ vid navigering
    setCurrentMyPlugin(item);
    setPanelMode('view');
    setIsMyPluginPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    navigateToItem(item, items, 'title');
  },
  [onCloseOtherPanels, navigateToItem, items],
);

// getDuplicateConfig – returnerar null om item är null
const getDuplicateConfig = useCallback(
  (item: MyPlugin | null) => {
    if (!item) return null;
    const baseTitle = item.title?.trim() || 'Item';
    return {
      defaultName: `Copy of ${baseTitle}`,
      nameLabel: t('myPlugin.title'), // i18n-nyckel
      confirmOnly: false,
    };
  },
  [t],
);

// executeDuplicate – returnerar { closePanel, highlightId }
const executeDuplicate = useCallback(
  async (
    item: MyPlugin,
    newName: string,
  ): Promise<{ closePanel: () => void; highlightId?: string }> => {
    const nextName = (newName ?? '').trim();
    const payload = {
      title: nextName || item.title?.trim() || 'Untitled',
      // ...övriga fält kopieras från item
    };
    const newItem = await myPluginApi.create(payload);
    setItems((prev) => [newItem, ...prev]);
    const highlightId = newItem?.id != null ? String(newItem.id) : undefined;
    return { closePanel: closeMyPluginPanel, highlightId };
  },
  [closeMyPluginPanel],
);

// Exponera i context value
const value = {
  // ...
  getDuplicateConfig,
  executeDuplicate,
  recentlyDuplicatedMyPluginId,
  setRecentlyDuplicatedMyPluginId,
};
```

### 4.2 View-sidan

```tsx
// ✅ RÄTT – i *View.tsx

import { DuplicateDialog } from '@/core/ui/DuplicateDialog';

// Destrukturera från context – setRecentlyDuplicated* MÅSTE vara med
const {
  getDuplicateConfig,
  executeDuplicate,
  setRecentlyDuplicatedMyPluginId,  // ← obligatorisk, lätt att glömma
} = useMyPlugin();

// Local state
const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

// Koppla knappen i QuickActionsCard
<MyPluginQuickActionsCard
  item={item}
  onDuplicate={() => setShowDuplicateDialog(true)}   // ← öppnar dialog, ej executeDuplicate
  getDuplicateConfig={getDuplicateConfig}
  // ...
/>

// Dialog – ordning: closePanel FÖRE setRecentlyDuplicated
<DuplicateDialog
  isOpen={showDuplicateDialog}
  onConfirm={(newName) => {
    executeDuplicate(item, newName)
      .then(({ closePanel, highlightId }) => {
        closePanel();                                          // 1. stäng panelen
        if (highlightId) {
          setRecentlyDuplicatedMyPluginId(highlightId);       // 2. sätt highlight
        }
        setShowDuplicateDialog(false);                        // 3. stäng dialogen
      })
      .catch(() => {
        setShowDuplicateDialog(false);
      });
  }}
  onCancel={() => setShowDuplicateDialog(false)}
  defaultName={getDuplicateConfig(item)?.defaultName ?? ''}
  nameLabel={getDuplicateConfig(item)?.nameLabel ?? t('myPlugin.title')}
  confirmOnly={Boolean(getDuplicateConfig(item)?.confirmOnly)}
/>
```

### 4.3 Listvy – grön highlight

```tsx
// ✅ RÄTT – i *List.tsx
const { recentlyDuplicatedMyPluginId } = useMyPlugin();

<TableRow
  key={item.id}
  className={cn(
    'cursor-pointer hover:bg-muted/50',
    isSelected(item.id) && 'bg-plugin-subtle',
    recentlyDuplicatedMyPluginId === String(item.id) &&
      'bg-green-50 dark:bg-green-950/30',  // ← grön highlight
  )}
>
```

### Checklist

- [ ] `setRecentlyDuplicated*Id` destruktureras i View-komponenten
- [ ] `onDuplicate` på QuickActionsCard anropar `setShowDuplicateDialog(true)` – **inte** `executeDuplicate`
- [ ] `DuplicateDialog` importeras från `@/core/ui/DuplicateDialog`
- [ ] Ordning i `onConfirm`: `closePanel()` → `setRecentlyDuplicated*Id` → `setShowDuplicateDialog(false)`
- [ ] `executeDuplicate` i context: `nextName || item.title || 'Untitled'`
- [ ] `getDuplicateConfig` i context: returnerar `defaultName`, `nameLabel` (i18n), `confirmOnly`
- [ ] `openMyPluginForView` i context: anropar alltid `setRecentlyDuplicatedMyPluginId(null)` (ingen `alreadyViewingSame`-check)
- [ ] Deep-link-effekten är pathname-baserad (se avsnitt 1) – annars nollställs highlight vid listuppdatering
- [ ] Lista har `bg-green-50 dark:bg-green-950/30` när `recentlyDuplicated*Id === String(item.id)`
- [ ] i18n-nyckel `myPlugin.title` finns i **både** `en.json` och `sv.json`
- [ ] Gammal kod (t.ex. `executeDuplicate(item, '')` direkt från knapp) **raderad**

---

## 5. Properties Card (View & Form)

**Referens:** `TaskView.tsx` (inline i main column), `SlotView.tsx` (`SlotSettingsCard`)

### Typografitokens – inga undantag

| Element                      | Klass                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Sektionrubrik-ikon-container | `h-7 w-7 flex items-center justify-center rounded-md bg-muted/80 text-muted-foreground` |
| Sektionsrubrik-text          | `text-sm font-semibold text-foreground`                                                 |
| Ramad rad-wrapper            | `rounded-lg border border-border p-4`                                                   |
| Property-label               | `text-sm font-medium`                                                                   |
| Property-kontroll            | `h-9 text-xs`                                                                           |
| Meta/hjälptext i rad         | `text-[11px] text-muted-foreground`                                                     |

**Det är förbjudet** att använda `text-[10px]`, `h-7` kontroller eller `text-[11px]` labels i properties-korten – dessa är legacy från kod som **ska raderas**.

### Placering

- Properties-kortet placeras **direkt under** innehållskortet i **första kolumnen** (main area) i detaljvyn.
- Properties placeras **inte** i sidebar om referensen (slots/tasks) inte gör det.

### Checklist

- [ ] Sektionsikonen är `SlidersHorizontal` (eller plugin-lämplig ekvivalent) i muted-box
- [ ] Varje property-rad är `<div className="rounded-lg border border-border p-4">`
- [ ] Label: `text-sm font-medium`
- [ ] Kontroll (select, datepicker, etc.): `h-9`, text `text-xs`
- [ ] Gammal `text-[10px]`/`h-7`-styling **raderad**

---

## 6. Sidebar-layout (View)

**Referens:** `SlotView.tsx`, `NoteView.tsx`

Sidebar ska innehålla, i denna ordning:

1. `QuickActionsCard`
2. `ExportOptionsCard` (om pluginet stöder export)
3. Relaterade entiteter (mentions, assignees osv.)
4. `Information`-kortet (System ID, Created, Updated)
5. `DetailActivityLog` (om pluginet loggar aktivitet)

Properties ska **inte** ligga i sidebar. Sidebar är för metadata, actions och relationer.

### Checklist

- [ ] Sidebar-`div` har `space-y-4` (slots) eller `space-y-6` (tasks) – samma som referens
- [ ] Ingen properties-/innehålls-duplication i sidebar

---

## 7. ConfirmDialog vid Delete

**Referens:** `SlotView.tsx`, `NoteView.tsx`, `TaskView.tsx`

```tsx
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

<ConfirmDialog
  isOpen={showDeleteConfirm}
  title={t('dialog.deleteItem', { label: t('nav.myPlugin') })}
  message={item ? getDeleteMessage(item) : ''}
  confirmText={t('common.delete')}
  cancelText={t('common.cancel')}
  onConfirm={async () => {
    await deleteMyPlugin(item.id);
    setShowDeleteConfirm(false);
    // closeMyPluginPanel() anropas av deleteMyPlugin i context om nödvändigt
  }}
  onCancel={() => setShowDeleteConfirm(false)}
  variant="danger"
/>;
```

### Checklist

- [ ] `variant="danger"` på delete-dialogen
- [ ] `getDeleteMessage` exponeras från context och kallas med aktuellt item
- [ ] Panelen stängs av context efter delete, inte direkt av view-komponenten (om det är kontextens ansvar)

---

## 8. i18n – obligatoriska nycklar

Varje plugin behöver dessa nycklar i **både** `en.json` och `sv.json`:

```json
"myPlugin": {
  "quickActions": "Quick actions",
  "exportOptions": "Export options",
  "title": "Title",
  "information": "Information",
  "myPluginContent": "...",
  "deleteConfirmThis": "...",
  "deleteConfirmNamed": "..."
}
```

Återanvänd `common.*`-nycklar (`common.edit`, `common.delete`, `common.duplicate`, `common.exportTxt` etc.) istället för att skapa plugin-specifika kopior.

### Checklist

- [ ] `myPlugin.title` finns (används i `DuplicateDialog` nameLabel)
- [ ] `myPlugin.quickActions` finns
- [ ] `myPlugin.exportOptions` finns
- [ ] Alla nycklar finns i **BÅDA** `en.json` och `sv.json`

---

## 9. Context – fullständig implementation

**Referens:** `NoteContext.tsx`, `TaskContext.tsx`, `SlotsContext.tsx`

Obligatoriska delar i varje plugin-context:

```tsx
// ── State ──────────────────────────────────────────────────────────
const [recentlyDuplicatedMyPluginId, setRecentlyDuplicatedMyPluginId] = useState<string | null>(
  null,
);

// ── closeMyPluginPanel ─────────────────────────────────────────────
// Definiera FÖRE useEffect som registrerar den (TDZ-regel)
const closeMyPluginPanel = useCallback(() => {
  setIsMyPluginPanelOpen(false);
  setCurrentMyPlugin(null);
  setPanelMode('create');
  setValidationErrors([]);
  navigateToBase();
}, [navigateToBase]);

useEffect(() => {
  registerPanelCloseFunction('my-plugin', closeMyPluginPanel);
  return () => unregisterPanelCloseFunction('my-plugin');
}, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeMyPluginPanel]);

// ── openMyPluginForView ────────────────────────────────────────────
// Nollställ alltid recentlyDuplicated vid ny navigering
const openMyPluginForView = useCallback(
  (item: MyPlugin) => {
    setRecentlyDuplicatedMyPluginId(null);
    setCurrentMyPlugin(item);
    setPanelMode('view');
    setIsMyPluginPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
    navigateToItem(item, items, 'title');
  },
  [onCloseOtherPanels, navigateToItem, items],
);

// ── Ref-brygga (stabil referens för deep-link-effekten) ────────────
const openMyPluginForViewRef = useRef(openMyPluginForView);
useEffect(() => {
  openMyPluginForViewRef.current = openMyPluginForView;
}, [openMyPluginForView]);

const openMyPluginForViewBridge = useCallback(
  (item: MyPlugin) => openMyPluginForViewRef.current(item),
  [],
);

useEffect(() => {
  registerMyPluginNavigation(openMyPluginForViewBridge);
  return () => registerMyPluginNavigation(null);
}, [registerMyPluginNavigation, openMyPluginForViewBridge]);

// ── Deep-link URL-synk (pathname-baserad, se avsnitt 1) ────────────
const myPluginDeepLinkPathSyncedRef = useRef<string | null>(null);
useEffect(() => {
  if (items.length === 0) return;
  const segments = location.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'my-plugin') return;
  const slug = segments[1] ?? '';
  if (!slug) {
    myPluginDeepLinkPathSyncedRef.current = location.pathname;
    return;
  }
  const pathKey = location.pathname;
  if (myPluginDeepLinkPathSyncedRef.current === pathKey) return;
  const item = resolveSlug(slug, items, 'title');
  myPluginDeepLinkPathSyncedRef.current = pathKey;
  if (item) openMyPluginForViewRef.current(item as MyPlugin);
}, [location.pathname, items]);
```

### Checklist

- [ ] `recentlyDuplicatedMyPluginId` + `setRecentlyDuplicated*` i state
- [ ] `recentlyDuplicatedMyPluginId` nollsätts i `openMyPluginForView`, `openMyPluginForEdit`, `openMyPluginPanel` och `openMyPluginSettings`
- [ ] `closeMyPluginPanel` deklareras FÖRE `useEffect` som registrerar den
- [ ] Ref-brygga används för navigation-registration (inte direkt `openMyPluginForView`)
- [ ] Deep-link-effekten är pathname-baserad (inte `[items]`-baserad)
- [ ] `getDuplicateConfig` och `executeDuplicate` exponeras i context value
- [ ] `recentlyDuplicatedMyPluginId` och `setRecentlyDuplicatedMyPluginId` exponeras i context value

---

## 10. Verifiering före merge

Gå igenom denna lista i ordning. **Inget "troligen OK" accepteras** – verifiera faktiskt.

### Duplicering

- [ ] Klicka Duplicate → namnprompt visas med `defaultName` ifyllt
- [ ] Spara → panelen stängs → ny rad i listan med grön bakgrund
- [ ] Grön bakgrund kvarstår efter att listan laddats om (via listuppdatering)
- [ ] Grön bakgrund försvinner när man öppnar en annan post
- [ ] Avbryt i dialogen → panelen förblir öppen, ingen ny post skapas

### Deep-link

- [ ] Ladda om sidan med `/my-plugin/slug-123` i URL → rätt post öppnas
- [ ] Navigera till ny post → URL uppdateras
- [ ] Stäng panelen → URL återgår till `/my-plugin`
- [ ] Duplicera (med URL i adressfältet) → grön highlight kvarstår

### Quick actions

- [ ] Edit-knapp: blå ikon, öppnar edit-läge
- [ ] Delete-knapp: röd ikon, röd hover, öppnar bekräftelsedialog
- [ ] Duplicate-knapp: grön ikon, öppnar namnprompt
- [ ] Inga fullbredds-knappar med grön bakgrundsfärg i Quick actions

### Properties

- [ ] Alla labels: `text-sm font-medium`
- [ ] Alla kontroller: `h-9 text-xs`
- [ ] Inga `text-[10px]`, `h-7`-kontroller

### i18n

- [ ] Alla nycklar finns i `en.json`
- [ ] Alla nycklar finns i `sv.json`
- [ ] Inga hårdkodade engelska strängar

### Lint

- [ ] `npm run lint` passerar utan nya fel på ändrade filer

---

## 11. Vad som inte ska existera

Följande mönster är **felaktiga** och ska **tas bort** när de hittas:

| Mönster                                                                                            | Ersätt med                                                   |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `onDuplicate={(item) => executeDuplicate(item, '')}`                                               | `onDuplicate={() => setShowDuplicateDialog(true)}`           |
| `didOpenFromUrlRef` + `useEffect([data])` för deep-link                                            | Pathname-baserad effekt (avsnitt 1)                          |
| `alreadyViewingSame`-check i `openXForView`                                                        | Ta bort – nollställ alltid                                   |
| `setRecentlyDuplicatedId` innan `closePanel()` i `onConfirm`                                       | `closePanel()` först, sedan `setRecentlyDuplicatedId`        |
| `setRecentlyDuplicatedId` saknas i destrukturering i View                                          | Lägg till                                                    |
| `text-[10px]`/`h-7` i properties-knappar                                                           | `text-xs`/`h-9`                                              |
| Properties i sidebar                                                                               | Flytta till main column                                      |
| Gammal `hasAssignedToIdsColumn`-liknande `information_schema`-query med tenant-isolerad `db.query` | Try/catch direkt på write-operation (se `model.js`-mönstret) |
| `window.submitXxxForm` / `window.cancelXxxForm` i `*Form.tsx`                                      | Inline Save/Cancel-knappar i formuläret (se avsnitt 12)      |
| `window.addEventListener('submitXxxForm', ...)` i `*Form.tsx`                                      | Inline Save/Cancel-knappar i formuläret (se avsnitt 12)      |

---

## 12. Formulärhantering – inline Save/Cancel (ingen window-bridge)

**Regel:** Varje `*Form.tsx` ansvarar för sina egna Save/Cancel-knappar. Inga `window.submitXxxForm`-globaler, inga CustomEvent-lyssnare. `PanelFooter` hanterar **inte** formulärsparande.

**Referens:** `SlotForm.tsx`, `NoteForm.tsx`, `TaskForm.tsx`, `ContactForm.tsx`

### Exakt mönster

```tsx
// Längst ned i formulärets return-block, efter alla fält:
<div className="flex justify-end gap-2 pt-4 border-t border-border">
  <Button
    type="button"
    variant="secondary"
    size="sm"
    icon={X}
    onClick={onCancel}
    disabled={isSubmitting}
    className="h-9 text-xs px-3"
  >
    {t('common.cancel')}
  </Button>
  <Button
    type="button"
    variant="primary"
    size="sm"
    icon={Check}
    onClick={handleSubmit}
    disabled={hasBlockingErrors || isSubmitting}
    className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
  >
    {isSubmitting
      ? t('common.saving')
      : panelMode === 'edit'
        ? t('common.update')
        : t('common.save')}
  </Button>
</div>
```

### Regler

- `handleSubmit` och `handleCancel` definieras som `useCallback` i formuläret (inga ändringar i spara-logiken).
- `onCancel`-prop anropas direkt från `handleCancel`; i edit-läge växlar context till view via `openXForView`.
- Ta bort hela `useEffect` som registrerar `window.submitXxxForm` / `window.cancelXxxForm`.
- Ta bort deklarationerna i `global.d.ts` efter att alla formulär är migrerade.
- `hasBlockingErrors` = `validationErrors.some(e => !e.message.includes('Warning'))`.

### Checklist per formulär

- [ ] Inline Save/Cancel-rad finns längst ned i formuläret
- [ ] `useEffect` som registrerar window-global **är borttagen**
- [ ] `window.submitXxxForm` / `window.cancelXxxForm` **nämns inte** i filen
- [ ] `hasBlockingErrors` beräknas lokalt eller destruktureras från context
- [ ] Knappstorleken är `h-9 text-xs px-3`

---

## Referensfiler

| Fil                                                 | Vad den visar                                                   |
| --------------------------------------------------- | --------------------------------------------------------------- |
| `client/src/plugins/slots/components/SlotView.tsx`  | QuickActionsCard, DuplicateDialog, layout                       |
| `client/src/plugins/slots/context/SlotsContext.tsx` | executeDuplicate, getDuplicateConfig, deep-link (pathname)      |
| `client/src/plugins/notes/components/NoteView.tsx`  | NoteQuickActionsCard, ExportOptionsCard, DuplicateDialog        |
| `client/src/plugins/notes/context/NoteContext.tsx`  | getDuplicateConfig (med t()), executeDuplicate, openNoteForView |
| `client/src/plugins/tasks/components/TaskView.tsx`  | TaskQuickActionsCard, Properties card (main column)             |
| `client/src/plugins/tasks/context/TaskContext.tsx`  | deep-link (pathname), openTaskForView, recentlyDuplicated\*     |
| `client/src/core/ui/DuplicateDialog.tsx`            | Dialog-komponentens interface                                   |
| `client/src/i18n/locales/en.json`                   | Befintliga nycklar att återanvända                              |
| `docs/UI_AND_UX_STANDARDS_V3.md`                    | Typografitokens, list/grid-layout                               |
| `docs/PLUGIN_DEVELOPMENT_STANDARDS_V2.md`           | Context-konventioner, naming, security                          |
| `docs/LESSONS_LEARNED.md`                           | Kända fallgropar och rotorsaker                                 |
