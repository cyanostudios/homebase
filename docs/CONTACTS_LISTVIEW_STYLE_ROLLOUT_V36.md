# Contacts ListView Style Rollout (v3.6)

Detta dokument definierar exakt vad som ska synkas från `contacts` listview till övriga plugins.

## Målstandard (från Contacts)

1. **Panel-surface (list container)**
   - `overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950`
2. **Toolbar i samma panel som listan**
   - Search + Settings + Grid/List i panelens topprad
3. **Grid/List-segment**
   - wrapper: `inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5`
   - buttons: `h-7 rounded-[6px] px-2 text-xs` + tydlig active state
4. **Table-stil**
   - `Table rowBorders={false}`
   - `TableHeader className="bg-slate-50/90 dark:bg-slate-900/50"`
   - Inga visuella radlinjer
5. **Grid cards**
   - `rounded-xl border-0 ... shadow-sm`
6. **Badges**
   - `border-0 rounded-md px-2 py-0.5 text-xs font-semibold`
   - använd subtil bakgrundsfärg, inte outline-border

## Scope

Gäller plugin-listor i:

- `notes`, `tasks`, `matches`, `slots`, `estimates`, `invoices`, `files`, `mail`, `pulses`, `ingest`, `cups`

`settings` exkluderas (annan typ av vy).

## Plugin-checklista

### 1) Notes (`client/src/plugins/notes/components/NoteList.tsx`)

- [ ] Panel-surface till contacts-klass
- [ ] Toolbar/list i samma panel
- [ ] Grid/list-segment-stil
- [ ] Table `rowBorders={false}` + grå header
- [ ] Grid cards till borderless `rounded-xl border-0 shadow-sm`

### 2) Tasks (`client/src/plugins/tasks/components/TaskList.tsx`)

- [ ] Panel-surface till contacts-klass
- [ ] Toolbar/list i samma panel
- [ ] Grid/list-segment-stil
- [ ] Table `rowBorders={false}` + grå header
- [ ] Status/priority badges till borderless badge-stil
- [ ] Grid cards till borderless `rounded-xl border-0 shadow-sm`

### 3) Matches (`client/src/plugins/matches/components/MatchList.tsx`)

- [ ] Panel-surface till contacts-klass
- [ ] Toolbar/list i samma panel
- [ ] Grid/list-segment-stil
- [ ] Table `rowBorders={false}` + grå header
- [ ] Eventuella chips/badges till borderless badge-stil
- [ ] Grid cards till borderless `rounded-xl border-0 shadow-sm`

### 4) Slots (`client/src/plugins/slots/components/SlotsList.tsx`)

- [ ] Panel-surface till contacts-klass
- [ ] Toolbar/list i samma panel
- [ ] Grid/list-segment-stil
- [ ] Table `rowBorders={false}` + grå header
- [ ] Category badge till borderless badge-stil
- [ ] Grid cards till borderless `rounded-xl border-0 shadow-sm`

### 5) Estimates (`client/src/plugins/estimates/components/EstimateList.tsx`)

- [ ] Panel-surface till contacts-klass
- [ ] Toolbar/list i samma panel
- [ ] Grid/list-segment-stil
- [ ] Table `rowBorders={false}` + grå header
- [ ] Status badges till borderless badge-stil
- [ ] Grid cards till borderless `rounded-xl border-0 shadow-sm`

### 6) Invoices (`client/src/plugins/invoices/components/InvoicesList.tsx`)

- [ ] Panel-surface till contacts-klass
- [ ] Toolbar/list i samma panel
- [ ] Om table används: `rowBorders={false}` + grå header
- [ ] Status/type badges till borderless badge-stil
- [ ] Kort/rader till borderless card-känsla

### 7) Files (`client/src/plugins/files/components/FileList.tsx`)

- [ ] Panel-surface till contacts-klass
- [ ] Toolbar/list i samma panel
- [ ] Grid/list-segment-stil
- [ ] Table `rowBorders={false}` + grå header
- [ ] Type/status badges till borderless badge-stil
- [ ] Grid cards till borderless `rounded-xl border-0 shadow-sm`

### 8) Mail (`client/src/plugins/mail/components/MailList.tsx`)

- [ ] Panel-surface till contacts-klass
- [ ] Toolbar/list i samma panel
- [ ] Table `rowBorders={false}` + grå header
- [ ] Status/source badges till borderless badge-stil

### 9) Pulses (`client/src/plugins/pulses/components/PulseList.tsx`)

- [ ] Panel-surface till contacts-klass
- [ ] Toolbar/list i samma panel
- [ ] Table `rowBorders={false}` + grå header
- [ ] Status/source badges till borderless badge-stil

### 10) Ingest (`client/src/plugins/ingest/components/IngestSourceList.tsx`)

- [ ] Panel-surface till contacts-klass
- [ ] Toolbar/list i samma panel
- [ ] Grid/list-segment-stil
- [ ] Table `rowBorders={false}` + grå header
- [ ] Status badges till borderless badge-stil
- [ ] Grid cards till borderless `rounded-xl border-0 shadow-sm`

### 11) Cups (`client/src/plugins/cups/components/CupsList.tsx`)

- [ ] Panel-surface till contacts-klass
- [ ] Toolbar/list i samma panel
- [ ] Grid/list-segment-stil
- [ ] Table `rowBorders={false}` + grå header
- [ ] Grid cards till borderless `rounded-xl border-0 shadow-sm`
