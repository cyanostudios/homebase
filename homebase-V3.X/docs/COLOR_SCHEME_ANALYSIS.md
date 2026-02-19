# Färgschema-analys

## Översikt

Detta är ett Bootstrap-baserat färgschema med omfattande färgpaletter och semantiska färger.

---

## Primärfärger

### Primary (Blå)

- **Active**: `#009EF7` (eller `#0095E8` i light-varianten)
- **Light**: `#F1FAFF` (mycket ljus bakgrund)
- **RGB**: `rgb(53, 149, 246)` (Tagify primary)
- **HSL (uppskattat)**: ~200° (cyansk blå)

---

## Gråskala (Gray Scale)

| Variant         | Hex       | Användning               |
| --------------- | --------- | ------------------------ |
| `--bs-gray-100` | `#F5F8FA` | Ljusast, bakgrunder      |
| `--bs-gray-200` | `#EFF2F5` | Ljus bakgrund, borders   |
| `--bs-gray-300` | `#E4E6EF` | Secondary color, borders |
| `--bs-gray-400` | `#B5B5C3` | Disabled text            |
| `--bs-gray-500` | `#A1A5B7` | Placeholder text         |
| `--bs-gray-600` | `#7E8299` | Body text, default gray  |
| `--bs-gray-700` | `#5E6278` | Headings, emphasis       |
| `--bs-gray-800` | `#3F4254` | Dark gray                |
| `--bs-gray-900` | `#181C32` | Darkest, dark mode text  |

---

## Semantiska färger (Success, Info, Warning, Danger)

### Success (Grön)

- **Active**: `#50CD89` (eller `#47BE7D` i active-varianten)
- **Light**: `#E8FFF3`

### Info (Lila)

- **Active**: `#7239EA` (eller `#5014D0` i active-varianten)
- **Light**: `#F8F5FF`

### Warning (Gul)

- **Active**: `#FFC700` (eller `#F1BC00` i active-varianten)
- **Light**: `#FFF8DD`

### Danger (Röd/Rosa)

- **Active**: `#F1416C` (eller `#D9214E` i active-varianten)
- **Light**: `#FFF5F8`

### Dark

- **Active**: `#181C32`
- **Light**: `#EFF2F5`

---

## Ytterligare färger

| Färg          | Hex       | Beskrivning               |
| ------------- | --------- | ------------------------- |
| `--bs-blue`   | `#009ef6` | Standard blå              |
| `--bs-indigo` | `#6610f2` | Indigo                    |
| `--bs-purple` | `#6f42c1` | Lila                      |
| `--bs-pink`   | `#d63384` | Rosa                      |
| `--bs-red`    | `#dc3545` | Röd                       |
| `--bs-orange` | `#fd7e14` | Orange                    |
| `--bs-yellow` | `#ffc107` | Gul                       |
| `--bs-green`  | `#198754` | Grön                      |
| `--bs-teal`   | `#20c997` | Teal                      |
| `--bs-cyan`   | `#0dcaf0` | Cyan                      |
| `--bs-white`  | `#ffffff` | Vit                       |
| `--bs-light`  | `#F5F8FA` | Ljus (samma som gray-100) |

---

## Designmönster

### Light/Active Pattern

Varje semantisk färg har två varianter:

1. **Light**: Mycket ljus bakgrundsfärg (t.ex. `#F1FAFF` för primary)
2. **Active**: Mättad accentfärg (t.ex. `#009EF7` för primary)

Detta används för:

- Hover states
- Active states
- Background highlights
- Border colors

### Responsive Breakpoints

```css
--bs-xs: 0;
--bs-sm: 576px;
--bs-md: 768px;
--bs-lg: 992px;
--bs-xl: 1200px;
--bs-xxl: 1400px;
```

---

## Mappning till shadcn/ui CSS-variabler

För att använda detta schema med shadcn/ui, kan vi mappa till HSL:

