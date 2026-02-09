# Layout Refactoring V2 - 3-Column Mail Layout

## Översikt

Detta dokument beskriver den omfattande refactoring av applikationens layout till en 3-kolumns mail-layout inspirerad av blocks.so's "Double-Sided Mail" design. Refactoringen omfattar sidebar, list-vyer, detail panel och övergripande layout-struktur.

## Datum

2025-01-XX

## Huvudsakliga Ändringar

### 1. 3-Kolumns Layout Struktur

**MainLayout.tsx**

- Refaktorerad från 2-kolumns (Sidebar + Content) till 3-kolumns layout
- **Kolumn 1**: Sidebar (fast `12rem` bredd, kompakt design)
- **Kolumn 2**: List Area (`flex-1`, tar hela återstående utrymmet)
- **Kolumn 3**: Detail Panel (fast `600px` bredd, alltid synlig)

**Fördelar:**

- Bättre utnyttjande av viewport-bredd
- Mail-liknande navigation (nav-list-detail)
- Ingen overlay, allt är permanent synligt
- Varje kolumn scrollar oberoende

### 2. Sidebar Optimering

**Bredd och Design:**

- Minskat från `16rem` till `12rem` för kompaktare design
- Ändrat variant till `"inset"` (som blocks.so sidebar-02)
- Minskad padding och spacing överallt:
  - Header/Footer: `p-2` → `p-1.5`
  - Content gap: `gap-2` → `gap-1`
  - Menu gap: `gap-1` → `gap-0.5`
  - Group padding: `p-2` → `p-1.5`
  - Kategori-spacing: `h-8` → `h-6`

**Ikoner och Text:**

- Ikoner: `h-4 w-4` → `h-3.5 w-3.5`
- Menu labels: `text-sm`
- Header logo: `h-8 w-8` → `h-7 w-7`
- User avatar: `h-8 w-8` → `h-7 w-7`

**Submenu Implementation:**

- Bytte från separat `SecondarySidebar` till Collapsible-submenus
- Använder shadcn/ui `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`
- Använder `SidebarMenuSub`, `SidebarMenuSubButton`, `SidebarMenuSubItem`
- Chevron-ikon ändras från `ChevronRight` till `ChevronDown` när öppen
- Auto-öppnar submenu om current page är i en submenu

### 3. Detail Panel

**DetailPanel.tsx** (Ny komponent)

- Ersätter `UniversalPanel` för huvudinnehåll
- Fast `600px` bredd, alltid synlig (ingen animation)
- Ingen overlay, permanent tredje kolumn
- Visar placeholder "Select an item to view details" när tom
- Egen scroll för innehåll
- Stödjer header, content och footer

**UniversalPanel** behålls endast för Settings Panel

### 4. List-Vyer Refactoring

**Kompakt 2-3 Raders Layout:**
Alla list-komponenter uppdaterade från tabell-layout till kompakt layout:

- **Rad 1**: Icon + Titel/Nummer + Badges (om tillämpligt)
- **Rad 2**: Sekundär info (Contact, Total, Due Date, etc.)
- **Rad 3**: Ytterligare info (VAT, Mentions, Updated date, etc.) - valfritt

**Uppdaterade Komponenter:**

- `ContactList.tsx`
- `InvoicesList.tsx`
- `TaskList.tsx`
- `NoteList.tsx`
- `EstimateList.tsx`
- `FileList.tsx`

**Borttaget:**

- Tabell-layout (`<table>`)
- `isMobileView` state och logik
- Separata mobile/desktop vyer

### 5. Grupperade Listor (Grouped Lists)

**GroupedList.tsx** (Ny komponent)

- Generisk komponent för grupperade listor
- Stödjer Collapsible-grupper med chevron-ikoner
- Visar antal items per grupp
- Kan användas med eller utan gruppering (`groupConfig: null`)

**Grupperade Listor:**

- **ContactList**: Grupperad per `contactType` (Company/Private)
- **TaskList**: Grupperad per `priority` (High/Medium/Low)

**Listor utan Gruppering:**

- InvoicesList, NoteList, EstimateList, FileList använder `groupConfig: null`

**Användning:**
Varje plugin kan välja om och hur den vill gruppera:

```typescript
// Med gruppering
<GroupedList
  items={items}
  groupConfig={{
    getGroupKey: (item) => item.category,
    getGroupLabel: (key) => key,
    getGroupOrder: (key) => orderMap[key] || 0,
    defaultOpen: true,
  }}
  renderItem={...}
/>

// Utan gruppering
<GroupedList
  items={items}
  groupConfig={null}
  renderItem={...}
/>
```

### 6. Scroll Implementation

**Oberoende Scroll per Kolumn:**

- **SidebarProvider**: `h-screen overflow-hidden` (förhindrar sid-scroll)
- **Sidebar**: Egen scroll via `SidebarContent` med `overflow-auto`
- **List Area**: Egen scroll via `overflow-y-auto min-h-0` på inner div
- **Detail Panel**: Egen scroll via `overflow-y-auto` på content area

**Resultat:**

- Varje kolumn scrollar oberoende
- Hela sidan scrollar inte

## Tekniska Detaljer

### Nya Filer

- `client/src/core/ui/DetailPanel.tsx` - Ny detail panel komponent
- `client/src/core/ui/GroupedList.tsx` - Generisk grupperad lista komponent
- `docs/LAYOUT_REFACTORING_V2.md` - Detta dokument

### Modifierade Filer

**Layout:**

- `client/src/core/ui/MainLayout.tsx` - 3-kolumns struktur
- `client/src/core/ui/Sidebar.tsx` - Collapsible submenus
- `client/src/core/ui/SecondarySidebar.tsx` - Används inte längre (kan tas bort)
- `client/src/App.tsx` - Integration med ny layout

**List-Komponenter:**

- `client/src/plugins/contacts/components/ContactList.tsx`
- `client/src/plugins/invoices/components/InvoicesList.tsx`
- `client/src/plugins/tasks/components/TaskList.tsx`
- `client/src/plugins/notes/components/NoteList.tsx`
- `client/src/plugins/estimates/components/EstimateList.tsx`
- `client/src/plugins/files/components/FileList.tsx`

**UI Komponenter:**

- `client/src/components/ui/sidebar.tsx` - Uppdaterad för kompakt design
- `client/src/components/ui/collapsible.tsx` - Cleanup av imports

### Borttagna Features

- `SecondarySidebar` komponent (ersatt av Collapsible)
- Tabell-layout i alla list-komponenter
- `isMobileView` state i alla list-komponenter
- Separata mobile/desktop vyer

## Design Inspiration

- **blocks.so sidebar-02** (Dashboard Inset) - Sidebar design
- **blocks.so sidebar-04** (Double-Sided Mail) - Övergripande layout koncept
- **blocks.so table-04** (Grouped Rows) - Grupperad lista koncept

## Breaking Changes

Inga breaking changes för användare. Alla ändringar är interna refactoringar som förbättrar UX.

## Framtida Förbättringar

- Responsive design för mobil (Detail som overlay)
- Ytterligare optimering av spacing och padding
- Ytterligare plugins kan lägga till gruppering enkelt via `GroupedList`

## Testning

Alla ändringar har testats med:

- `npm run build:ui` - Build fungerar utan fel
- ESLint - Inga linting-fel
- TypeScript - Inga type-errors

## Commit Information

Detta refactoring utfördes i branch: `homebase-v2-2512`
