# Homebase design system (foundation)

**Datum:** 2026-10-30  
**Status:** Beslut låsta; grund införd i kod.  
**Underlag:** [`DESIGN_SYSTEM_AUDIT.md`](DESIGN_SYSTEM_AUDIT.md)  
**Appstandard (detaljerade list/detail-regler):** [`docs/UI_AND_UX_STANDARDS_V3.md`](../../UI_AND_UX_STANDARDS_V3.md)

Detta dokument låser färger, knaptyper, radie och ikonstorlek. Det ersätter inte V3:s list/detail-shell.

---

## 1. Låsta beslut (audit §6)

| #   | Fråga                    | Beslut                                                                          |
| --- | ------------------------ | ------------------------------------------------------------------------------- |
| 1   | Neutral bakgrund         | **Behåll** kall `--background: 210 40% 96%`                                     |
| 2   | Primär hex               | **Behåll** `#009EF7` (`--primary: 200 100% 48%`)                                |
| 3   | Success / warning / info | **Nya CSS-tokens** + Tailwind utilities                                         |
| 4   | Statusbadge-språk        | **Behåll** V3 text-only outline (`BADGE_CHIP_*`)                                |
| 5   | Knapptyp                 | **Matris** (nedan) — best practice från V3-praxis                               |
| 6   | Publika sajter           | **Behåll brand-öar** (ingen gemensam tokenkontrakt)                             |
| 7   | Radie                    | `sm` / `md` / `lg` / `full`                                                     |
| 8   | Ikonstorlek              | 14 / 16 / 20 (`size-3.5` / `size-4` / `size-5`)                                 |
| 9   | Död kod                  | **Borttagen** (shadcn sidebar, navigation-menu, DetailCard, tooltip, separator) |
| 10  | Saknade primitives       | **Byggda** (Dialog, Tabs, Toast/sonner, Combobox) — call sites migreras senare  |

---

## 2. Färgroller (SPA)

Källa: [`client/src/index.css`](../../../client/src/index.css), [`tailwind.config.ts`](../../../tailwind.config.ts).

| Roll           | Token                                | Användning                             |
| -------------- | ------------------------------------ | -------------------------------------- |
| Page / shell   | `--background`                       | List/content shell (kall gråblå)       |
| Workspace      | `--workspace`                        | Vit sidebar / main chrome              |
| Card           | `--card`                             | Kortytor                               |
| Primary        | `--primary`                          | Interaktiv cyan `#009EF7`              |
| Destructive    | `--destructive`                      | Farliga fills / text där token används |
| Success        | `--success` / `--success-foreground` | Bekräftande fills + status text        |
| Warning        | `--warning` / `--warning-foreground` | Varning / pending                      |
| Info           | `--info` / `--info-foreground`       | Informativ status                      |
| Plugin accents | `--plugin-*`                         | Per-plugin subtila ytor                |

Statusbadges (`QC_STATUS_BADGE_COLORS`) pekar på `text-success` / `text-warning` / `text-info` / `text-destructive` (och slate/muted för neutral). **Ingen** soft-fill pill.

`--chart-*` är fortfarande odefinierade — seriepalett beslutas separat.

Publika sajter (`public-clubdesk`, `public-cups`, …) behåller egna `--brand` / `--bg-page`.

---

## 3. Knapptyp

| Yta                                                                                 | Komponent              |
| ----------------------------------------------------------------------------------- | ---------------------- |
| Sidhuvud (Add/Close/Save), dialog/footer, right rail, bulk bar, settings-kategorier | `RoundIconLabelButton` |
| Formulärfält-knappar, länkvariant, `asChild` mot icke-rund kontroll, tät X på badge | `Button`               |

Legacy §3.1 i V3 som pekade på `Button secondary sm` för list-toolbar är **ersatt** av matrisen ovan (toolbar chrome = round).

---

## 4. Radie

Tillåtna nivåer för **ny** UI:

| Token / klass  | Typisk användning                                        |
| -------------- | -------------------------------------------------------- |
| `rounded-sm`   | Täta kontroller                                          |
| `rounded-md`   | Default (`--radius: 0.5rem`) — inputs, dialoger, knappar |
| `rounded-lg`   | Kort / sektioner                                         |
| `rounded-full` | Pills, avatars, `RoundIconLabelButton`                   |

`rounded-xl` och övriga är **legacy** — byt inte i massor; undvik i ny kod.

---

## 5. Ikonstorlek (Lucide)

| px  | Klass      | Användning                                              |
| --- | ---------- | ------------------------------------------------------- |
| 14  | `size-3.5` | Kompakt meta, dense badges, `RoundIconLabelButton` `xs` |
| 16  | `size-4`   | Standard inline / `Button` icon                         |
| 20  | `size-5`   | Toolbar `sm`/`md` round buttons                         |

Andra storlekar i befintlig kod är legacy.

---

## 6. Primitives (katalog)

| Fil                                         | Roll                                         |
| ------------------------------------------- | -------------------------------------------- |
| `components/ui/button.tsx`                  | Rektangulär knapp                            |
| `components/ui/round-icon-label-button.tsx` | Rund ikon+label                              |
| `components/ui/dialog.tsx`                  | Generisk modal (Radix Dialog)                |
| `components/ui/alert-dialog.tsx`            | Bekräftelser (`ConfirmDialog`)               |
| `components/ui/tabs.tsx`                    | Radix Tabs (ersätter inte list filter-chips) |
| `components/ui/combobox.tsx`                | cmdk + Popover                               |
| `components/ui/sonner.tsx`                  | Toast via sonner (`<Toaster />` i app-roten) |

---

## 7. Utanför foundation

Massmigrering av `rounded-xl`, Lucide-storlekar, 28 plugin-dialoger, diagramhex, publika CSS-tokens, bakgrund/primärbyte, Wint soft-fill badges.