### Primary Color (mappning till shadcn/ui)

```css
/* Nuvarande (ljusblå): */
--primary: hsl(200, 98%, 49%);

/* Från schemat (Bootstrap primary): */
--primary: hsl(200, 100%, 48%); /* #009EF7 */

/* Light variant för hover/active: */
--primary-foreground: hsl(200, 100%, 97%); /* #F1FAFF */
```

### Grayscale (mappning till shadcn/ui)

```css
/* Background */
--background: hsl(210, 30%, 98%); /* #F5F8FA (gray-100) */
--muted: hsl(210, 15%, 95%); /* #EFF2F5 (gray-200) */

/* Borders */
--border: hsl(220, 15%, 90%); /* #E4E6EF (gray-300) */

/* Text */
--foreground: hsl(220, 20%, 40%); /* #5E6278 (gray-700) */
--muted-foreground: hsl(220, 15%, 60%); /* #7E8299 (gray-600) */
```

### Semantic Colors

````css
/* Success */
--success: hsl(148, 60%, 58%); /* #50CD89 */
--success-light: hsl(148, 100%, 96%); /* #E8FFF3 */

/* Warning */
--warning: hsl(47, 100%, 50%); /* #FFC700 */
--warning-light: hsl(47, 100%, 93%); /* #FFF8DD */

```css
/* Error/Danger */
--destructive: hsl(348, 86%, 56%); /* #F1416C */
--destructive-light: hsl(348, 100%, 97%); /* #FFF5F8 */
````

### Plugin Semantic Colors (V3 Standard)

Homebase V3 introduces a dedicated color for each major plugin to provide clear visual separation.

| Plugin        | HSL Representation | CSS Variable         | Identity        |
| :------------ | :----------------- | :------------------- | :-------------- |
| **Notes**     | `45 93% 47%`       | `--plugin-notes`     | Amber / Yellow  |
| **Contacts**  | `217 91% 60%`      | `--plugin-contacts`  | Blue / Azure    |
| **Tasks**     | `271 91% 65%`      | `--plugin-tasks`     | Purple / Violet |
| **Estimates** | `199 89% 48%`      | `--plugin-estimates` | Sky / Cyan      |
| **Invoices**  | `142 71% 45%`      | `--plugin-invoices`  | Emerald / Green |
| **Files**     | `215 16% 47%`      | `--plugin-files`     | Slate / Gray    |
| **Mail**      | `346 84% 61%`      | `--plugin-mail`      | Rose / Pink     |

#### Utility Usage

These colors are applied via utility classes:

- `.bg-plugin-subtle`: 8% opacity in light mode, 15% in dark.
- `.border-plugin-subtle`: 20% opacity.
- `.text-plugin`: 100% opacity.

---

## Rekommendationer

### För Homebase-appen

1. **Behåll nuvarande primary** (`hsl(200, 98%, 49%)`) - den är mycket nära Bootstrap primary (`#009EF7`)

2. **Använd grayscale från schemat** för konsistens:
   - Background: `#F5F8FA` (gray-100)
   - Muted: `#EFF2F5` (gray-200)
   - Borders: `#E4E6EF` (gray-300)

3. **Semantiska färger** från schemat passar bra:
   - Success: `#50CD89`
   - Warning: `#FFC700`
   - Danger: `#F1416C`

4. **Light/Active pattern** kan användas för:
   - Badge backgrounds
   - Hover states
   - Active navigation items

---

## Kännetecken

- **Professionellt**: Väl balanserat färgschema med tydlig hierarki
- **Tillgängligt**: Good contrast ratios mellan text och bakgrund
- **Konsistent**: Tydliga mönster (light/active) genom alla färger
- **Bootstrap-kompatibelt**: Följer Bootstrap's design tokens

---

**Notera**: Detta schema använder hex-färger, medan shadcn/ui använder HSL. Konvertering krävs för optimal kompatibilitet.
